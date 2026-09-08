import { describe, it, expect } from 'vitest'
import { completeHead, grade, mirrorBelow, parseObj, voxelize } from './voxelize.mjs'

// A 4x4x4 cube from (0,0,0) to (4,4,4), every face textured: the left half of
// the atlas is red, the right half blue, and the top rows are the pad grey.
const CUBE = `
mtllib cube.mtl
v 0 0 0
v 4 0 0
v 4 4 0
v 0 4 0
v 0 0 4
v 4 0 4
v 4 4 4
v 0 4 4
vt 0.25 0.5
vt 0.75 0.5
f 1/1 3/1 2/1
f 1/1 4/1 3/1
f 5/2 6/2 7/2
f 5/2 7/2 8/2
f 1/1 2/1 6/1
f 1/1 6/1 5/1
f 2/2 3/2 7/2
f 2/2 7/2 6/2
f 3/1 4/1 8/1
f 3/1 8/1 7/1
f 4/2 1/2 5/2
f 4/2 5/2 8/2
`

const texture = {
  width: 4,
  height: 4,
  data: Buffer.from(
    Array.from({ length: 16 }, (_, i) => {
      const x = i % 4
      const y = Math.floor(i / 4)
      if (y === 0) return [76, 76, 76]
      return x < 2 ? [200, 20, 20] : [20, 20, 200]
    }).flat(),
  ),
}

const key = (v) => `${v[0]},${v[1]},${v[2]}`

describe('parseObj', () => {
  it('reads positions, uvs, faces and the material library', () => {
    const mesh = parseObj(CUBE)
    expect(mesh.positions).toHaveLength(8)
    expect(mesh.uvs).toHaveLength(2)
    expect(mesh.faces).toHaveLength(12)
    expect(mesh.mtllib).toBe('cube.mtl')
    expect(mesh.faces[0][0]).toEqual({ p: 0, t: 0 })
  })

  it('fan-triangulates quads', () => {
    const mesh = parseObj('v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3 4\n')
    expect(mesh.faces).toHaveLength(2)
  })
})

