/**
 * Turn a photo into a voxel bust.
 *
 * Pipeline: downsample to an N x N grid of average colors, cut the background
 * by flooding inward from the border, posterise the survivors to a small
 * palette, then give each cell a front surface (a radial "head dome" plus
 * terraced luminance relief) and a back surface (a shallower dome), so the
 * result is a rounded mass rather than a flat relief.
 *
 * Each voxel is emitted as [x, y, zFront, zBack, r, g, b].
 */

export const DEFAULTS = {
  size: 40, // grid resolution (N x N cells) — deliberately chunky
  domeDepth: 16, // cells the front face bulges toward the viewer
  backDepth: 11, // cells the back bulges away, so the head is a rounded mass
                 // rather than a slab — it only matters once you can drag it
  reliefDepth: 7, // cells of feature relief on top of the dome
  reliefSteps: 4, // relief is terraced into this many levels
  bgTolerance: 28, // euclidean RGB distance from the border reference color
  greenBias: 1.0, // g must exceed r by this factor to read as foliage bokeh
  // A headshot averaged down to one color per cell is very low contrast, and
  // at portrait scale the eyes, glasses and hairline wash into the skin.
  // Pushing each channel away from the subject's mean restores the features.
  contrast: 1.7,
  saturation: 1.45,
  // Posterise to this many flat colours. This is what makes the portrait read
  // as a cartoon rather than a photo, and flat regions are also what let the
  // depth be exaggerated without the relief turning into noise.
  paletteSize: 7,
}

const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/** Average each grid cell's color from the source pixels it covers. */
function downsample({ data, width, height }, size) {
  const cells = new Array(size * size)
  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      const x0 = Math.floor((gx * width) / size)
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / size))
      const y0 = Math.floor((gy * height) / size)
      const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / size))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 3
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          n++
        }
      }
      cells[gy * size + gx] = { r: r / n, g: g / n, b: b / n }
    }
  }
  return cells
}

const distance = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)

/**
 * Foliage bokeh is green-dominant; skin is red-dominant. That single
 * comparison separates this portrait's background from its subject far more
 * reliably than any brightness or distance threshold.
 */
const isBokeh = (c, greenBias) => c.g > c.r * greenBias

/** Median color of the border cells that already read as background. */
function borderReference(cells, size, greenBias) {
  const border = []
  for (let i = 0; i < size; i++) {
    for (const idx of [i, (size - 1) * size + i, i * size, i * size + size - 1]) {
      if (isBokeh(cells[idx], greenBias)) border.push(cells[idx])
    }
  }
  if (border.length === 0) return null
  const median = (key) => {
    const sorted = border.map((c) => c[key]).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }
  return { r: median('r'), g: median('g'), b: median('b') }
}

/**
 * Mark background cells by breadth-first flood fill inward from the border.
 * A cell joins the background if it reads as bokeh, or if it is very close to
 * the border's reference color — the tight tolerance matters, because a
 * neighbor-relative one lets the fill crawl through a photo's smooth gradients
 * and consume the subject entirely.
 */
function findBackground(cells, size, { bgTolerance, greenBias }) {
  const bg = new Uint8Array(size * size)
  const queue = []
  const reference = borderReference(cells, size, greenBias)

  const isBackground = (cell) =>
    isBokeh(cell, greenBias) ||
    (reference !== null && distance(cell, reference) < bgTolerance)

  const seed = (idx) => {
    if (bg[idx] || !isBackground(cells[idx])) return
    bg[idx] = 1
    queue.push(idx)
  }

  for (let i = 0; i < size; i++) {
    for (const idx of [i, (size - 1) * size + i, i * size, i * size + size - 1]) {
      seed(idx)
    }
  }

  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]
    const cx = idx % size
    const cy = Math.floor(idx / size)
    for (const [nx, ny] of [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
      seed(ny * size + nx)
    }
  }

  return bg
}

const neighbours = (idx, size) => {
  const cx = idx % size
  const cy = Math.floor(idx / size)
  return [
    [cx - 1, cy],
    [cx + 1, cy],
    [cx, cy - 1],
    [cx, cy + 1],
  ]
}

/** A cell survives only if all four of its neighbours are also in the mask. */
function erode(mask, size) {
  const out = new Uint8Array(mask.length)
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    let solid = true
    for (const [nx, ny] of neighbours(i, size)) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || !mask[ny * size + nx]) {
        solid = false
        break
      }
    }
    if (solid) out[i] = 1
  }
  return out
}

