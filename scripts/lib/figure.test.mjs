import { describe, it, expect } from 'vitest'
import { buildFigure, sample, PALETTE, BOUNDS } from './figure.mjs'

const figure = buildFigure()
const at = new Map(figure.voxels.map((v) => [`${v[0]},${v[1]},${v[2]}`, v.slice(3)]))
const colourKey = (c) => c.join(',')
const used = new Set(figure.voxels.map((v) => colourKey(v.slice(3))))

describe('buildFigure', () => {
  it('produces a figure of a workable size', () => {
    expect(figure.count).toBeGreaterThan(800)
    expect(figure.count).toBeLessThan(4000)
  })

  it('emits integer tuples of exactly six numbers', () => {
    for (const v of figure.voxels) {
      expect(v).toHaveLength(6)
      for (const n of v) expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('stays inside the declared bounds', () => {
    for (const [x, y, z] of figure.voxels) {
      expect(Math.abs(x)).toBeLessThanOrEqual(BOUNDS.x)
      expect(Math.abs(y)).toBeLessThanOrEqual(BOUNDS.y)
      expect(Math.abs(z)).toBeLessThanOrEqual(BOUNDS.z)
    }
  })

  it('emits no two voxels at the same cell', () => {
    expect(at.size).toBe(figure.voxels.length)
  })

  it('omits buried voxels, keeping only the surface', () => {
    // The very centre of the head is solid, so it must not be emitted.
    expect(sample(0, 6, 0)).not.toBeNull()
    expect(at.has('0,6,0')).toBe(false)
  })

  it('is symmetric about the vertical axis apart from the expression', () => {
    // The smirk and the cocked brow are the only intended asymmetries, so
    // everything else mirroring is a real invariant: it catches a feature that
    // has drifted off-centre, which is very hard to see by eye at this scale.
    const expression = new Set([colourKey(PALETTE.mouth), colourKey(PALETTE.brow)])
    for (const [x, y, z, ...colour] of figure.voxels) {
      if (expression.has(colourKey(colour))) continue
      const mirrored = at.get(`${-x},${y},${z}`)
      if (mirrored && expression.has(colourKey(mirrored))) continue
      expect(mirrored, `no mirror for ${x},${y},${z}`).toBeDefined()
      expect(colourKey(mirrored)).toBe(colourKey(colour))
    }
  })

  it('smirks rather than smiling', () => {
    const mouth = figure.voxels.filter((v) => colourKey(v.slice(3)) === colourKey(PALETTE.mouth))
    const side = (sign) => mouth.filter((v) => Math.sign(v[0]) === sign)
    const meanY = (list) => list.reduce((sum, v) => sum + v[1], 0) / Math.max(1, list.length)

    // One corner has to sit higher than the other, or it is just a smile.
    expect(Math.abs(meanY(side(1)) - meanY(side(-1)))).toBeGreaterThan(0.4)
  })

  it('raises the brow on the smirking side', () => {
    const brows = figure.voxels.filter((v) => colourKey(v.slice(3)) === colourKey(PALETTE.brow))
    const top = (sign) => Math.max(...brows.filter((v) => Math.sign(v[0]) === sign).map((v) => v[1]))
    const mouth = figure.voxels.filter((v) => colourKey(v.slice(3)) === colourKey(PALETTE.mouth))
    const mouthMean = (sign) => {
      const list = mouth.filter((v) => Math.sign(v[0]) === sign)
      return list.reduce((sum, v) => sum + v[1], 0) / Math.max(1, list.length)
    }
    const smirkSide = mouthMean(1) > mouthMean(-1) ? 1 : -1
    expect(top(smirkSide)).toBeGreaterThan(top(-smirkSide))
  })

  it('includes the features that make it recognisable', () => {
    const parts = ['skin', 'hair', 'frame', 'eye', 'sclera', 'brow', 'mouth', 'knit', 'knitBand', 'knitStripe']
    for (const part of parts) {
      expect(used.has(colourKey(PALETTE[part])), `${part} missing`).toBe(true)
    }
  })

  it('puts the glasses in front of the eyes', () => {
    const depthOf = (colour) =>
      Math.max(
        ...figure.voxels.filter((v) => colourKey(v.slice(3)) === colourKey(colour)).map((v) => v[2]),
      )
    expect(depthOf(PALETTE.frame)).toBeGreaterThan(depthOf(PALETTE.eye))
  })

  it('puts hair above and behind the face, never over it', () => {
    const hair = figure.voxels.filter((v) => colourKey(v.slice(3)) === colourKey(PALETTE.hair))
    const eyes = figure.voxels.filter((v) => colourKey(v.slice(3)) === colourKey(PALETTE.eye))
    const eyeY = Math.max(...eyes.map((v) => v[1]))
    // Any hair at eye height must be at the sides, not across the face.
    for (const [x, y, z] of hair) {
      if (y <= eyeY && z > 4) expect(Math.abs(x)).toBeGreaterThan(5)
    }
  })

  it('is deterministic', () => {
    expect(JSON.stringify(buildFigure())).toBe(JSON.stringify(figure))
  })
})