describe('voxelize', () => {
  const mesh = parseObj(CUBE)
  const figure = voxelize(mesh, texture, { height: 9 })

  it('emits a hollow shell of the mesh surface', () => {
    const cells = new Set(figure.voxels.map(key))
    // Height 9 maps the 4-unit cube onto 8 voxel steps; the middle is empty.
    expect(cells.has('0,4,0')).toBe(false)
    expect(figure.count).toBeGreaterThan(300)
    // Every emitted voxel has at least one empty face neighbour.
    for (const [x, y, z] of figure.voxels) {
      const open = [
        [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
      ].some(([dx, dy, dz]) => !cells.has(`${x + dx},${y + dy},${z + dz}`))
      expect(open).toBe(true)
    }
  })

  // The middle of a face, away from the edges where two faces' samples mix.
  const middleOf = (voxels, axis, pick) => {
    const values = voxels.map((v) => v[axis])
    const edge = pick(...values)
    return voxels.filter((v) => v[axis] === edge && Math.abs(v[0]) <= 1 && Math.abs(v[1] - 4) <= 1)
  }

  it('paints each face with the texel its uvs point at', () => {
    const front = middleOf(figure.voxels, 2, Math.max)
    const back = middleOf(figure.voxels, 2, Math.min)
    expect(front.length).toBeGreaterThan(0)
    for (const v of front) expect(v.slice(3)).toEqual([20, 20, 200])
    for (const v of back) expect(v.slice(3)).toEqual([200, 20, 20])
  })

  it('ignores atlas padding and borrows a neighbour colour instead', () => {
    // Point every uv at the grey pad row: nothing should come out grey.
    const padded = parseObj(CUBE.replace('vt 0.25 0.5', 'vt 0.25 0.9').replace('vt 0.75 0.5', 'vt 0.75 0.9'))
    const plain = voxelize(padded, texture, { height: 9 })
    expect(plain.voxels.some((v) => v[3] === 76)).toBe(true)
    const cleaned = voxelize(padded, texture, { height: 9, padding: [76, 76, 76] })
    // With every sample discarded there is nothing to borrow from.
    expect(cleaned.count).toBe(0)
  })

  it('turns the mesh by the given yaw', () => {
    const quarter = voxelize(mesh, texture, { height: 9, yaw: Math.PI / 2 })
    const maxX = Math.max(...quarter.voxels.map((w) => w[0]))
    const right = quarter.voxels.filter(
      (v) => v[0] === maxX && Math.abs(v[2]) <= 1 && Math.abs(v[1] - 4) <= 1,
    )
    // The blue +z face has swung round to +x.
    expect(right.length).toBeGreaterThan(0)
    for (const v of right) expect(v.slice(3)).toEqual([20, 20, 200])
  })
})

describe('mirrorBelow', () => {
  it('reflects voxels on one side onto the other below a row', () => {
    const figure = { count: 2, voxels: [[3, 0, 0, 1, 2, 3], [3, 5, 0, 4, 5, 6]] }
    const out = mirrorBelow(figure, { x: 0, belowY: 2, halfWidth: 10 })
    const cells = new Set(out.voxels.map(key))
    expect(cells.has('-3,0,0')).toBe(true)
    expect(cells.has('-3,5,0')).toBe(false)
  })

  it('drops anything wider than the half width', () => {
    const figure = { count: 1, voxels: [[30, 0, 0, 1, 2, 3]] }
    expect(mirrorBelow(figure, { x: 0, belowY: 2, halfWidth: 10 }).count).toBe(0)
  })
})

describe('completeHead', () => {
  const mesh = parseObj(CUBE)
  const shell = voxelize(mesh, texture, { height: 9 })

  it('emits only the outer surface once the inside is sealed', () => {
    const out = completeHead(shell, {
      centre: [0, 4, 0],
      radii: [1, 1, 1],
      aboveY: 100,
      behindZ: -100,
    })
    const cells = new Set(out.voxels.map(key))
    const xs = out.voxels.map((v) => v[0])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    // Nothing strictly inside the shell survives.
    for (const [x, y, z] of out.voxels) {
      const inner =
        x > minX && x < maxX && y > 0 && y < 8 && z > Math.min(...out.voxels.map((v) => v[2])) &&
        z < Math.max(...out.voxels.map((v) => v[2]))
      expect(inner, `${x},${y},${z}`).toBe(false)
    }
    expect(cells.size).toBe(out.count)
  })

  it('fills holes with the nearest scanned colour', () => {
    // Knock a hole in the front face, then complete: the hole is filled blue.
    const front = Math.max(...shell.voxels.map((v) => v[2]))
    const holed = { ...shell, voxels: shell.voxels.filter((v) => !(v[2] === front && v[0] === 0 && v[1] === 4)) }
    const out = completeHead(holed, { centre: [0, 4, 0], radii: [1, 1, 1], aboveY: 100, behindZ: -100 })
    const patch = out.voxels.find((v) => v[2] === front && v[0] === 0 && v[1] === 4)
    expect(patch).toBeDefined()
    expect(patch.slice(3)).toEqual([20, 20, 200])
  })

  it('adds the cranium ellipsoid where the scan has nothing', () => {
    const out = completeHead(shell, {
      centre: [0, 12, 0],
      radii: [2, 2, 2],
      aboveY: 10,
      behindZ: -100,
    })
    expect(out.voxels.some((v) => v[1] >= 12)).toBe(true)
  })
})

describe('grade', () => {
  it('leaves colours alone at neutral settings and clamps otherwise', () => {
    const figure = { count: 1, voxels: [[0, 0, 0, 100, 150, 250]] }
    expect(grade(figure).voxels[0].slice(3)).toEqual([100, 150, 250])
    const hot = grade(figure, { brightness: 2 }).voxels[0].slice(3)
    expect(Math.max(...hot)).toBe(255)
  })
})