/**
 * Grow the mask by one cell in all eight directions, never outside `limit`.
 *
 * The eight-way spread is deliberate against the four-way erode: it restores
 * the convex corners that erosion shaved off, so a solid shape comes back
 * whole, while a bridge thin enough to have vanished entirely cannot return.
 */
function dilate(mask, size, limit) {
  const out = Uint8Array.from(mask)
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const cx = i % size
    const cy = Math.floor(i / size)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
        const ni = ny * size + nx
        if (limit[ni]) out[ni] = 1
      }
    }
  }
  return out
}

/** Keep only the largest 4-connected foreground blob, dropping stray specks. */
function largestComponent(bg, size) {
  const label = new Int32Array(size * size).fill(-1)
  let best = -1
  let bestSize = 0
  let current = 0

  for (let start = 0; start < bg.length; start++) {
    if (bg[start] || label[start] !== -1) continue
    const queue = [start]
    label[start] = current
    let count = 0
    let head = 0
    while (head < queue.length) {
      const idx = queue[head++]
      count++
      const cx = idx % size
      const cy = Math.floor(idx / size)
      for (const [nx, ny] of [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
        const nIdx = ny * size + nx
        if (bg[nIdx] || label[nIdx] !== -1) continue
        label[nIdx] = current
        queue.push(nIdx)
      }
    }
    if (count > bestSize) {
      bestSize = count
      best = current
    }
    current++
  }

  return { label, best }
}

const clamp8 = (value) => Math.max(0, Math.min(255, Math.round(value)))

/** Mean color of the cells that survived background removal. */
function subjectMean(cells, indices) {
  let r = 0
  let g = 0
  let b = 0
  for (const i of indices) {
    r += cells[i].r
    g += cells[i].g
    b += cells[i].b
  }
  const n = Math.max(1, indices.length)
  return { r: r / n, g: g / n, b: b / n }
}

/** Push a color away from the subject mean, then away from its own grey. */
function grade(cell, mean, contrast, saturation) {
  const r = mean.r + (cell.r - mean.r) * contrast
  const g = mean.g + (cell.g - mean.g) * contrast
  const b = mean.b + (cell.b - mean.b) * contrast
  const grey = (r + g + b) / 3
  return {
    r: clamp8(grey + (r - grey) * saturation),
    g: clamp8(grey + (g - grey) * saturation),
    b: clamp8(grey + (b - grey) * saturation),
  }
}

/**
 * Reduce the subject to `k` flat colors with Lloyd's algorithm.
 *
 * Deterministic on purpose: centroids seed from evenly spaced points in a
 * luma-sorted list rather than at random, so the committed voxels.json is
 * reproducible and re-running the build produces no spurious diff.
 */
/**
 * Colour distance weighted toward brightness.
 *
 * Plain RGB distance splits a face by hue, so one cheek clusters warm and the
 * other cool and the portrait goes patchy. Weighting luma makes the clusters
 * fall into shading bands instead — light skin, mid, shadow, hair — which is
 * what cel shading actually looks like.
 */
const LUMA_WEIGHT = 2.4

function shadeDistance(a, b) {
  const dl = (luma(a.r, a.g, a.b) - luma(b.r, b.g, b.b)) * 255 * LUMA_WEIGHT
  return Math.hypot(dl, a.r - b.r, a.g - b.g, a.b - b.b)
}

function quantize(colors, k, iterations = 16) {
  const count = Math.min(k, colors.length)
  const sorted = [...colors].sort((a, b) => luma(a.r, a.g, a.b) - luma(b.r, b.g, b.b))
  const centroids = []
  for (let i = 0; i < count; i++) {
    centroids.push({ ...sorted[Math.floor(((i + 0.5) / count) * sorted.length)] })
  }

  const assignment = new Array(colors.length).fill(0)
  for (let step = 0; step < iterations; step++) {
    let moved = false
    for (let i = 0; i < colors.length; i++) {
      let pick = 0
      let closest = Infinity
      for (let j = 0; j < centroids.length; j++) {
        const d = shadeDistance(colors[i], centroids[j])
        if (d < closest) {
          closest = d
          pick = j
        }
      }
      if (assignment[i] !== pick) {
        assignment[i] = pick
        moved = true
      }
    }

    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }))
    for (let i = 0; i < colors.length; i++) {
      const bucket = sums[assignment[i]]
      bucket.r += colors[i].r
      bucket.g += colors[i].g
      bucket.b += colors[i].b
      bucket.n++
    }
    for (let j = 0; j < centroids.length; j++) {
      if (sums[j].n === 0) continue
      centroids[j] = { r: sums[j].r / sums[j].n, g: sums[j].g / sums[j].n, b: sums[j].b / sums[j].n }
    }

    if (!moved) break
  }

  const palette = centroids.map((c) => ({ r: clamp8(c.r), g: clamp8(c.g), b: clamp8(c.b) }))
  return { palette, assignment }
}

