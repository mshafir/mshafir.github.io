/**
 * A cartoon bust whose shape comes from a head scan.
 *
 * The scan supplies proportions: the profile from brow to chin, how wide the
 * jaw is, where the glasses sit, how high the hairline runs. It is far too
 * rough to show as-is, so everything else is thrown away. The head is reduced
 * to a radius around a vertical axis, smoothed and made symmetric, and then
 * painted the way the hand-authored figure was: flat skin, drawn eyes behind
 * drawn frames, a smile, a suit.
 *
 * Coordinates are the voxelizer's grid: +x right, +y up, +z toward the viewer.
 * The head's own axis is at (axis.x, axis.z); output is recentred on it.
 */
import { PALETTE as CARTOON, clump, hash3 } from './figure.mjs'

export const PALETTE = {
  ...CARTOON,
  // Short, dark, going grey. The scan's hair is browner than it looks in life.
  hair: [64, 50, 42],
  hairLight: [96, 80, 68],
  hairDark: [42, 32, 26],
  hairGrey: [132, 122, 114],
  // Black rectangular frames.
  frame: [38, 38, 44],
  temple: [54, 54, 60],
  iris: [104, 112, 72],
  // A blue-grey chambray, since that is what the scan is wearing.
  shirt: [248, 247, 242],
}

const key = (x, y, z) => `${x},${y},${z}`
const clamp01 = (t) => Math.min(1, Math.max(0, t))
const smoothstep = (t) => {
  const s = clamp01(t)
  return s * s * (3 - 2 * s)
}
const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b

// --- measurement ---------------------------------------------------------

/**
 * Read landmarks off the scanned solid.
 *
 * @param solid   Set of "x,y,z" keys for every cell inside the scan
 * @param surface voxels with colours, for the glasses and the hairline
 * @param axis    { x, z } of the head's vertical axis in that grid
 */
export function measure(solid, surface, { axis }) {
  const cells = [...solid].map((k) => k.split(',').map(Number))
  const topY = Math.max(...cells.map((c) => c[1]))
  const bottomY = Math.min(...cells.map((c) => c[1]))

  // Depth of the front surface along the midline, per row.
  const frontZ = new Map()
  for (const [x, y, z] of cells) {
    if (Math.abs(x - axis.x) > 1) continue
    frontZ.set(y, Math.max(frontZ.get(y) ?? -Infinity, z))
  }
  const front = (y) => frontZ.get(y) ?? -Infinity

  // The nose tip is the most forward point of the midline.
  let noseY = bottomY
  for (let y = bottomY; y <= topY; y++) if (front(y) > front(noseY)) noseY = y

  // The chin is the row below the nose where the midline steps back furthest
  // going down: the underside of the jaw.
  let chinY = noseY - 8
  let biggestStep = -Infinity
  for (let y = noseY - 4; y > bottomY + 2; y--) {
    const step = front(y) - front(y - 1)
    if (step > biggestStep) {
      biggestStep = step
      chinY = y
    }
  }

  // Lips: a local bulge on the midline between chin and nose. Failing that,
  // the usual proportion.
  let mouthY = Math.round(chinY + (noseY - chinY) * 0.42)
  let best = -Infinity
  for (let y = Math.ceil(chinY + (noseY - chinY) * 0.3); y <= noseY - 4; y++) {
    const bulge = front(y) - (front(y - 2) + front(y + 2)) / 2
    if (bulge > best) {
      best = bulge
      mouthY = y
    }
  }

  // Glasses: dark, unsaturated cells on the front of the face above the nose.
  const dark = surface.filter(([x, y, z, r, g, b]) => {
    const c = [r, g, b]
    return (
      y > noseY && y < noseY + 16 && z > axis.z + 6 && luma(c) < 75 && Math.max(r, g, b) - Math.min(r, g, b) < 40
    )
  })
  // The band is the contiguous run of well-populated rows around the busiest
  // one. Hair further up is dark too, and must not be swept in.
  const rows = new Map()
  for (const v of dark) rows.set(v[1], (rows.get(v[1]) ?? 0) + 1)
  let peakY = noseY
  for (const [y, n] of rows) if (n > (rows.get(peakY) ?? 0)) peakY = y
  const peak = rows.get(peakY) ?? 0
  let bandBottom = peakY
  let bandTop = peakY
  while ((rows.get(bandBottom - 1) ?? 0) >= peak * 0.35) bandBottom--
  while ((rows.get(bandTop + 1) ?? 0) >= peak * 0.35) bandTop++
  const bandCells = dark.filter((v) => v[1] >= bandBottom && v[1] <= bandTop)
  const xs = bandCells.map((v) => v[0] - axis.x).sort((a, b) => a - b)
  const pick = (q) => xs[Math.min(xs.length - 1, Math.floor(q * xs.length))]
  const frameHalfWidth = (pick(0.97) - pick(0.03)) / 2

  return {
    axis,
    topY,
    bottomY,
    chinY,
    noseY,
    noseZ: front(noseY) - axis.z,
    mouthY,
    glasses: { bottom: bandBottom, top: bandTop, halfWidth: frameHalfWidth },
  }
}

