/**
 * Turn a textured OBJ mesh into the site's voxel format.
 *
 * Every triangle is sampled at sub-voxel spacing, each sample lands in a grid
 * cell, and the cell's colour is the mean of the texels those samples hit. The
 * result is a one-voxel-thick shell of the scanned surface, which is exactly
 * what the renderer needs: a buried voxel can never be seen.
 *
 * Axes match the hand-authored figure: +x right, +y up, +z toward the viewer.
 * The scan's own orientation is arbitrary, so the caller supplies a yaw.
 */
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

/** Parse the subset of OBJ that photogrammetry apps emit: v, vt, f, mtllib. */
export function parseObj(text) {
  const positions = []
  const uvs = []
  const faces = []
  let mtllib = null
  for (const line of text.split('\n')) {
    if (line[0] === 'v' && line[1] === ' ') {
      const [, x, y, z] = line.trim().split(/\s+/)
      positions.push([+x, +y, +z])
    } else if (line[0] === 'v' && line[1] === 't') {
      const [, u, v] = line.trim().split(/\s+/)
      uvs.push([+u, +v])
    } else if (line[0] === 'f') {
      const corners = line.trim().split(/\s+/).slice(1)
      const parsed = corners.map((c) => {
        const [vi, ti] = c.split('/')
        return { p: +vi - 1, t: ti ? +ti - 1 : -1 }
      })
      // Fan-triangulate anything with more than three corners.
      for (let i = 1; i + 1 < parsed.length; i++) {
        faces.push([parsed[0], parsed[i], parsed[i + 1]])
      }
    } else if (line.startsWith('mtllib')) {
      mtllib = line.slice(6).trim()
    }
  }
  return { positions, uvs, faces, mtllib }
}

/** Find the diffuse texture named by an MTL file, relative to it. */
export async function textureFromMtl(mtlPath) {
  const text = await readFile(mtlPath, 'utf8')
  const match = text.match(/^\s*map_Kd\s+(.+)$/m)
  return match ? resolve(dirname(mtlPath), match[1].trim()) : null
}

const cellKey = (x, y, z) => `${x},${y},${z}`
const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]

/** Yaw about +y, then pitch about +x, then roll about +z. */
function rotate([x, y, z], yaw, pitch, roll) {
  let cy = Math.cos(yaw), sy = Math.sin(yaw)
  let x1 = x * cy + z * sy
  let z1 = -x * sy + z * cy
  let y1 = y
  const cp = Math.cos(pitch), sp = Math.sin(pitch)
  const y2 = y1 * cp - z1 * sp
  const z2 = y1 * sp + z1 * cp
  const cr = Math.cos(roll), sr = Math.sin(roll)
  const x3 = x1 * cr - y2 * sr
  const y3 = x1 * sr + y2 * cr
  return [x3, y3, z2]
}

async function loadTexture(path) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/**
 * Voxelize a mesh.
 *
 * @param mesh   parsed OBJ
 * @param texture  { data, width, height } raw RGB
 * @param options
 *   height   voxels the mesh's vertical extent maps to
 *   yaw      radians to turn the mesh about +y before sampling
 *   pitch    radians to tip it about +x (positive tips the face up)
 *   roll     radians to tilt it about +z (positive tilts the top to the left)
 *   floor    fraction [0, 1) of the vertical extent to discard from the bottom
 *   step     sample spacing along triangle edges, in voxels
 *   padding  the atlas background colour, whose texels are ignored; samples
 *            that land in the gutter between UV islands would otherwise paint
 *            grey specks along every seam
 */
