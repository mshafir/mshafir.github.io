import { describe, it, expect } from 'vitest'
import { siteName } from './smoke'

describe('test harness', () => {
  it('runs and resolves modules', () => {
    expect(siteName).toBe('Michael Shafir')
  })
})
