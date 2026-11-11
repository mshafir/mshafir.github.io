// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { ASSET_ORIGIN, htmlToMarkdown, markdownToHtml, readingMinutes, slugify } from './markdown'

const roundTrip = (md: string) => htmlToMarkdown(markdownToHtml(md))

describe('markdown round trip', () => {
  it('keeps headings, emphasis, links and inline code', () => {
    const md = '## The rulebook\n\nI gave **Claude** the *rules* and a [link](https://example.com) to `config.yaml`.\n'
    expect(roundTrip(md)).toBe(md)
  })

  it('keeps fenced code blocks with their language', () => {
    const md = '```ts\nconst x = 1\n```\n'
    expect(roundTrip(md)).toBe(md)
  })

  it('keeps tight bulleted and numbered lists', () => {
    const md = '- One\n- Two\n- Three\n\n1. First\n2. Second\n'
    expect(roundTrip(md)).toBe(md)
  })

  it('keeps blockquotes, dividers and strikethrough', () => {
    const md = '> A quote\n\n---\n\n~~gone~~\n'
    expect(roundTrip(md)).toBe(md)
  })

  it('is stable after the first normalisation', () => {
    const md = 'A paragraph that was\nhard wrapped in the file.\n\n* star bullets\n* become dashes\n'
    const once = roundTrip(md)
    expect(roundTrip(once)).toBe(once)
  })
})

describe('images', () => {
  it('points site images at the app protocol while editing', () => {
    expect(markdownToHtml('![A plan](/images/post/plan.png)')).toContain(`src="${ASSET_ORIGIN}/images/post/plan.png"`)
  })

  it('leaves external images alone', () => {
    expect(markdownToHtml('![x](https://example.com/a.png)')).toContain('src="https://example.com/a.png"')
  })

  it('restores site paths when saving', () => {
    expect(roundTrip('![A plan](/images/post/plan.png)\n')).toBe('![A plan](/images/post/plan.png)\n')
  })
})

describe('slugify', () => {
  it('makes url-safe slugs', () => {
    expect(slugify("Building investbot: letting Claude run my rebalancing!")).toBe(
      'building-investbot-letting-claude-run-my-rebalancing',
    )
    expect(slugify("What I'd change")).toBe('what-id-change')
  })
})

describe('readingMinutes', () => {
  it('rounds like the site and never says zero', () => {
    expect(readingMinutes('word')).toBe(1)
    expect(readingMinutes('word '.repeat(660))).toBe(3)
  })
})
