/**
 * Turn a photo into a bas-relief voxel grid.
 *
 * Pipeline: downsample to an N x N grid of average colors, cut the background
 * by flooding inward from the border, then give each surviving cell a depth
 * built from a radial "head dome" plus luminance relief.
 */

export const DEFAULTS = {
  size: 40, // grid resolution (N x N cells) — deliberately chunky
  domeDepth: 12, // cells of curvature across the head
  reliefDepth: 7, // cells of feature relief from brightness
  bgTolerance: 28, // euclidean RGB distance from the border reference color
  greenBias: 1.0, // g must exceed r by this factor to read as foliage bokeh
  // A headshot averaged down to one color per cell is very low contrast, and
  // at portrait scale the eyes, glasses and hairline wash into the skin.
  // Pushing each channel away from the subject's mean restores the features.
  contrast: 1.7,
  saturation: 1.2,
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
function subjectMean(cells, keep) {
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < cells.length; i++) {
    if (!keep(i)) continue
    r += cells[i].r; g += cells[i].g; b += cells[i].b; n++
  }
  return n === 0 ? null : { r: r / n, g: g / n, b: b / n }
}

export function voxelize(image, options = {}) {
  const opts = { ...DEFAULTS, ...options }
  const { size, domeDepth, reliefDepth, contrast, saturation } = opts

  const cells = downsample(image, size)
  const bg = findBackground(cells, size, opts)
  const { label, best } = largestComponent(bg, size)

  const kept = (i) => !bg[i] && label[i] === best
  const mean = subjectMean(cells, kept)

  const grade = (cell) => {
    if (!mean) return cell
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

  const half = size / 2
  const voxels = []

  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      const idx = gy * size + gx
      if (!kept(idx)) continue

      const cell = grade(cells[idx])
      // Normalized offset from the grid center, in the range -1..1.
      const u = (gx + 0.5 - half) / half
      const v = (gy + 0.5 - half) / half
      // Radial dome: full depth at center, zero at the silhouette edge.
      const dome = Math.sqrt(Math.max(0, 1 - (u * u + v * v)))
      const z = Math.round(dome * domeDepth + luma(cell.r, cell.g, cell.b) * reliefDepth)

      voxels.push([
        Math.round(gx - half),
        Math.round(half - gy), // flip so +y is up in three.js world space
        z,
        cell.r,
        cell.g,
        cell.b,
      ])
    }
  }

  return { size, count: voxels.length, voxels }
}