export function voxelize(
  mesh,
  texture,
  { height = 60, yaw = 0, pitch = 0, roll = 0, floor = 0, step = 0.35, padding = null } = {},
) {
  const turned = mesh.positions.map((p) => rotate(p, yaw, pitch, roll))

  let minY = Infinity
  let maxY = -Infinity
  for (const [, y] of turned) {
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const scale = (height - 1) / (maxY - minY)
  const cut = minY + (maxY - minY) * floor

  // Centre x/z on the mesh's extent so the figure sits around the origin.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, y, z] of turned) {
    if (y < cut) continue
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2

  const toGrid = ([x, y, z]) => [(x - cx) * scale, (y - cut) * scale, (z - cz) * scale]

  const sums = new Map()
  const addSample = (gx, gy, gz, u, v) => {
    const key = `${Math.round(gx)},${Math.round(gy)},${Math.round(gz)}`
    const tx = Math.min(texture.width - 1, Math.max(0, Math.floor(u * texture.width)))
    const ty = Math.min(texture.height - 1, Math.max(0, Math.floor((1 - v) * texture.height)))
    const i = (ty * texture.width + tx) * 3
    let acc = sums.get(key)
    if (!acc) {
      acc = { r: 0, g: 0, b: 0, n: 0 }
      sums.set(key, acc)
    }
    if (
      padding &&
      Math.abs(texture.data[i] - padding[0]) <= 3 &&
      Math.abs(texture.data[i + 1] - padding[1]) <= 3 &&
      Math.abs(texture.data[i + 2] - padding[2]) <= 3
    ) {
      return
    }
    acc.r += texture.data[i]
    acc.g += texture.data[i + 1]
    acc.b += texture.data[i + 2]
    acc.n++
  }

  for (const [a, b, c] of mesh.faces) {
    const pa = toGrid(turned[a.p])
    const pb = toGrid(turned[b.p])
    const pc = toGrid(turned[c.p])
    if (pa[1] < 0 && pb[1] < 0 && pc[1] < 0) continue
    const ta = mesh.uvs[a.t] ?? [0, 0]
    const tb = mesh.uvs[b.t] ?? [0, 0]
    const tc = mesh.uvs[c.t] ?? [0, 0]

    // Sample count from the longest edge, so big triangles do not leave holes
    // and tiny ones do not burn time.
    const edge = Math.max(
      Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]),
      Math.hypot(pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]),
      Math.hypot(pc[0] - pb[0], pc[1] - pb[1], pc[2] - pb[2]),
    )
    const n = Math.max(1, Math.ceil(edge / step))
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n - i; j++) {
        const wa = i / n
        const wb = j / n
        const wc = 1 - wa - wb
        const gx = pa[0] * wa + pb[0] * wb + pc[0] * wc
        const gy = pa[1] * wa + pb[1] * wb + pc[1] * wc
        const gz = pa[2] * wa + pb[2] * wb + pc[2] * wc
        if (gy < -0.5) continue
        const u = ta[0] * wa + tb[0] * wb + tc[0] * wc
        const v = ta[1] * wa + tb[1] * wb + tc[1] * wc
        addSample(gx, gy, gz, u, v)
      }
    }
  }

  const voxels = []
  const blank = []
  for (const [key, acc] of sums) {
    const [x, y, z] = key.split(',').map(Number)
    if (acc.n === 0) blank.push([x, y, z])
    else voxels.push([x, y, z, Math.round(acc.r / acc.n), Math.round(acc.g / acc.n), Math.round(acc.b / acc.n)])
  }
  // Cells that only ever hit padding take the colour of their neighbours.
  if (blank.length) {
    const have = new Map(voxels.map((v) => [cellKey(v[0], v[1], v[2]), v]))
    const offsets = offsetsByDistance(3)
    for (const [x, y, z] of blank) {
      let sum = [0, 0, 0]
      let n = 0
      let found = Infinity
      for (const { dx, dy, dz, d } of offsets) {
        if (d === 0 || d > found + 0.5) continue
        const v = have.get(cellKey(x + dx, y + dy, z + dz))
        if (!v) continue
        found = Math.min(found, d)
        sum = [sum[0] + v[3], sum[1] + v[4], sum[2] + v[5]]
        n++
      }
      if (n) voxels.push([x, y, z, ...sum.map((c) => Math.round(c / n))])
    }
  }
  voxels.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2])
  return { count: voxels.length, voxels }
}

/** Load an OBJ and its texture from disk. */
export async function loadMesh(objPath) {
  const text = await readFile(objPath, 'utf8')
  const mesh = parseObj(text)
  const mtlPath = mesh.mtllib ? resolve(dirname(objPath), mesh.mtllib) : null
  const texturePath = mtlPath ? await textureFromMtl(mtlPath) : null
  if (!texturePath) throw new Error(`No diffuse texture found for ${objPath}`)
  const texture = await loadTexture(texturePath)
  return { mesh, texture }
}

// --- completion ------------------------------------------------------------


/** Integer offsets within a radius, nearest first, for neighbour searches. */
function offsetsByDistance(radius) {
  const list = []
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const d = Math.hypot(dx, dy, dz)
        if (d <= radius) list.push({ dx, dy, dz, d })
      }
    }
  }
  return list.sort((a, b) => a.d - b.d)
}

/**
 * Close the holes a phone scan leaves in a head.
 *
 * A walk-around scan reliably captures the face and sides but rarely the crown
 * or the back of the skull, so from behind you see the inside of the face. This
 * unions the scanned shell with a solid ellipsoid standing in for the cranium,
 * restricted to the region above the brow or behind the ears so it can never
 * poke through the face, then emits the exposed surface. Added voxels take the
 * colour of the nearest scanned ones, so a forehead stays skin and the back
 * stays hair without anyone having to say which is which.
 *
 * The inside is then made solid: the exterior is flood-filled from the sides
 * and top of the bounding box, treating the shell and one cell around it as
 * wall so that pinholes do not leak, and everything unreached is filled. That
 * closes every gap in the sampled surface, and the open bottom of the bust,
 * with correctly coloured voxels instead of a view of the dark inside.
 *
 * @param figure  voxelize() output
 * @param options
 *   centre, radii   the cranium ellipsoid, in voxels
 *   aboveY          fill only at or above this row ...
 *   behindZ         ... or at or behind this depth
 *   searchRadius    how far to look for a scanned colour
 */
