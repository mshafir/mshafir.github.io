/**
 * A hand-authored cartoon voxel bust.
 *
 * This is a real 3D model rather than a photo pushed into relief: every voxel
 * is a unit cube in a solid volume, so the figure holds up when it is turned
 * all the way round instead of collapsing into a slab edge-on.
 *
 * The model is defined as a signed test per cell — `sample(x, y, z)` returns a
 * colour or null — and only the *surface* is emitted, since a voxel buried
 * inside the volume can never be seen. Axes: +x right, +y up, +z toward the
 * viewer, with the origin between the eyes.
 */

/** Edit these to change who the figure looks like. */
export const PALETTE = {
  skin: [246, 198, 152],
  skinShade: [214, 158, 114],
  hair: [104, 62, 32],
  hairDark: [72, 42, 20],
  brow: [99, 64, 39],
  frame: [40, 37, 52],
  lens: [188, 222, 232],
  sclera: [244, 241, 236],
  eye: [46, 33, 26],
  mouth: [150, 78, 72],
  ear: [232, 186, 148],
  knit: [52, 64, 86],
  knitSleeve: [43, 54, 73],
  knitBack: [32, 41, 56],
  knitStripe: [74, 92, 119],
  // The ribbed neckband picks up the site's accent, so the figure belongs to
  // the page it sits on rather than floating in front of it.
  knitBand: [46, 116, 134],
}

export const BOUNDS = { x: 15, y: 20, z: 13 }

// --- shape helpers -------------------------------------------------------

const ellipsoid = (x, y, z, cx, cy, cz, rx, ry, rz) => {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  const dz = (z - cz) / rz
  return dx * dx + dy * dy + dz * dz
}

const inside = (...args) => ellipsoid(...args) <= 1

// Head. Slightly taller than wide, flattened a little front to back.
const HEAD = { cx: 0, cy: 6, cz: 0, rx: 9, ry: 9.2, rz: 8.2 }

const inHead = (x, y, z) =>
  inside(x, y, z, HEAD.cx, HEAD.cy, HEAD.cz, HEAD.rx, HEAD.ry, HEAD.rz)

/** The shell just outside the skull, where hair sits. */
const inHairShell = (x, y, z) =>
  inside(x, y, z, HEAD.cx, HEAD.cy, HEAD.cz, HEAD.rx + 1.4, HEAD.ry + 1.3, HEAD.rz + 1.4)

const EYE = { y: 7.2, x: 4.2 }
const BROW_Y = EYE.y + 3.6
const NOSE_Y = 4.2
const MOUTH_Y = 0.8
/**
 * The smirk. One corner lifts and that side runs a little longer, which is the
 * whole expression: a symmetric curve reads as a plain smile no matter how
 * much you bend it.
 */
const SMIRK_LIFT = 0.19
const SMIRK_SIDE = 1

/**
 * Where the hair starts, as a function of depth. It rises toward the front so
 * there is a forehead, and falls at the back so the hair covers the nape.
 */
const hairlineAt = (z) => 11.2 + z * 0.26

/** Half-width of the head at a given height and depth. */
function headHalfWidth(y, z) {
  const t = 1 - ((y - HEAD.cy) / HEAD.ry) ** 2 - ((z - HEAD.cz) / HEAD.rz) ** 2
  return t <= 0 ? -Infinity : HEAD.rx * Math.sqrt(t)
}

/** Front surface of the head at a given x/y, so features can sit on it. */
function faceDepth(x, y) {
  const t =
    1 -
    ((x - HEAD.cx) / HEAD.rx) ** 2 -
    ((y - HEAD.cy) / HEAD.ry) ** 2
  return t <= 0 ? -Infinity : HEAD.rz * Math.sqrt(t)
}

// --- the model -----------------------------------------------------------

function sampleHead(x, y, z) {
  if (!inHead(x, y, z)) return null
  const surface = faceDepth(x, y)
  const onFace = z > 0 && z >= surface - 1.6

  if (onFace) {
    // Mouth: a smirk, tilted up toward one side.
    const lifted = SMIRK_SIDE * x > 0
    const line = MOUTH_Y + 0.05 * x * x + SMIRK_LIFT * SMIRK_SIDE * x
    const reach = lifted ? 4.1 : 3.1
    if (Math.abs(x) <= reach && y >= line - 0.55 && y <= line + 0.55) return PALETTE.mouth

    // Eyes: a light sclera with a dark iris. Without the light ring the iris
    // sits at the same value as the frames and the whole thing reads as one
    // dark blob rather than a face wearing glasses.
    for (const side of [-1, 1]) {
      const dx = x - side * EYE.x
      const r = Math.hypot(dx, (y - EYE.y) * 1.15)
      if (r <= 0.95) return PALETTE.eye
      if (r <= 1.85) return PALETTE.sclera
    }

    // Brows: a short bar above each lens, angled slightly inward.
    for (const side of [-1, 1]) {
      const dx = x - side * (EYE.x + 0.2)
      // The brow on the smirking side rides a little higher, which is what
      // turns the mouth from a crooked smile into an expression.
      const cocked = side === SMIRK_SIDE ? 0.85 : 0
      const lift = BROW_Y + cocked - Math.abs(dx) * 0.18
      if (Math.abs(dx) <= 2.1 && y >= lift - 0.5 && y <= lift + 0.5) return PALETTE.brow
    }

    // The underside of the jaw falls into shadow.
    if (y < -1.5) return PALETTE.skinShade
  }

  // Hair covers the crown and the back, leaving a forehead and a face.
  const hairline = hairlineAt(z)
  if (y >= hairline || (z <= -2 && y >= 0.5)) {
    return z < -3 ? PALETTE.hairDark : PALETTE.hair
  }

  return PALETTE.skin
}

