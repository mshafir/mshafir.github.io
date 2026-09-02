import { describe, it, expect } from 'vitest'
import { voxelize } from './voxelize.mjs'

/**
 * A synthetic RGB image: a green background with a solid red square centered
 * in it. The voxelizer must drop the green and keep the red.
 */
function makeFixture(width, height, squareSize) {
  const data = new Uint8Array(width * height * 3)
  const x0 = Math.floor((width - squareSize) / 2)
  const y0 = Math.floor((height - squareSize) / 2)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      const inSquare = x >= x0 && x < x0 + squareSize && y >= y0 && y < y0 + squareSize
      if (inSquare) {
        data[i] = 200
        data[i + 1] = 40
        data[i + 2] = 40 // red subject
      } else {
        data[i] = 40
        data[i + 1] = 160
        data[i + 2] = 60 // green bokeh
      }
    }
  }
  return { data, width, height }
}

describe('voxelize', () => {
  const size = 32

  it('drops the green background and keeps the subject', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    // A 64px square in a 128px image at grid size 32 is a 16x16 block of cells.
    expect(result.count).toBe(16 * 16)
    expect(result.size).toBe(size)
  })

  it('keeps only subject-colored voxels', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    for (const [, , , , r, g, b] of result.voxels) {
      expect(r).toBeGreaterThan(g)
      expect(r).toBeGreaterThan(b)
    }
  })

  it('centers coordinates on the origin', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    const xs = result.voxels.map((v) => v[0])
    const ys = result.voxels.map((v) => v[1])
    expect(Math.abs(Math.min(...xs) + Math.max(...xs))).toBeLessThanOrEqual(1)
    expect(Math.abs(Math.min(...ys) + Math.max(...ys))).toBeLessThanOrEqual(1)
  })

  it('gives every voxel a back surface behind its front surface', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    for (const [, , front, back] of result.voxels) {
      expect(back).toBeLessThan(front)
    }
  })

  it('assigns depth so central cells sit forward of edge cells', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    const byDistance = [...result.voxels].sort(
      (a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]),
    )
    expect(byDistance[0][2]).toBeGreaterThan(byDistance[byDistance.length - 1][2])
  })

  it('emits integer tuples of exactly seven numbers', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    for (const v of result.voxels) {
      expect(v).toHaveLength(7)
      for (const n of v) expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('posterises the subject to at most paletteSize flat colours', () => {
    // A gradient subject: without quantisation this would be ~16 distinct
    // colours per row, which is exactly the photo-real look we do not want.
    const width = 128
    const height = 128
    const data = new Uint8Array(width * height * 3)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3
        const inSquare = x >= 32 && x < 96 && y >= 32 && y < 96
        if (inSquare) {
          data[i] = 60 + x
          data[i + 1] = 20
          data[i + 2] = 20
        } else {
          data[i] = 40
          data[i + 1] = 160
          data[i + 2] = 60
        }
      }
    }
    const result = voxelize({ data, width, height }, { size, paletteSize: 4 })
    const distinct = new Set(result.voxels.map((v) => `${v[4]},${v[5]},${v[6]}`))
    expect(distinct.size).toBeGreaterThan(1)
    expect(distinct.size).toBeLessThanOrEqual(4)
  })

  it('terraces relief into at most reliefSteps levels', () => {
    const width = 128
    const height = 128
    const data = new Uint8Array(width * height * 3)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3
        const inSquare = x >= 32 && x < 96 && y >= 32 && y < 96
        if (inSquare) {
          // A smooth brightness ramp: unstepped, this would give many depths.
          data[i] = 40 + x
          data[i + 1] = 30 + x
          data[i + 2] = 30
        } else {
          data[i] = 40
          data[i + 1] = 160
          data[i + 2] = 60
        }
      }
    }
    // Flatten the dome so the only remaining depth is the relief itself.
    const result = voxelize({ data, width, height }, { size, domeDepth: 0, reliefSteps: 3 })
    const depths = new Set(result.voxels.map((v) => v[2]))
    expect(depths.size).toBeGreaterThan(1)
    expect(depths.size).toBeLessThanOrEqual(3)
  })

  it('keeps relief independent of the colour palette', () => {
    const width = 128
    const height = 128
    const data = new Uint8Array(width * height * 3)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3
        const inSquare = x >= 32 && x < 96 && y >= 32 && y < 96
        if (inSquare) {
          data[i] = 40 + x
          data[i + 1] = 30 + x
          data[i + 2] = 30
        } else {
          data[i] = 40
          data[i + 1] = 160
          data[i + 2] = 60
        }
      }
    }
    // Far fewer colours than relief levels: depth must not collapse with them.
    const result = voxelize({ data, width, height }, {
      size, domeDepth: 0, reliefSteps: 4, paletteSize: 2,
    })
    const colours = new Set(result.voxels.map((v) => `${v[4]},${v[5]},${v[6]}`))
    const depths = new Set(result.voxels.map((v) => v[2]))
    expect(colours.size).toBeLessThanOrEqual(2)
    expect(depths.size).toBeGreaterThan(colours.size)
  })

  it('is deterministic across runs', () => {
    const fixture = makeFixture(128, 128, 64)
    const a = voxelize(fixture, { size })
    const b = voxelize(fixture, { size })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('returns nothing when the whole image is background', () => {
    const width = 64
    const height = 64
    const data = new Uint8Array(width * height * 3)
    for (let i = 0; i < data.length; i += 3) {
      data[i] = 40
      data[i + 1] = 160
      data[i + 2] = 60
    }
    expect(voxelize({ data, width, height }, { size }).count).toBe(0)
  })
})