export function completeHead(figure, { centre, radii, aboveY, behindZ, searchRadius = 10 }) {
  const [cx, cy, cz] = centre
  const [rx, ry, rz] = radii
  const shell = new Map()
  for (const [x, y, z, r, g, b] of figure.voxels) shell.set(cellKey(x, y, z), [r, g, b])

  // Where the scan has a surface, the fill must stay strictly inside it: the
  // front-most scanned depth in each x/y column, and the outermost scanned x
  // on each side in each y/z row. Otherwise a fit that is a voxel too generous
  // interleaves with the forehead and speckles it.
  const frontZ = new Map()
  const sideX = new Map()
  for (const [x, y, z] of figure.voxels) {
    const col = `${x},${y}`
    frontZ.set(col, Math.max(frontZ.get(col) ?? -Infinity, z))
    const row = `${y},${z}`
    const span = sideX.get(row) ?? { min: Infinity, max: -Infinity }
    span.min = Math.min(span.min, x)
    span.max = Math.max(span.max, x)
    sideX.set(row, span)
  }
  const insideScan = (x, y, z) => {
    const front = frontZ.get(`${x},${y}`)
    if (front !== undefined && z > front - 2) return false
    const span = sideX.get(`${y},${z}`)
    if (span && (x < span.min + 2 || x > span.max - 2) && z > behindZ) return false
    return true
  }

  const solid = new Set(shell.keys())
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
        if (y < aboveY && z > behindZ) continue
        const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2
        if (e > 1) continue
        if (!insideScan(x, y, z)) continue
        solid.add(cellKey(x, y, z))
      }
    }
  }

  sealInterior(solid, figure.voxels)

  const offsets = offsetsByDistance(searchRadius)
  const nearestColour = (x, y, z) => {
    let sum = [0, 0, 0]
    let n = 0
    let found = Infinity
    for (const { dx, dy, dz, d } of offsets) {
      if (d > found + 0.5) break
      const c = shell.get(cellKey(x + dx, y + dy, z + dz))
      if (!c) continue
      found = Math.min(found, d)
      sum = [sum[0] + c[0], sum[1] + c[1], sum[2] + c[2]]
      n++
    }
    return n ? sum.map((v) => Math.round(v / n)) : [40, 30, 25]
  }

  const voxels = []
  for (const key of solid) {
    const [x, y, z] = key.split(',').map(Number)
    const exposed = FACES.some(([dx, dy, dz]) => !solid.has(cellKey(x + dx, y + dy, z + dz)))
    if (!exposed) continue
    const colour = shell.get(key) ?? nearestColour(x, y, z)
    voxels.push([x, y, z, ...colour])
  }
  voxels.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2])
  return { count: voxels.length, voxels }
}

/** The full solid volume of a closed figure, as a set of "x,y,z" keys. */
export function solidOf(figure) {
  const solid = new Set(figure.voxels.map((v) => cellKey(v[0], v[1], v[2])))
  sealInterior(solid, figure.voxels)
  return solid
}

