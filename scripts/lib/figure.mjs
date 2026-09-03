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
 * viewer, with the origin roughly between the eyes.
 *
 * Scale: the skull is 40 voxels tall. That is enough for a three-voxel iris
 * with a highlight, a rim one voxel thick, and teeth, which is what a face
 * needs before it reads as a particular person rather than a generic head.
 */

/** Edit these to change who the figure looks like. */
export const PALETTE = {
  skin: [240, 188, 142],
  skinMid: [218, 158, 114],
  skinShade: [206, 146, 104],
  // A close shave. Cooler than the skin, and speckled with it, so the jaw
  // reads as a grown man's rather than a boy's.
  stubble: [206, 160, 126],
  hair: [54, 35, 24],
  hairLight: [94, 62, 40],
  hairDark: [33, 21, 14],
  // The first grey at the temples.
  hairGrey: [118, 108, 100],
  brow: [44, 29, 20],
  // Translucent tan acetate. Dark frames at this size read as goggles.
  frame: [160, 130, 100],
  temple: [126, 114, 102],
  lens: [206, 228, 236],
  sclera: [246, 244, 238],
  iris: [122, 112, 52],
  pupil: [28, 22, 18],
  glint: [255, 255, 255],
  lip: [214, 140, 116],
  mouth: [110, 46, 50],
  teeth: [250, 247, 240],
  ear: [232, 178, 132],
  shirt: [248, 247, 242],
  tie: [66, 58, 100],
  jacket: [64, 66, 78],
  jacketSide: [50, 52, 62],
  jacketBack: [40, 42, 50],
  lapel: [34, 36, 44],
}

export const BOUNDS = { x: 27, y: 40, z: 23 }

// --- shape helpers -------------------------------------------------------

const ellipsoid = (x, y, z, cx, cy, cz, rx, ry, rz) => {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  const dz = (z - cz) / rz
  return dx * dx + dy * dy + dz * dz
}

const inside = (...args) => ellipsoid(...args) <= 1

const clamp01 = (t) => Math.min(1, Math.max(0, t))
const smoothstep = (t) => {
  const s = clamp01(t)
  return s * s * (3 - 2 * s)
}

/**
 * Deterministic hash in [0, 1).
 *
 * The hair is scruffed with noise, and the committed voxels.json has to be
 * reproducible, so this stands in for a random number generator: same input,
 * same mess, every build.
 */
