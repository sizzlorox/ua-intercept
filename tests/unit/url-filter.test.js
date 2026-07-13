import { describe, it, expect } from 'vitest'
import { urlFilterFrom } from '../../src/core/url-filter.js'

describe('urlFilterFrom', () => {
  it('empty filters -> match all (no condition fields)', () => {
    expect(urlFilterFrom({ includeUrls: [], excludeUrls: [] })).toEqual({})
    expect(urlFilterFrom({})).toEqual({})
  })

  it('include-only -> requestDomains', () => {
    const c = urlFilterFrom({ includeUrls: ['example.com'] })
    expect(c).toEqual({ requestDomains: ['example.com'] })
  })

  it('exclude-only -> excludedRequestDomains', () => {
    const c = urlFilterFrom({ excludeUrls: ['ads.test'] })
    expect(c).toEqual({ excludedRequestDomains: ['ads.test'] })
  })

  it('both include and exclude coexist', () => {
    const c = urlFilterFrom({ includeUrls: ['a.com'], excludeUrls: ['b.com'] })
    expect(c).toEqual({ requestDomains: ['a.com'], excludedRequestDomains: ['b.com'] })
  })

  it('extracts host from match patterns and full URLs', () => {
    const c = urlFilterFrom({ includeUrls: ['*://*.example.com/*', 'https://foo.com/bar?x=1'] })
    expect(c.requestDomains).toEqual(['example.com', 'foo.com'])
  })

  it('drops entries that cannot resolve to a canonical host', () => {
    const c = urlFilterFrom({ includeUrls: ['', '   ', 'a.com'] })
    expect(c.requestDomains).toEqual(['a.com'])
  })

  it('dedupes hosts', () => {
    const c = urlFilterFrom({ includeUrls: ['a.com', 'https://a.com/x', '*://a.com/*'] })
    expect(c.requestDomains).toEqual(['a.com'])
  })

  it('fails CLOSED when includes are present but none resolve (no silent match-all)', () => {
    const c = urlFilterFrom({ includeUrls: ['***', '://'] })
    expect(c.requestDomains).toEqual(['invalid.invalid'])
  })

  it('extracts the domain from ModHeader-style regex patterns', () => {
    const c = urlFilterFrom({
      includeUrls: ['.*\\.facebook\\.com.*', 'https?://(.*\\.)?example\\.com/.*', 'plain.dev'],
    })
    expect(c.requestDomains).toEqual(['facebook.com', 'example.com', 'plain.dev'])
  })
})