/** Add every cell enclosed by the shell to `solid`. See completeHead. */
function sealInterior(solid, voxels) {
  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]
  for (const v of voxels) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], v[i])
      max[i] = Math.max(max[i], v[i])
    }
  }
  min = min.map((v) => v - 2)
  max = max.map((v) => v + 2)
  const inBox = (x, y, z) =>
    x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1] && z >= min[2] && z <= max[2]

  // Walls: the shell, grown by one cell in every direction.
  const wall = new Set(solid)
  for (const key of solid) {
    const [x, y, z] = key.split(',').map(Number)
    for (const [dx, dy, dz] of FACES) wall.add(cellKey(x + dx, y + dy, z + dz))
  }

  // Flood the exterior from every face of the box except the bottom, so the
  // open underside of the bust is treated as enclosed.
  const reached = new Set()
  const queue = []
  const seed = (x, y, z) => {
    const key = cellKey(x, y, z)
    if (wall.has(key) || reached.has(key)) return
    reached.add(key)
    queue.push([x, y, z])
  }
  for (let x = min[0]; x <= max[0]; x++) {
    for (let z = min[2]; z <= max[2]; z++) seed(x, max[1], z)
    for (let y = min[1]; y <= max[1]; y++) {
      seed(x, y, min[2])
      seed(x, y, max[2])
    }
  }
  for (let y = min[1]; y <= max[1]; y++) {
    for (let z = min[2]; z <= max[2]; z++) {
      seed(min[0], y, z)
      seed(max[0], y, z)
    }
  }
  while (queue.length) {
    const [x, y, z] = queue.pop()
    for (const [dx, dy, dz] of FACES) {
      if (inBox(x + dx, y + dy, z + dz)) seed(x + dx, y + dy, z + dz)
    }
  }

  // Everything the flood did not reach is inside, except the grown wall's
  // outer skin: a cell that touches reached air is only filled when the shell
  // surrounds it on three or more faces, which makes it a hole, not surface.
  const shell = new Set(solid)
  const around = (x, y, z, set) =>
    FACES.filter(([dx, dy, dz]) => set.has(cellKey(x + dx, y + dy, z + dz))).length
  for (let x = min[0]; x <= max[0]; x++) {
    for (let y = min[1]; y <= max[1]; y++) {
      for (let z = min[2]; z <= max[2]; z++) {
        const key = cellKey(x, y, z)
        if (reached.has(key) || shell.has(key)) continue
        if (around(x, y, z, reached) > 0 && around(x, y, z, shell) < 3) continue
        solid.add(key)
      }
    }
  }
}

/**
 * Mirror the bust below a row about a vertical plane.
 *
 * A scan taken from the front captures whichever shoulder the phone happened
 * to sweep past. Reflecting what exists onto the missing side gives a symmetric
 * bust; anything wider than `halfWidth` from the plane is dropped first.
 */
export function mirrorBelow(figure, { x: cx, belowY, halfWidth }) {
  const kept = figure.voxels.filter(([x]) => Math.abs(x - cx) <= halfWidth)
  const have = new Set(kept.map(([x, y, z]) => cellKey(x, y, z)))
  const voxels = [...kept]
  for (const [x, y, z, r, g, b] of kept) {
    if (y >= belowY) continue
    const mx = 2 * cx - x
    if (have.has(cellKey(mx, y, z))) continue
    have.add(cellKey(mx, y, z))
    voxels.push([mx, y, z, r, g, b])
  }
  voxels.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2])
  return { count: voxels.length, voxels }
}

/** Shift every voxel so a chosen point lands on the origin. */
export function recentre(figure, [ox, oy, oz]) {
  const voxels = figure.voxels.map(([x, y, z, r, g, b]) => [x - ox, y - oy, z - oz, r, g, b])
  return { count: voxels.length, voxels }
}

/**
 * Lift a photo texture toward a flat cartoon palette.
 *
 * Scan textures are lit by whatever room they were made in and come out muddy
 * once averaged into voxels. A little contrast and saturation brings the skin
 * back, and the renderer's own lights do the rest.
 */
export function grade(
  figure,
  { contrast = 1, saturation = 1, brightness = 1, balance = [1, 1, 1] } = {},
) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))
  const voxels = figure.voxels.map(([x, y, z, r, g, b]) => {
    const l = 0.299 * r + 0.587 * g + 0.114 * b
    let [r2, g2, b2] = [r, g, b].map((c) => l + (c - l) * saturation)
    ;[r2, g2, b2] = [r2, g2, b2].map((c, i) => ((c - 128) * contrast + 128) * brightness * balance[i])
    return [x, y, z, clamp(r2), clamp(g2), clamp(b2)]
  })
  return { count: voxels.length, voxels }
}

/**
 * Recolour bright voxels in a zone with the zone's median dark colour.
 *
 * Two uses. Room lights leave a grey-white glare patch on the crown of a scan;
 * with a small `maxSpread` only near-grey voxels are caught, so bright skin is
 * left alone. And above the hairline, everything the scan blurred toward skin
 * should simply be hair; with no spread limit, the whole zone goes dark.
 */
export function clampHighlights(
  figure,
  { aboveY, maxLuma, maxSpread = Infinity, behindZ = -Infinity, beforeZ = Infinity },
) {
  const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b
  const spread = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b)
  const inZone = (v) => v[1] >= aboveY && v[2] >= behindZ && v[2] <= beforeZ
  const zone = figure.voxels.filter((v) => inZone(v) && luma(v.slice(3)) <= maxLuma)
  const median = (i) => {
    const sorted = zone.map((v) => v[3 + i]).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] ?? 60
  }
  const fill = [median(0), median(1), median(2)]
  const voxels = figure.voxels.map((v) => {
    const c = v.slice(3)
    const hit = inZone(v) && luma(c) > maxLuma && spread(c) <= maxSpread
    return hit ? [v[0], v[1], v[2], ...fill] : v
  })
  return { count: voxels.length, voxels }
}