function sampleHair(x, y, z) {
  if (inHead(x, y, z) || !inHairShell(x, y, z)) return null
  const hairline = hairlineAt(z)
  if (y >= hairline || (z <= -2 && y >= 0.5)) {
    return z < -3 ? PALETTE.hairDark : PALETTE.hair
  }
  return null
}

function sampleEars(x, y, z) {
  for (const side of [-1, 1]) {
    if (inside(x, y, z, side * 8.4, 6.2, -0.8, 1.5, 2.9, 2.3)) return PALETTE.ear
  }
  return null
}

function sampleNose(x, y, z) {
  // A small bump on the front of the face. Previously this was built from the
  // face depth at x = 0 for every x, which produced a slab down the middle of
  // the face rather than a nose.
  const tip = faceDepth(0, NOSE_Y) + 0.6
  return inside(x, y, z, 0, NOSE_Y, tip, 1.5, 2.3, 1.7) ? PALETTE.skin : null
}

function sampleGlasses(x, y, z) {
  const lensZ = faceDepth(EYE.x, EYE.y) + 1.3
  const onPlane = z >= lensZ - 0.6 && z <= lensZ + 0.6

  if (onPlane) {
    for (const side of [-1, 1]) {
      const dx = x - side * EYE.x
      const r = Math.hypot(dx, (y - EYE.y) * 1.1)
      // A thin rim. Anything heavier swallows the eye and reads as goggles.
      if (Math.abs(r - 2.3) <= 0.55) return PALETTE.frame
      // One short diagonal glint in the upper outer corner of each lens.
      // Measured outward from the eye rather than along +x, so the two lenses
      // mirror each other; a raw dx makes the left glint run the wrong way.
      const out = side * dx - 1.2
      const gy = y - EYE.y - 1.1
      if (r < 2.2 && Math.abs(out - gy) < 0.55 && out + gy > -0.9) return PALETTE.lens
    }
    // Bridge across the nose.
    if (Math.abs(x) <= EYE.x - 2.3 && Math.abs(y - EYE.y - 0.4) <= 0.45) return PALETTE.frame
  }

  // Temples running back from the rims to the ears. They follow the head's
  // own curve; a straight bar at a fixed x floats off into space as soon as
  // the skull turns away from it.
  if (Math.abs(y - EYE.y - 0.7) <= 0.45 && z <= lensZ && z >= -2.5) {
    const hug = headHalfWidth(y, z)
    if (hug > 0) {
      for (const side of [-1, 1]) {
        if (Math.abs(x - side * (hug + 0.4)) <= 0.75) return PALETTE.frame
      }
    }
  }
  return null
}

function sampleBody(x, y, z) {
  // Neck.
  if (y >= -6 && y < -2 && x * x + z * z <= 3.1 ** 2) {
    return y < -4 ? PALETTE.skinShade : PALETTE.skin
  }

  if (y < -6 && y >= -14) {
    const spread = 1 + (-6 - y) * 0.34
    const rx = 5.6 * spread
    const rz = 4.2
    if ((x / rx) ** 2 + (z / rz) ** 2 > 1) return null

    // Ribbed neckband around the top of the garment.
    if (y >= -8.2) return PALETTE.knitBand

    // Two knit stripes across the chest, and the raglan seam where the sleeve
    // meets the body. Flat colour reads as a slab at this resolution; these
    // few lines are what make it read as a garment.
    if (z > -1) {
      // Cells are sampled at integers, so these have to land on whole rows;
      // a half-integer centre here matches nothing at all.
      if (y === -10 || y === -12) return PALETTE.knitStripe
    }
    if (Math.abs(x) > rx * 0.62) return PALETTE.knitSleeve

    return z < -1.5 ? PALETTE.knitBack : PALETTE.knit
  }
  return null
}

/** Colour at a cell, or null for empty space. Order is paint order. */
export function sample(x, y, z) {
  return (
    sampleGlasses(x, y, z) ??
    sampleNose(x, y, z) ??
    sampleEars(x, y, z) ??
    sampleHair(x, y, z) ??
    sampleHead(x, y, z) ??
    sampleBody(x, y, z)
  )
}

/**
 * Build the figure, keeping only voxels with at least one exposed face.
 *
 * Interior voxels can never be seen, and dropping them cuts the instance count
 * by roughly three quarters without changing a single pixel.
 */
export function buildFigure() {
  const solid = new Map()
  const key = (x, y, z) => `${x},${y},${z}`

  for (let x = -BOUNDS.x; x <= BOUNDS.x; x++) {
    for (let y = -BOUNDS.y; y <= BOUNDS.y; y++) {
      for (let z = -BOUNDS.z; z <= BOUNDS.z; z++) {
        const colour = sample(x, y, z)
        if (colour) solid.set(key(x, y, z), colour)
      }
    }
  }

  const voxels = []
  for (const [at, colour] of solid) {
    const [x, y, z] = at.split(',').map(Number)
    const buried =
      solid.has(key(x + 1, y, z)) &&
      solid.has(key(x - 1, y, z)) &&
      solid.has(key(x, y + 1, z)) &&
      solid.has(key(x, y - 1, z)) &&
      solid.has(key(x, y, z + 1)) &&
      solid.has(key(x, y, z - 1))
    if (!buried) voxels.push([x, y, z, ...colour])
  }

  // Stable order, so the committed artefact never churns.
  voxels.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2])
  return { count: voxels.length, voxels }
}
