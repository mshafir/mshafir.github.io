import { describe, it, expect } from 'vitest'
import { fuzzyScore } from './fuzzy'

describe('fuzzyScore', () => {
  it('matches an exact substring', () => {
    expect(fuzzyScore('react', 'reactlit')).not.toBeNull()
  })

  it('matches characters in order with gaps', () => {
    expect(fuzzyScore('rlt', 'reactlit')).not.toBeNull()
  })

  it('rejects characters out of order', () => {
    expect(fuzzyScore('tiler', 'reactlit')).toBeNull()
  })

  it('rejects characters that are absent', () => {
    expect(fuzzyScore('zzz', 'reactlit')).toBeNull()
  })

  it('is case insensitive', () => {
    expect(fuzzyScore('REACT', 'reactlit')).not.toBeNull()
  })

  it('scores a contiguous prefix above a scattered match', () => {
    expect(fuzzyScore('rea', 'reactlit')!).toBeGreaterThan(fuzzyScore('rea', 'rendered-area')!)
  })

  it('treats an empty query as a neutral match', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
  })
})
