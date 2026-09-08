import { describe, it, expect } from 'vitest'
import { buildCaricature, carve, measure, shapeFrom, PALETTE } from './caricature.mjs'

/**
 * A synthetic "scan": a sphere of radius 12 about (0, 20, 0), cut flat at
 * y = 10 for a jaw, with a nose bump on the front at y = 20, a dark band of
 * "glasses" texels across the front at y = 24..26, dark "hair" over the top,
 * and a thin neck cylinder below.
 */
function synthetic() {
  const solid = new Set()
  const surface = []
  const add = (x, y, z) => solid.add(`${x},${y},${z}`)
  for (let x = -14; x <= 14; x++) {
    for (let y = 4; y <= 34; y++) {
      for (let z = -14; z <= 16; z++) {
        const inSphere = y >= 10 && x * x + (y - 20) ** 2 + z * z <= 144
        const inNose = (x / 2) ** 2 + ((y - 20) / 2.5) ** 2 + ((z - 12) / 3) ** 2 <= 1
        const inNeck = y < 12 && x * x + z * z <= 9
        if (inSphere || inNose || inNeck) add(x, y, z)
      }
    }
  }
  for (const k of solid) {
    const [x, y, z] = k.split(',').map(Number)
    const outside = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(
      ([dx, dy, dz]) => !solid.has(`${x + dx},${y + dy},${z + dz}`),
    )
    if (!outside) continue
    let colour = [220, 170, 130]
    if (y >= 24 && y <= 26 && z > 6) colour = [30, 30, 30]
    if (y >= 29) colour = [50, 40, 30]
    surface.push([x, y, z, ...colour])
  }
  return { solid, surface }
}

const { solid, surface } = synthetic()
const m = measure(solid, surface, { axis: { x: 0, z: 0 } })

describe('measure', () => {
  it('finds the nose tip as the most forward point of the midline', () => {
    expect(m.noseY).toBe(20)
    expect(m.noseZ).toBeGreaterThan(12)
  })

  it('finds the chin where the profile steps back onto the neck', () => {
    expect(m.chinY).toBe(10)
  })

  it('reads the glasses band off the dark texels', () => {
    expect(m.glasses.bottom).toBe(24)
    expect(m.glasses.top).toBe(26)
    expect(m.glasses.halfWidth).toBeGreaterThan(6)
  })

  it('puts the mouth between chin and nose', () => {
    expect(m.mouthY).toBeGreaterThan(m.chinY)
    expect(m.mouthY).toBeLessThan(m.noseY)
  })
})

describe('carve', () => {
  const data = carve(solid, surface, m, { fromY: m.chinY, toY: m.topY, exaggerate: 1 })
  const shape = shapeFrom(data, m.axis)

  it('is plain data that survives a round trip through JSON', () => {
    const copy = shapeFrom(JSON.parse(JSON.stringify(data)), m.axis)
    expect(copy.radiusAt(20, 0, 12)).toBe(shape.radiusAt(20, 0, 12))
    expect(data.radius).toHaveLength(m.topY - m.chinY + 1)
    expect(data.radius[0]).toHaveLength(data.bins)
  })

  it('is symmetric about the axis plane', () => {
    for (const y of [15, 20, 25, 30]) {
      for (const [x, z] of [[5, 5], [8, -3], [3, 10]]) {
        expect(shape.radiusAt(y, x, z)).toBeCloseTo(shape.radiusAt(y, -x, z), 6)
      }
    }
  })

  it('keeps the nose while smoothing', () => {
    expect(shape.radiusAt(20, 0, 12)).toBeGreaterThan(shape.radiusAt(20, 0, -12) + 1)
  })

  it('reports hair where the texture was dark and none on the face', () => {
    expect(shape.hairAt(31, 0, -3)).toBeGreaterThan(0.5)
    expect(shape.hairAt(20, 0, 12)).toBeLessThan(0.2)
  })

  it('exaggerates away from the row mean', () => {
    const bold = shapeFrom(carve(solid, surface, m, { fromY: m.chinY, toY: m.topY, exaggerate: 1.5 }), m.axis)
    expect(bold.radiusAt(20, 0, 12)).toBeGreaterThan(shape.radiusAt(20, 0, 12))
  })
})

describe('buildCaricature', () => {
  const shape = shapeFrom(carve(solid, surface, m, { fromY: m.chinY, toY: m.topY }), m.axis)
  const figure = buildCaricature(m, shape, { bounds: { x: 24, z: 24 } })
  const colourKey = (c) => c.join(',')
  const used = new Set(figure.voxels.map((v) => colourKey(v.slice(3))))
  const ofColour = (colour) => figure.voxels.filter((v) => colourKey(v.slice(3)) === colourKey(colour))

  it('emits a surface of six-number integer tuples', () => {
    expect(figure.count).toBeGreaterThan(1000)
    for (const v of figure.voxels) {
      expect(v).toHaveLength(6)
      for (const n of v) expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('draws the recognisable parts', () => {
    for (const part of ['skin', 'hair', 'frame', 'iris', 'pupil', 'sclera', 'brow', 'teeth', 'ear', 'shirt', 'tie', 'jacket']) {
      expect(used.has(colourKey(PALETTE[part])), `${part} missing`).toBe(true)
    }
  })

  it('mirrors the drawn features exactly', () => {
    for (const part of ['frame', 'iris', 'pupil', 'sclera', 'brow', 'teeth', 'ear']) {
      const placed = new Set(ofColour(PALETTE[part]).map((v) => `${v[0]},${v[1]},${v[2]}`))
      for (const at of placed) {
        const [x, y, z] = at.split(',').map(Number)
        expect(placed.has(`${-x},${y},${z}`), `${part} has no mirror at ${at}`).toBe(true)
      }
    }
  })

  it('puts the glasses in the measured band, in front of the eyes', () => {
    const frames = ofColour(PALETTE.frame)
    const ys = frames.map((v) => v[1])
    expect(Math.min(...ys)).toBeLessThanOrEqual(m.glasses.bottom)
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(m.glasses.top)
    const depth = (colour) => Math.max(...ofColour(colour).map((v) => v[2]))
    expect(depth(PALETTE.frame)).toBeGreaterThan(depth(PALETTE.pupil))
  })

  it('keeps hair off the face', () => {
    const hairs = new Set(['hair', 'hairDark', 'hairLight', 'hairGrey'].map((p) => colourKey(PALETTE[p])))
    for (const v of figure.voxels) {
      if (!hairs.has(colourKey(v.slice(3)))) continue
      if (v[2] > 4) expect(v[1]).toBeGreaterThan(m.glasses.top)
    }
  })
})