// --- carving -------------------------------------------------------------

const TAU = Math.PI * 2

/**
 * Reduce the head to a radius per row and bearing, smoothed and symmetric,
 * with a hair fraction alongside.
 *
 * The result is plain data, small enough to commit: it is everything the
 * caricature needs from the scan, so the scan itself never has to be.
 *
 * Each cell in a row falls into one of `bins` bearings about the axis; the
 * radius for that bearing is the furthest cell in it. That flattens every
 * lump the scan invented while keeping the nose, chin and brow. Averaging
 * each bearing with its mirror makes the face symmetric, which is what a
 * caricature wants. `exaggerate` then pushes every radius away from the row's
 * mean, so what stands out stands out more.
 */
export function carve(solid, surface, m, { bins = 72, sigma = 1.4, exaggerate = 1.15, fromY, toY }) {
  const { axis } = m
  const bearing = (x, z) => {
    const t = Math.atan2(x - axis.x, z - axis.z)
    return Math.round(((t < 0 ? t + TAU : t) / TAU) * bins) % bins
  }

  const rowsCount = toY - fromY + 1
  const radius = Array.from({ length: rowsCount }, () => new Float64Array(bins).fill(NaN))
  for (const k of solid) {
    const [x, y, z] = k.split(',').map(Number)
    if (y < fromY || y > toY) continue
    const b = bearing(x, z)
    const r = Math.hypot(x - axis.x, z - axis.z)
    const row = radius[y - fromY]
    if (Number.isNaN(row[b]) || r > row[b]) row[b] = r
  }

  // Hair: which surface cells the texture says are hair, per bearing.
  const hairHits = Array.from({ length: rowsCount }, () => new Float64Array(bins))
  const hits = Array.from({ length: rowsCount }, () => new Float64Array(bins))
  for (const [x, y, z, r, g, b] of surface) {
    if (y < fromY || y > toY) continue
    const bb = bearing(x, z)
    hits[y - fromY][bb]++
    const c = [r, g, b]
    // Dark cells count as hair except on the face itself, where they are
    // brows, frames and stubble.
    const onFace = z > axis.z + 2 && y <= m.glasses.top + 5
    if (luma(c) < 118 && !onFace) hairHits[y - fromY][bb]++
  }

  // Fill bearings no cell fell into from their neighbours around the ring.
  for (const row of radius) {
    for (let b = 0; b < bins; b++) {
      if (!Number.isNaN(row[b])) continue
      for (let d = 1; d < bins; d++) {
        const lo = row[(b - d + bins) % bins]
        const hi = row[(b + d) % bins]
        const known = [lo, hi].filter((v) => !Number.isNaN(v))
        if (known.length) {
          row[b] = known.reduce((s, v) => s + v, 0) / known.length
          break
        }
      }
    }
  }

  const gaussian = (grid, s) => {
    const reach = Math.ceil(s * 2.5)
    const w = []
    for (let d = -reach; d <= reach; d++) w.push(Math.exp(-(d * d) / (2 * s * s)))
    const out = grid.map((row) => new Float64Array(row.length))
    for (let i = 0; i < grid.length; i++) {
      for (let b = 0; b < bins; b++) {
        let sum = 0
        let wsum = 0
        for (let di = -reach; di <= reach; di++) {
          const row = grid[i + di]
          if (!row) continue
          for (let db = -reach; db <= reach; db++) {
            const v = row[(b + db + bins) % bins]
            if (Number.isNaN(v)) continue
            const ww = w[di + reach] * w[db + reach]
            sum += v * ww
            wsum += ww
          }
        }
        out[i][b] = wsum ? sum / wsum : NaN
      }
    }
    return out
  }

  let smooth = gaussian(radius, sigma)
  const hairFrac = gaussian(
    hairHits.map((row, i) => row.map((h, b) => (hits[i][b] ? h / hits[i][b] : NaN))),
    2,
  )

  // Mirror about the x = axis plane: bearing b and -b.
  for (const grid of [smooth, hairFrac]) {
    for (const row of grid) {
      for (let b = 0; b < bins; b++) {
        const mb = (bins - b) % bins
        if (mb <= b) continue
        const avg = (row[b] + row[mb]) / 2
        row[b] = avg
        row[mb] = avg
      }
    }
  }

  for (const row of smooth) {
    const mean = row.reduce((s, v) => s + v, 0) / bins
    for (let b = 0; b < bins; b++) row[b] = mean + (row[b] - mean) * exaggerate
  }

  const round = (v, places) => (Number.isNaN(v) ? 0 : +v.toFixed(places))
  return {
    fromY,
    toY,
    bins,
    radius: smooth.map((row) => [...row].map((v) => round(v, 2))),
    hair: hairFrac.map((row) => [...row].map((v) => round(v, 2))),
  }
}