/**
 * Relief for each subject cell: blur the luma, then step it into terraces.
 *
 * Deriving relief from each cell's own colour instead ties depth to colour
 * noise, and the mid-face breaks into scattered pits. Blurring first makes the
 * relief follow the broad form of the face, and stepping it gives the clean
 * plateaus that read as carved rather than photographic.
 */
function terracedRelief(cells, size, indices, { reliefSteps, reliefDepth }) {
  const inSubject = new Uint8Array(size * size)
  for (const i of indices) inSubject[i] = 1

  let field = new Float32Array(size * size)
  for (const i of indices) field[i] = luma(cells[i].r, cells[i].g, cells[i].b)

  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(size * size)
    for (const i of indices) {
      const cx = i % size
      const cy = Math.floor(i / size)
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
          const ni = ny * size + nx
          if (!inSubject[ni]) continue
          sum += field[ni]
          n++
        }
      }
      next[i] = sum / Math.max(1, n)
    }
    field = next
  }

  let min = Infinity
  let max = -Infinity
  for (const i of indices) {
    if (field[i] < min) min = field[i]
    if (field[i] > max) max = field[i]
  }
  const range = Math.max(1e-6, max - min)
  const topLevel = Math.max(1, reliefSteps - 1)

  const relief = new Int32Array(size * size)
  for (const i of indices) {
    const level = Math.min(reliefSteps - 1, Math.floor(((field[i] - min) / range) * reliefSteps))
    relief[i] = Math.round((level / topLevel) * reliefDepth)
  }
  return relief
}

export function voxelize(image, options = {}) {
  const opts = { ...DEFAULTS, ...options }
  const { size, domeDepth, backDepth, contrast, saturation, paletteSize } = opts

  const cells = downsample(image, size)
  const bg = findBackground(cells, size, opts)
  // Open the mask (erode, keep the largest blob, dilate back) before taking
  // the subject. A plain largest-component pass keeps bright bokeh that
  // happens to touch the hair, because a one-cell bridge is enough to join it;
  // eroding first snaps those bridges, and the dilate restores the real
  // silhouette without restoring the blob.
  const subject = new Uint8Array(cells.length)
  for (let i = 0; i < cells.length; i++) subject[i] = bg[i] ? 0 : 1

  const eroded = erode(subject, size)
  const { label, best } = largestComponent(
    Uint8Array.from(eroded, (v) => (v ? 0 : 1)),
    size,
  )
  const core = new Uint8Array(cells.length)
  for (let i = 0; i < cells.length; i++) core[i] = eroded[i] && label[i] === best ? 1 : 0

  const kept = dilate(core, size, subject)

  const indices = []
  for (let i = 0; i < cells.length; i++) {
    if (kept[i]) indices.push(i)
  }
  if (indices.length === 0) return { size, count: 0, voxels: [] }

  const mean = subjectMean(cells, indices)
  const graded = indices.map((i) => grade(cells[i], mean, contrast, saturation))
  const { palette, assignment } = quantize(graded, paletteSize)
  const relief = terracedRelief(cells, size, indices, opts)

  const half = size / 2
  const voxels = indices.map((idx, n) => {
    const gx = idx % size
    const gy = Math.floor(idx / size)
    // Normalized offset from the grid center, in the range -1..1.
    const u = (gx + 0.5 - half) / half
    const v = (gy + 0.5 - half) / half
    // Radial dome: full depth at center, zero at the silhouette edge.
    const dome = Math.sqrt(Math.max(0, 1 - (u * u + v * v)))
    const tone = palette[assignment[n]]

    return [
      Math.round(gx - half),
      Math.round(half - gy), // flip so +y is up in three.js world space
      Math.round(dome * domeDepth) + relief[idx],
      -Math.round(dome * backDepth),
      tone.r,
      tone.g,
      tone.b,
    ]
  })

  return { size, count: voxels.length, voxels }
}
