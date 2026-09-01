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
    for (const [, , , r, g, b] of result.voxels) {
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

  it('assigns depth so central cells sit forward of edge cells', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    const byDistance = [...result.voxels].sort(
      (a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]),
    )
    expect(byDistance[0][2]).toBeGreaterThan(byDistance[byDistance.length - 1][2])
  })

  it('emits integer tuples of exactly six numbers', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    for (const v of result.voxels) {
      expect(v).toHaveLength(6)
      for (const n of v) expect(Number.isInteger(n)).toBe(true)
    }
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