function hash3(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Low-frequency noise over the head.
 *
 * Sampling the hash per voxel gives static; quantising the input first makes
 * the variation clump into curls a few voxels across, which is what reads as
 * untidy hair rather than noise.
 */
function clump(x, y, z, scale, seed) {
  return hash3(
    Math.floor(x / scale) + seed * 131,
    Math.floor(y / scale) - seed * 57,
    Math.floor(z / scale) + seed * 19,
  )
}

/** Noise over the head's footprint only, for the hairline. */
const clumpXZ = (x, z, scale, seed) => clump(x, 0, z, scale, seed)

// Head. Longer than it is wide, and flattened a little front to back.
const HEAD = { cx: 0, cy: 15, cz: 0, rx: 16, ry: 20, rz: 16.5 }

/**
 * How much narrower the head is at a given height.
 *
 * A bare ellipsoid gives a ball: full width right down to where it closes off,
 * so the jaw is as broad as the cheekbones and the face reads round. Squeezing
 * the lower half is what produces a jaw and a chin.
 */
function jaw(y) {
  const chin = HEAD.cy - HEAD.ry
  const cheek = HEAD.cy - 1
  const t = clamp01((y - chin) / (cheek - chin))
  return 0.77 + 0.23 * t
}

const inSkull = (x, y, z) => {
  const k = jaw(y)
  return inside(x, y, z, HEAD.cx, HEAD.cy, HEAD.cz, HEAD.rx * k, HEAD.ry, HEAD.rz * k)
}

/**
 * The chin, as its own volume.
 *
 * An ellipsoid closes off below the mouth, so on its own the skull gives a
 * profile that falls away steeply from the nose. This carries the jaw down so
 * the chin sits under the lips, a voxel or so behind them.
 *
 * The underside is cut along a straight slope from the point of the chin back
 * to the throat. Left round, the chin read as a bulb hanging off the face.
 */
const CHIN = { cy: -1, cz: 2, rx: 6.5, ry: 5.5, rz: 8.5 }
const JAW = { tipY: -6, tipZ: 10, slope: 0.45 }
const jawBottom = (z) => JAW.tipY + Math.max(0, JAW.tipZ - z) * JAW.slope
const inChin = (x, y, z) =>
  y >= jawBottom(z) && inside(x, y, z, 0, CHIN.cy, CHIN.cz, CHIN.rx, CHIN.ry, CHIN.rz)

const inHead = (x, y, z) => inSkull(x, y, z) || inChin(x, y, z)

/**
 * How far the hair stands off the skull at a cell.
 *
 * Thickness varies with 3D noise, so the outer surface is lumpy rather than a
 * helmet, and it grows with height: the crown is a mass of curls while the
 * sides are cut close.
 */
function puffAt(x, y, z) {
  const height = 0.45 + 0.55 * clamp01((y - 12) / 20)
  return (2.5 + clump(x, y, z, 4, 2) * 2) * height
}

/** The shell just outside the skull, where hair sits. */
const inHairShell = (x, y, z) => {
  const k = jaw(y)
  const puff = puffAt(x, y, z)
  return inside(
    x,
    y,
    z,
    HEAD.cx,
    HEAD.cy,
    HEAD.cz,
    HEAD.rx * k + puff,
    HEAD.ry + puff * 0.9,
    HEAD.rz * k + puff,
  )
}

const EYE = { x: 6, y: 15.5 }
/** The lenses sit a little outboard of the eyes, which is what makes them big. */
const LENS = { x: 7.4, y: EYE.y + 0.3, rx: 4.8, ry: 3.9 }
const BROW = { x: 6.5, y: 21, half: 4 }
const NOSE_Y = 8.2
const MOUTH = { y: 3.2, half: 6.5 }
const EAR = { x: 17, y: 13.5, z: -1.2 }

/**
 * Where the hair starts. It rises toward the front so there is a forehead, and
 * falls at the back so the hair covers the nape. It also dips a little at the
 * temples, and the noise term ragged-edges the whole line.
 */
function hairlineAt(x, z) {
  const ragged = (clumpXZ(x, z, 3, 1) - 0.5) * 2
  // The temples recede a little: a hairline that runs dead straight across is
  // a teenager's.
  const recede = z > 5 ? Math.max(0, Math.abs(x) - 8) * 0.55 : 0
  const base = 24 + z * 0.3 - 0.02 * x * x + ragged + recede
  // Over the face itself, keep a floor: a ragged dip that falls this far is not
  // a fringe, it is hair growing across the eyebrows.
  return z > 4 && Math.abs(x) < 12 ? Math.max(base, 27) : base
}

/**
 * Is a cell on or around the skull under hair?
 *
 * Three regions: everything above the hairline, the back of the head down to
 * the nape, and sideburns that run down in front of the ears and taper to a
 * point.
 */
function hairCovers(x, y, z) {
  if (y >= hairlineAt(x, z)) return true
  if (z <= -5 && y >= 1) return true
  const sideburnFoot = 10 + Math.max(0, z + 3) * 0.6
  return Math.abs(x) >= 13 && z <= 5 && y >= sideburnFoot && y <= 26
}

/** True where a curl stands proud of the shell. */
const isTuft = (x, y, z) => clump(x, y, z, 3, 3) > 0.8

/**
 * Curls catch the light on top and fall into shadow underneath and behind.
 * Flat colour is what made the old hair read as a helmet as much as its shape.
 */
function hairColour(x, y, z) {
  if (z < -8 || y < 9) return PALETTE.hairDark
  if (Math.abs(x) >= 12 && y >= 15 && y <= 24 && z > -3 && z < 8 && hash3(x, y, z) > 0.84) {
    return PALETTE.hairGrey
  }
  const n = clump(x, y, z, 3, 5)
  if (n > 0.78 && y > 20 && z > -2) return PALETTE.hairLight
  if (n < 0.18) return PALETTE.hairDark
  return PALETTE.hair
}

/** Half-width of the head at a given height and depth. */
function headHalfWidth(y, z) {
  const k = jaw(y)
  const t = 1 - ((y - HEAD.cy) / HEAD.ry) ** 2 - ((z - HEAD.cz) / (HEAD.rz * k)) ** 2
  return t <= 0 ? -Infinity : HEAD.rx * k * Math.sqrt(t)
}

/** Front surface of the head at a given x/y, so features can sit on it. */
function faceDepth(x, y) {
  const k = jaw(y)
  const t = 1 - ((x - HEAD.cx) / (HEAD.rx * k)) ** 2 - ((y - HEAD.cy) / HEAD.ry) ** 2
  const skull = t <= 0 ? -Infinity : HEAD.rz * k * Math.sqrt(t)
  const c = 1 - (x / CHIN.rx) ** 2 - ((y - CHIN.cy) / CHIN.ry) ** 2
  const chin = c <= 0 ? -Infinity : CHIN.cz + CHIN.rz * Math.sqrt(c)
  return Math.max(skull, chin)
}

/** Distance from a point to a line segment, in the x/y plane. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const t = clamp01(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby))
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby))
}

// --- the model -----------------------------------------------------------

function sampleFace(x, y, z) {
  // Mouth: a broad smile, open only a little. One row of teeth shows across
  // the middle with dark beneath and at the corners. A gaping mouth full of
  // white reads as a grimace.
  const lower = MOUTH.y - 1 + 0.06 * x * x
  const upper = MOUTH.y + 0.9 + 0.015 * x * x
  if (Math.abs(x) <= MOUTH.half) {
    if (y > lower && y < upper) {
      return y >= lower + 0.9 && Math.abs(x) <= 4 ? PALETTE.teeth : PALETTE.mouth
    }
    if ((y >= lower - 0.9 && y <= lower) || (y >= upper && y <= upper + 0.8)) return PALETTE.lip
  }

  // Eyes: a white with a three-voxel hazel iris, a dark pupil and one bright
  // highlight in the upper outer corner. Measured outward from each eye rather
  // than along +x so the two mirror.
  for (const side of [-1, 1]) {
    const dx = x - side * EYE.x
    const dy = y - EYE.y
    const out = side * dx
    if (Math.abs(out - 1) < 0.6 && Math.abs(dy - 1) < 0.6) return PALETTE.glint
    if (Math.hypot(dx, dy) <= 0.75) return PALETTE.pupil
    if ((dx / 1.6) ** 2 + (dy / 1.45) ** 2 <= 1) return PALETTE.iris
    // Whites kept modest: eyes that are huge relative to the face read young.
    if ((dx / 2.7) ** 2 + (dy / 1.7) ** 2 <= 1) return PALETTE.sclera
  }

  // Brows: thick and dark, only gently arched and sitting fairly low. High,
  // round brows read as wide-eyed surprise, which is a young face.
  for (const side of [-1, 1]) {
    const dx = x - side * BROW.x
    if (Math.abs(dx) > BROW.half) continue
    const arch = BROW.y + 0.5 - 0.04 * dx * dx
    const half = 1.05 - 0.12 * Math.max(0, Math.abs(dx) - 2)
    if (Math.abs(y - arch) <= half) return PALETTE.brow
  }

  // A shadow under the nose. Without it the nose, being skin on skin, vanishes
  // entirely from the front.
  if (Math.abs(x) <= 2.2 && y >= NOSE_Y - 3.2 && y <= NOSE_Y - 2.2) return PALETTE.skinShade

  // A faint shadow under each eye, and hollows under the cheekbones. Both are
  // structure a young face has not grown into yet.
  for (const side of [-1, 1]) {
    const dx = x - side * EYE.x
    if (Math.abs(dx) <= 2 && y >= EYE.y - 3.2 && y <= EYE.y - 2.4) return PALETTE.skinMid
    if (inside(x, y, z, side * 10.5, 6.5, z, 3.2, 1.3, 1)) return PALETTE.skinMid
  }

  // Smile lines from the nose down past the corners of the mouth. Nothing ages
  // a smooth face like a crease beside it.
  for (const side of [-1, 1]) {
    const fold = distanceToSegment(
      x, y,
      side * 3, NOSE_Y - 1.5,
      side * (MOUTH.half + 1.2), MOUTH.y - 0.5,
    )
    if (fold <= 0.55) return PALETTE.skinMid
  }

  // Beard shadow over the jaw, chin and upper lip, speckled rather than solid
  // so it reads as a close shave and not a painted-on goatee.
  const belowNose = y <= NOSE_Y - 3.5
  const jawline = y <= MOUTH.y - 3 || Math.abs(x) >= MOUTH.half + 1.6
  if (belowNose && (jawline || y >= MOUTH.y + 1.8) && hash3(x, y, z) > 0.42) {
    return PALETTE.stubble
  }

  // The underside of the jaw falls into shadow.
  if (y < jawBottom(z) + 1.2) return PALETTE.skinShade
  return null
}

function sampleHead(x, y, z) {
  if (!inHead(x, y, z)) return null
  const surface = faceDepth(x, y)
  const onFace = z > 0 && z >= surface - 2.4

  if (onFace) {
    const feature = sampleFace(x, y, z)
    if (feature) return feature
  }

  if (hairCovers(x, y, z)) return hairColour(x, y, z)
  return PALETTE.skin
}

function sampleHair(x, y, z) {
  if (inHead(x, y, z)) return null
  if (!hairCovers(x, y, z)) return null

  // The sideburns lie flat against the skull. Left to puff like the crown they
  // bury the ears.
  if (Math.abs(x) >= 12 && y < 18 && z > -7) return null

  if (inHairShell(x, y, z)) return hairColour(x, y, z)

  // Tufts: a few curls stand one voxel proud of the shell, so the crown has a
  // broken outline instead of one clean dome. The tuft must rest directly on
  // hair — tested against the volume at large it spawns detached slivers
  // floating beside the head.
  if (isTuft(x, y, z) && inHairShell(x, y - 1, z)) return hairColour(x, y, z)
  return null
}

function sampleEars(x, y, z) {
  for (const side of [-1, 1]) {
    // A darker hollow inside the outer rim, so the ear is not a flat paddle.
    if (inside(x, y, z, side * (EAR.x + 0.7), EAR.y - 0.3, EAR.z + 0.6, 1, 2.2, 1.5)) {
      return PALETTE.skinShade
    }
    if (inside(x, y, z, side * EAR.x, EAR.y, EAR.z, 1.8, 3.9, 2.8)) return PALETTE.ear
  }
  return null
}

function sampleNose(x, y, z) {
  // A rounded tip standing off the face, shaded underneath, with a narrower
  // bridge running up toward the glasses.
  const tip = faceDepth(0, NOSE_Y) + 1.6
  if (inside(x, y, z, 0, NOSE_Y, tip, 2.5, 2.7, 2.9)) {
    if (y < NOSE_Y - 1.2) return PALETTE.skinShade
    // Only the very front catches full light; the flanks turn away from it.
    return Math.abs(x) > 1 || z < tip + 0.6 ? PALETTE.skinMid : PALETTE.skin
  }
  const ridgeY = NOSE_Y + 4
  const ridge = faceDepth(0, ridgeY) + 0.4
  return inside(x, y, z, 0, ridgeY, ridge, 1.3, 4.5, 1.6) ? PALETTE.skin : null
}

function sampleGlasses(x, y, z) {
  const plane = Math.round(faceDepth(LENS.x, LENS.y) + 2.2)

  if (z === plane) {
    for (const side of [-1, 1]) {
      const dx = x - side * LENS.x
      const dy = y - LENS.y
      const outer = (dx / LENS.rx) ** 2 + (dy / LENS.ry) ** 2
      const inner = (dx / (LENS.rx - 1.1)) ** 2 + (dy / (LENS.ry - 1.1)) ** 2
      // A rim one voxel thick. Anything heavier swallows the eye.
      if (outer <= 1 && inner > 1) return PALETTE.frame
      // One short diagonal glint in the upper outer corner of each lens.
      // Measured outward from the eye rather than along +x, so the two lenses
      // mirror each other; a raw dx makes the left glint run the wrong way.
      const out = side * dx - 1.4
      const gy = dy - 1.4
      if (inner <= 1 && Math.abs(out - gy) < 0.55 && out + gy > -0.4) return PALETTE.lens
    }
    // Bridge across the nose.
    if (Math.abs(x) <= LENS.x - LENS.rx + 0.4 && Math.abs(y - LENS.y - 1.2) <= 0.5) {
      return PALETTE.frame
    }
  }

  // Temples running back from the rims to the ears. They leave the outer edge
  // of each rim straight back, then hug the head's own curve once the skull
  // widens past them; a bar at a fixed x floats off into space as soon as the
  // head turns away from it.
  if (Math.abs(y - LENS.y - 1) <= 0.5 && z <= plane && z >= EAR.z) {
    const hug = headHalfWidth(y, z)
    const reach = Math.max(hug + 0.6, LENS.x + LENS.rx - 0.6)
    for (const side of [-1, 1]) {
      if (Math.abs(x - side * reach) <= 0.7) return PALETTE.temple
    }
  }
  return null
}

function sampleBody(x, y, z) {
  const NECK = { rx: 5.4, rz: 4.8, z: -1.5 }
  const TORSO_Z = -1.5

  // Neck. Narrower than the jaw, so the chin overhangs it.
  if (y >= -12 && y < -3 && (x / NECK.rx) ** 2 + ((z - NECK.z) / NECK.rz) ** 2 <= 1) {
    return y < -6.5 ? PALETTE.skinShade : PALETTE.skin
  }

  // Shirt collar. A band around the neck, parted at the front where the tie
  // knot sits, with two points folding down over the chest below it.
  if (y >= -9.5 && y <= -7 && (x / 6.2) ** 2 + ((z - NECK.z) / 6) ** 2 <= 1) {
    if (!(Math.abs(x) < 1.8 && z > NECK.z + 2)) return PALETTE.shirt
  }
  if (y < -9.5 && y >= -13 && z >= 4 && z <= 6) {
    // Each point is a triangle: wide where it leaves the band, tapering to a
    // tip that sits over the lapel a little way down the chest.
    const t = (-9.5 - y) / 3.5
    const inner = 1.8 + 2.7 * t
    const outer = 6 - 1.5 * t
    if (Math.abs(x) >= inner && Math.abs(x) <= outer) return PALETTE.shirt
  }

  // Tie knot, filling the part in the collar.
  if (y >= -11 && y <= -7.5 && Math.abs(x) <= 1.7 && z >= 4 && z <= 6.4) return PALETTE.tie

  // Torso: shoulders that widen quickly below the collar, then fall straight.
  // A rounded-box cross-section reads as a jacket where an ellipse reads as a
  // barrel.
  if (y < -9.5 && y >= -25) {
    const s = smoothstep((-9.5 - y) / 10)
    const w = 6.5 + 18.5 * s
    const d = 6 + 3.5 * s
    const dz = z - TORSO_Z
    if ((Math.abs(x) / w) ** 2.6 + (Math.abs(dz) / d) ** 2.6 > 1) return null

    const front = dz >= d * 0.55
    if (front) {
      // The shirt shows in a V between the lapels, with the tie down the middle.
      const vHalf = 7 - (-9.5 - y) * 0.8
      if (Math.abs(x) <= vHalf) {
        return Math.abs(x) <= 1.7 + 0.08 * (-9.5 - y) ? PALETTE.tie : PALETTE.shirt
      }
      if (Math.abs(x) <= vHalf + 1.5) return PALETTE.lapel
    }
    if (Math.abs(x) > w * 0.7) return PALETTE.jacketSide
    return dz < -d * 0.3 ? PALETTE.jacketBack : PALETTE.jacket
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
 * Face and edge adjacency (18-connectivity), used to decide what counts as
 * attached.
 *
 * Face-only is too strict for this model: a thin ring like a lens rim steps
 * diagonally across the lattice, so it breaks into arcs that each look like
 * litter and get culled. Two cubes sharing an edge plainly read as joined.
 * Corner-only touching is still excluded — that looks like a floating speck.
 */
const NEIGHBOURS = []
for (let dx = -1; dx <= 1; dx++) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dz = -1; dz <= 1; dz++) {
      const steps = Math.abs(dx) + Math.abs(dy) + Math.abs(dz)
      if (steps === 1 || steps === 2) NEIGHBOURS.push([dx, dy, dz])
    }
  }
}