/** Lookups over a carved shape, by row and position. */
export function shapeFrom(data, axis) {
  const { fromY, toY, bins, radius, hair } = data
  const bearing = (x, z) => {
    const t = Math.atan2(x - axis.x, z - axis.z)
    return Math.round(((t < 0 ? t + TAU : t) / TAU) * bins) % bins
  }
  return {
    fromY,
    toY,
    radiusAt: (y, x, z) => {
      const row = radius[y - fromY]
      return row ? row[bearing(x, z)] : -Infinity
    },
    hairAt: (y, x, z) => {
      const row = hair[y - fromY]
      return row ? row[bearing(x, z)] : 0
    },
  }
}

// --- the model -----------------------------------------------------------

/**
 * Paint the carved head and add an authored body.
 *
 * Everything that follows is placed by the measured landmarks, so a new scan
 * moves the features with the face.
 */
export function buildCaricature(m, shape, { bounds }) {
  const { axis, chinY, noseY, mouthY, glasses } = m
  const ax = axis.x
  const az = axis.z

  // Below the chin the jaw closes quickly onto the neck; the scan's rows there
  // are collar and shoulder, which is not what a head does.
  const inHead = (x, y, z) => {
    const r = y >= chinY ? shape.radiusAt(y, x, z) : shape.radiusAt(chinY, x, z) * (1 - (chinY - y) * 0.3)
    return Math.hypot(x - ax, z - az) <= r
  }

  // Front-most head cell per x/y column, so features can sit on the surface.
  const frontCache = new Map()
  const frontDepth = (x, y) => {
    const k = `${x},${y}`
    if (frontCache.has(k)) return frontCache.get(k)
    let best = -Infinity
    for (let z = az + bounds.z; z >= az; z--) {
      if (inHead(x, y, z)) {
        best = z
        break
      }
    }
    frontCache.set(k, best)
    return best
  }
  const halfWidthCache = new Map()
  const headHalfWidth = (y, z) => {
    const k = `${y},${z}`
    if (halfWidthCache.has(k)) return halfWidthCache.get(k)
    let best = -Infinity
    for (let x = bounds.x + ax; x >= ax; x--) {
      if (inHead(x, y, z)) {
        best = x - ax
        break
      }
    }
    halfWidthCache.set(k, best)
    return best
  }

  // Proportions from the glasses: eyes sit in the lenses, brows above them.
  const bandMid = (glasses.top + glasses.bottom) / 2
  const lensHalfW = glasses.halfWidth * 0.4
  const lensHalfH = Math.max(3, (glasses.top - glasses.bottom) / 2 + 1)
  const lensX = glasses.halfWidth - lensHalfW - 0.5
  const EYE = { x: lensX - 0.6, y: bandMid - 0.2 }
  const BROW = { x: lensX + 0.3, y: glasses.top + 2.6, half: lensHalfW * 0.95 }
  const faceHalf = Math.max(6, headHalfWidth(mouthY, frontDepth(ax, mouthY) - 4))
  const MOUTH = { y: mouthY, half: Math.min(faceHalf * 0.55, lensHalfW * 1.5) }
  const noseBase = noseY - 2

  function sampleFace(x, y, z) {
    const dx0 = x - ax

    // Mouth: a broad smile, open only a little, one row of teeth.
    const lower = MOUTH.y - 1 + (0.06 * dx0 * dx0) / (MOUTH.half / 6.5)
    const upper = MOUTH.y + 0.9 + (0.015 * dx0 * dx0) / (MOUTH.half / 6.5)
    if (Math.abs(dx0) <= MOUTH.half) {
      if (y > lower && y < upper) {
        return y >= lower + 0.9 && Math.abs(dx0) <= MOUTH.half * 0.62 ? PALETTE.teeth : PALETTE.mouth
      }
      if ((y >= lower - 0.9 && y <= lower) || (y >= upper && y <= upper + 0.8)) return PALETTE.lip
    }

    // Eyes.
    for (const side of [-1, 1]) {
      const dx = dx0 - side * EYE.x
      const dy = y - EYE.y
      const out = side * dx
      if (Math.abs(out - 1) < 0.6 && Math.abs(dy - 1) < 0.6) return PALETTE.glint
      if (Math.hypot(dx, dy) <= 0.75) return PALETTE.pupil
      if ((dx / 1.6) ** 2 + (dy / 1.45) ** 2 <= 1) return PALETTE.iris
      if ((dx / 2.7) ** 2 + (dy / 1.7) ** 2 <= 1) return PALETTE.sclera
    }

    // Brows: thick, dark, nearly straight.
    for (const side of [-1, 1]) {
      const dx = dx0 - side * BROW.x
      if (Math.abs(dx) > BROW.half) continue
      const arch = BROW.y + 0.3 - 0.03 * dx * dx
      const half = 1.05 - 0.1 * Math.max(0, Math.abs(dx) - 2)
      if (Math.abs(y - arch) <= half) return PALETTE.brow
    }

    // Shadow under each eye.
    for (const side of [-1, 1]) {
      const dx = dx0 - side * EYE.x
      if (Math.abs(dx) <= 2 && y >= EYE.y - 3.2 && y <= EYE.y - 2.4) return PALETTE.skinMid
    }

    // Smile lines from the nose to past the corners of the mouth.
    for (const side of [-1, 1]) {
      const fold = distanceToSegment(
        dx0, y,
        side * 3, noseBase + 0.5,
        side * (MOUTH.half + 1.2), MOUTH.y - 0.5,
      )
      if (fold <= 0.55) return PALETTE.skinMid
    }

    // Beard shadow over the jaw, chin and upper lip, speckled.
    const belowNose = y <= noseBase - 1.5
    const jawline = y <= MOUTH.y - 3 || Math.abs(dx0) >= MOUTH.half + 1.6
    if (belowNose && (jawline || y >= MOUTH.y + 1.8) && hash3(x, y, z) > 0.62) return PALETTE.stubble
    return null
  }

  /** Surfaces that face downward fall into shadow: under nose, lip and chin. */
  const facesDown = (x, y) => frontDepth(x, y) < frontDepth(x, y + 1) - 1.2

  function hairColour(x, y, z) {
    if (z < az - 8) return PALETTE.hairDark
    if (Math.abs(x - ax) >= 11 && y <= glasses.top + 10 && hash3(x, y, z) > 0.8) return PALETTE.hairGrey
    const n = clump(x, y, z, 3, 5)
    if (n > 0.78 && y > glasses.top + 8 && z > az - 2) return PALETTE.hairLight
    if (n < 0.18) return PALETTE.hairDark
    return PALETTE.hair
  }

  /**
   * Where the hair grows. The texture decides the shape of the hairline at the
   * front and the temples; elsewhere it is too easily fooled by shadow and
   * stubble, so the sides stop at the eye line, the back at the nape, and the
   * crown is always covered.
   */
  const hairCovers = (x, y, z) => {
    const frac = shape.hairAt(y, x, z)
    if (y >= glasses.top + 9) return frac > 0.1
    if (z > az + 2) return y >= BROW.y + 4 && frac > 0.45
    if (z > az - 7) return y >= bandMid - 1 && frac > 0.3
    return y >= mouthY - 2 && frac > 0.15
  }

  // Ears, which the smoothing rubs off the sides.
  const EAR = { y: bandMid - 2.5, z: az - 1 }
  function sampleEars(x, y, z) {
    const hug = headHalfWidth(Math.round(EAR.y), Math.round(EAR.z))
    if (!(hug > 0)) return null
    for (const side of [-1, 1]) {
      const cx = ax + side * (hug + 1.4)
      if (ellipsoid(x, y, z, cx + side * 0.8, EAR.y - 0.3, EAR.z + 0.6, 1, 2.2, 1.5)) return PALETTE.skinShade
      if (ellipsoid(x, y, z, cx, EAR.y, EAR.z, 2, 3.9, 2.8)) return PALETTE.ear
    }
    return null
  }

  function sampleHead(x, y, z) {
    if (!inHead(x, y, z)) return null
    const surface = frontDepth(x, y)
    const onFace = z > az && z >= surface - 2.4
    if (onFace) {
      const feature = sampleFace(x, y, z)
      if (feature) return feature
    }
    if (hairCovers(x, y, z)) return hairColour(x, y, z)
    if (onFace && facesDown(x, y)) return PALETTE.skinShade
    if (y < chinY + 1) return PALETTE.skinShade
    return PALETTE.skin
  }

  // Short hair: a few voxels stand proud of the scalp.
  function sampleHair(x, y, z) {
    if (inHead(x, y, z)) return null
    if (!hairCovers(x, y, z)) return null
    if (clump(x, y, z, 2, 3) > 0.74 && inHead(x, y - 1, z) && y > glasses.top + 6) return hairColour(x, y, z)
    return null
  }

  function sampleGlasses(x, y, z) {
    const dx0 = x - ax
    const plane = Math.round(frontDepth(Math.round(ax + lensX), Math.round(bandMid)) + 2)

    if (z === plane) {
      for (const side of [-1, 1]) {
        const dx = dx0 - side * lensX
        const dy = y - bandMid
        // Rectangular lenses with softened corners, rim one voxel thick.
        const outer = Math.max(Math.abs(dx) / lensHalfW, Math.abs(dy) / lensHalfH)
        const corner = Math.hypot(Math.max(0, Math.abs(dx) - lensHalfW + 1.6), Math.max(0, Math.abs(dy) - lensHalfH + 1.6))
        if (outer <= 1 && corner <= 1.6) {
          const inner = Math.max(Math.abs(dx) / (lensHalfW - 1.1), Math.abs(dy) / (lensHalfH - 1.1))
          if (inner > 1) return PALETTE.frame
          const out = side * dx - 1.4
          const gy = dy - 1.2
          if (Math.abs(out - gy) < 0.55 && out + gy > -0.4) return PALETTE.lens
        }
      }
      if (Math.abs(dx0) <= lensX - lensHalfW + 0.4 && Math.abs(y - (bandMid + 1)) <= 0.5) return PALETTE.frame
    }

    // Temple arms, from the rims' outer edge back to the ears.
    if (Math.abs(y - (bandMid + 0.8)) <= 0.5 && z <= plane && z >= az - 3) {
      const hug = headHalfWidth(y, z)
      const reach = Math.max(hug + 0.6, lensX + lensHalfW - 0.6)
      for (const side of [-1, 1]) {
        if (Math.abs(dx0 - side * reach) <= 0.7) return PALETTE.temple
      }
    }
    return null
  }

  // Body, hung from the chin and scaled to the head.
  const W = Math.max(12, headHalfWidth(Math.round(bandMid), az))
  const NECK = { rx: W * 0.34, rz: W * 0.3, z: az - 1 }
  const collarTop = chinY - 3
  const collarBottom = collarTop - 2.5
  const torsoTop = collarBottom
  const torsoBottom = torsoTop - W * 0.95

  function sampleBody(x, y, z) {
    const dx0 = x - ax
    const dz = z - NECK.z

    if (y >= torsoTop - 2 && y < chinY + 3 && (dx0 / NECK.rx) ** 2 + (dz / NECK.rz) ** 2 <= 1) {
      return y < chinY - 2 ? PALETTE.skinShade : PALETTE.skin
    }

    // Shirt collar: a band around the neck, parted at the front for the knot.
    if (y >= collarBottom && y <= collarTop && (dx0 / (NECK.rx + 1.4)) ** 2 + (dz / (NECK.rz + 1.6)) ** 2 <= 1) {
      if (!(Math.abs(dx0) < 1.8 && dz > 2)) return PALETTE.shirt
    }
    const pointsTop = collarBottom
    if (y < pointsTop && y >= pointsTop - 3.5 && dz >= NECK.rz - 0.5 && dz <= NECK.rz + 1.5) {
      const t = (pointsTop - y) / 3.5
      const inner = 1.8 + 2.7 * t
      const outer = NECK.rx + 0.8 - 1.5 * t
      if (Math.abs(dx0) >= inner && Math.abs(dx0) <= outer) return PALETTE.shirt
    }
    // Tie knot.
    if (y >= collarBottom - 1.5 && y <= collarTop - 0.5 && Math.abs(dx0) <= 1.7 && dz >= NECK.rz - 0.5 && dz <= NECK.rz + 1.9) {
      return PALETTE.tie
    }

    if (y < torsoTop && y >= torsoBottom) {
      const s = smoothstep((torsoTop - y) / (W * 0.55))
      const w = NECK.rx + 1.7 + (W * 1.45 - NECK.rx) * s
      const d = NECK.rz + 1.2 + W * 0.2 * s
      if ((Math.abs(dx0) / w) ** 2.6 + (Math.abs(dz) / d) ** 2.6 > 1) return null
      const front = dz >= d * 0.55
      if (front) {
        const vHalf = NECK.rx + 1.6 - (torsoTop - y) * 0.8
        if (Math.abs(dx0) <= vHalf) {
          return Math.abs(dx0) <= 1.7 + 0.08 * (torsoTop - y) ? PALETTE.tie : PALETTE.shirt
        }
        if (Math.abs(dx0) <= vHalf + 1.5) return PALETTE.lapel
      }
      if (Math.abs(dx0) > w * 0.7) return PALETTE.jacketSide
      return dz < -d * 0.3 ? PALETTE.jacketBack : PALETTE.jacket
    }
    return null
  }

  const sample = (x, y, z) =>
    sampleGlasses(x, y, z) ??
    sampleEars(x, y, z) ??
    sampleHair(x, y, z) ??
    sampleHead(x, y, z) ??
    sampleBody(x, y, z)

  const voxels = []
  const solid = new Map()
  for (let x = ax - bounds.x; x <= ax + bounds.x; x++) {
    for (let y = Math.floor(torsoBottom); y <= shape.toY + 3; y++) {
      for (let z = az - bounds.z; z <= az + bounds.z; z++) {
        const c = sample(x, y, z)
        if (c) solid.set(key(x, y, z), c)
      }
    }
  }
  for (const [k, c] of solid) {
    const [x, y, z] = k.split(',').map(Number)
    const buried =
      solid.has(key(x + 1, y, z)) &&
      solid.has(key(x - 1, y, z)) &&
      solid.has(key(x, y + 1, z)) &&
      solid.has(key(x, y - 1, z)) &&
      solid.has(key(x, y, z + 1)) &&
      solid.has(key(x, y, z - 1))
    if (!buried) voxels.push([x - ax, y, z - az, ...c])
  }
  voxels.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2])
  return { count: voxels.length, voxels }
}

const ellipsoid = (x, y, z, cx, cy, cz, rx, ry, rz) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1

function distanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const t = clamp01(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby))
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby))
}
