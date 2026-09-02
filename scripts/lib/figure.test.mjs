import { describe, it, expect } from 'vitest'
import { buildFigure, buildSolid, sample, PALETTE, BOUNDS } from './figure.mjs'

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

  it('mirrors every face feature exactly', () => {
    // Checked against the solid volume, not the emitted surface. The hair is
    // scruffed with noise, so which feature voxels end up *exposed* differs
    // between the two sides even though they are placed identically; it is the
    // placement that has to mirror. Skin is left out for the same reason: its
    // boundary with the hair is asymmetric by design.
    const placedBy = new Map()
    for (const [at, colour] of buildSolid()) {
      const key = colourKey(colour)
      if (!placedBy.has(key)) placedBy.set(key, new Set())
      placedBy.get(key).add(at)
    }

    for (const part of ['frame', 'lens', 'eye', 'sclera', 'brow', 'ear']) {
      const placed = placedBy.get(colourKey(PALETTE[part]))
      expect(placed, `${part} missing`).toBeDefined()
      for (const at of placed) {
        const [x, y, z] = at.split(',').map(Number)
        expect(placed.has(`${-x},${y},${z}`), `${part} has no mirror at ${at}`).toBe(true)
      }
    }
  })

  it('smirks rather than smiling', () => {
    const mouth = figure.voxels.filter((v) => colourKey(v.slice(3)) === colourKey(PALETTE.mouth))
    const side = (sign) => mouth.filter((v) => Math.sign(v[0]) === sign)
    const meanY = (list) => list.reduce((sum, v) => sum + v[1], 0) / Math.max(1, list.length)

    // One corner has to sit higher than the other, or it is just a smile.
    expect(Math.abs(meanY(side(1)) - meanY(side(-1)))).toBeGreaterThan(0.4)
  })

  it('keeps the brows level with each other', () => {
    const brows = figure.voxels.filter((v) => colourKey(v.slice(3)) === colourKey(PALETTE.brow))
    const rows = (sign) => brows.filter((v) => Math.sign(v[0]) === sign).map((v) => v[1])
    expect(Math.max(...rows(1))).toBe(Math.max(...rows(-1)))
    expect(Math.min(...rows(1))).toBe(Math.min(...rows(-1)))
  })

  it('keeps the brows clear of the glasses', () => {
    const lowest = (colour) =>
      Math.min(
        ...figure.voxels.filter((v) => colourKey(v.slice(3)) === colourKey(colour)).map((v) => v[1]),
      )
    const highestFrame = Math.max(
      ...figure.voxels
        .filter((v) => colourKey(v.slice(3)) === colourKey(PALETTE.frame))
        .map((v) => v[1]),
    )
    // Touching rims turn brow and frame into one dark bar across the face.
    expect(lowest(PALETTE.brow)).toBeGreaterThan(highestFrame)
  })

  it('tapers toward the chin rather than staying round', () => {
    const skin = figure.voxels.filter((v) => colourKey(v.slice(3)) === colourKey(PALETTE.skin))
    const widthAt = (y) => {
      const row = skin.filter((v) => v[1] === y).map((v) => v[0])
      return row.length ? Math.max(...row) - Math.min(...row) : 0
    }
    const cheek = widthAt(5)
    const jaw = widthAt(-1)
    expect(jaw).toBeGreaterThan(0)
    expect(jaw).toBeLessThan(cheek * 0.85)
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

  it('is one connected piece', () => {
    // Tested on the solid volume, not the emitted surface: two surface voxels
    // can be joined only through interior cells that were culled, so adjacency
    // among emitted voxels is not the right question.
    // Face and edge adjacency, matching the builder: cubes sharing an edge
    // read as joined, cubes sharing only a corner do not.
    const adjacency = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const steps = Math.abs(dx) + Math.abs(dy) + Math.abs(dz)
          if (steps === 1 || steps === 2) adjacency.push([dx, dy, dz])
        }
      }
    }
    const solid = buildSolid()
    const seen = new Set()
    const queue = [solid.keys().next().value]
    seen.add(queue[0])
    while (queue.length) {
      const [x, y, z] = queue.pop().split(',').map(Number)
      for (const [dx, dy, dz] of adjacency) {
        const next = `${x + dx},${y + dy},${z + dz}`
        if (solid.has(next) && !seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    expect(seen.size).toBe(solid.size)
  })

  it('has untidy hair rather than a smooth helmet', () => {
    const hair = new Set([colourKey(PALETTE.hair), colourKey(PALETTE.hairDark)])
    const strands = figure.voxels.filter((v) => hair.has(colourKey(v.slice(3))))

    // The front hairline should sit at a range of heights across the head, not
    // trace one clean curve.
    const front = strands.filter((v) => v[2] > 3)
    const lowestBy = new Map()
    for (const [x, y] of front) {
      lowestBy.set(x, Math.min(lowestBy.get(x) ?? Infinity, y))
    }
    expect(new Set(lowestBy.values()).size).toBeGreaterThan(2)

    // And the crown should have a broken outline, not a single top row.
    const crown = strands.filter((v) => Math.abs(v[2]) < 4)
    const tops = new Map()
    for (const [x, y] of crown) tops.set(x, Math.max(tops.get(x) ?? -Infinity, y))
    expect(new Set(tops.values()).size).toBeGreaterThan(2)
  })

  it('is deterministic', () => {
    expect(JSON.stringify(buildFigure())).toBe(JSON.stringify(figure))
  })
})