/**
 * Drop everything not attached to the main mass.
 *
 * The hair noise can strand a clump of a few cells beside the head, which
 * renders as a sliver floating in mid-air. Rather than tuning the noise until
 * that stops happening by luck, the builder guarantees one connected piece.
 */
function largestComponent(solid, key) {
  const seen = new Set()
  let best = null

  for (const start of solid.keys()) {
    if (seen.has(start)) continue
    const component = []
    const queue = [start]
    seen.add(start)
    while (queue.length) {
      const at = queue.pop()
      component.push(at)
      const [x, y, z] = at.split(',').map(Number)
      for (const [dx, dy, dz] of NEIGHBOURS) {
        const next = key(x + dx, y + dy, z + dz)
        if (solid.has(next) && !seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    if (!best || component.length > best.length) best = component
  }

  if (!best) return solid
  const kept = new Map()
  for (const at of best) kept.set(at, solid.get(at))
  return kept
}

/**
 * Build the figure, keeping only voxels with at least one exposed face.
 *
 * Interior voxels can never be seen, and dropping them cuts the instance count
 * by roughly two thirds without changing a single pixel.
 */
const cellKey = (x, y, z) => `${x},${y},${z}`

/** The filled volume, as one connected mass. */
export function buildSolid() {
  const raw = new Map()
  for (let x = -BOUNDS.x; x <= BOUNDS.x; x++) {
    for (let y = -BOUNDS.y; y <= BOUNDS.y; y++) {
      for (let z = -BOUNDS.z; z <= BOUNDS.z; z++) {
        const colour = sample(x, y, z)
        if (colour) raw.set(cellKey(x, y, z), colour)
      }
    }
  }
  return largestComponent(raw, cellKey)
}

export function buildFigure() {
  const key = cellKey
  const solid = buildSolid()
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
