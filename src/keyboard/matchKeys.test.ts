import { describe, it, expect } from 'vitest'
import { eventToToken, parseChord } from './matchKeys'

const event = (init: Partial<KeyboardEvent>) => init as KeyboardEvent

describe('eventToToken', () => {
  it('lowercases plain letter keys', () => {
    expect(eventToToken(event({ key: 'G' }))).toBe('g')
  })

  it('keeps named keys in their canonical form', () => {
    expect(eventToToken(event({ key: 'Enter' }))).toBe('Enter')
    expect(eventToToken(event({ key: 'Escape' }))).toBe('Escape')
  })

  it('passes punctuation through', () => {
    expect(eventToToken(event({ key: '/' }))).toBe('/')
    expect(eventToToken(event({ key: '?' }))).toBe('?')
  })

  it('prefixes mod for meta or ctrl', () => {
    expect(eventToToken(event({ key: 'k', metaKey: true }))).toBe('mod+k')
    expect(eventToToken(event({ key: 'k', ctrlKey: true }))).toBe('mod+k')
  })

  it('ignores a lone shift, already reflected in the key value', () => {
    expect(eventToToken(event({ key: '?', shiftKey: true }))).toBe('?')
  })
})

describe('parseChord', () => {
  it('splits a chord on spaces', () => {
    expect(parseChord('g h')).toEqual(['g', 'h'])
  })

  it('returns a single-element array for single strokes', () => {
    expect(parseChord('mod+k')).toEqual(['mod+k'])
    expect(parseChord('?')).toEqual(['?'])
  })

  it('collapses repeated whitespace', () => {
    expect(parseChord('g   p')).toEqual(['g', 'p'])
  })
})
