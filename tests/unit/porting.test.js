import { describe, it, expect } from 'vitest'
import { exportBundle, parseBundle, parseImport, mergeImport, FORMAT_VERSION } from '../../src/core/porting.js'

const profileA = { id: 'aaa', name: 'A', userAgent: 'UA-A', spoofDepth: 'headers', presetId: null }
const profileB = { id: 'bbb', name: 'B', userAgent: 'UA-B', spoofDepth: 'full', presetId: 'win-chrome', uaData: null }

describe('exportBundle / parseBundle round-trip', () => {
  it('round-trips and preserves id (SC-004 field-for-field)', () => {
    const bundle = exportBundle([profileA])
    expect(bundle.formatVersion).toBe(FORMAT_VERSION)
    const parsed = parseBundle(JSON.stringify(bundle))
    expect(parsed.ok).toBe(true)
    expect(parsed.profiles[0].id).toBe('aaa')
    expect(parsed.profiles[0].name).toBe('A')
    expect(parsed.profiles[0].userAgent).toBe('UA-A')
  })
})

describe('parseBundle validation', () => {
  it('rejects non-JSON', () => {
    expect(parseBundle('{not json').ok).toBe(false)
  })
  it('rejects missing formatVersion', () => {
    expect(parseBundle(JSON.stringify({ profiles: [] })).ok).toBe(false)
  })
  it('rejects a newer version (99)', () => {
    const r = parseBundle(JSON.stringify({ formatVersion: 99, profiles: [] }))
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('errNewerVersion')
  })
  it('rejects when any profile is invalid — atomic, with the offending index and reason', () => {
    const bundle = { formatVersion: 1, profiles: [profileA, { name: '', userAgent: '' }] }
    const r = parseBundle(JSON.stringify(bundle))
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('errProfileInvalid')
    expect(r.error.params.index).toBe(2)
    expect(r.error.params.reason.code).toBe('errNameRequired')
  })
})

describe('parseImport — ModHeader compatibility', () => {
  const UA = 'Mozilla/5.0 (Windows NT 10.0) FakeUA/1'
  const mhProfile = (over = {}) => ({
    title: 'My MH Profile',
    version: 2,
    backgroundColor: '#123456',
    headers: [
      { enabled: true, name: 'X-Test', value: 'hi' },
      { enabled: true, name: 'User-Agent', value: UA },
    ],
    ...over,
  })

  it('imports a bare ModHeader profile object, extracting the User-Agent', () => {
    const r = parseImport(JSON.stringify(mhProfile()))
    expect(r.ok).toBe(true)
    expect(r.source).toBe('modheader')
    expect(r.profiles).toHaveLength(1)
    expect(r.profiles[0].name).toBe('My MH Profile')
    expect(r.profiles[0].userAgent).toBe(UA)
    expect(r.profiles[0].spoofDepth).toBe('headers')
    expect(r.profiles[0].color).toBe('#123456')
  })

  it('imports an array of ModHeader profiles', () => {
    const r = parseImport(JSON.stringify([mhProfile({ title: 'A' }), mhProfile({ title: 'B' })]))
    expect(r.ok).toBe(true)
    expect(r.profiles.map((p) => p.name)).toEqual(['A', 'B'])
  })

  it('imports the REST-style { profile: {...} } wrapper', () => {
    const r = parseImport(JSON.stringify({ profile: mhProfile({ title: 'Wrapped' }) }))
    expect(r.ok).toBe(true)
    expect(r.profiles[0].name).toBe('Wrapped')
  })

  it('matches the User-Agent header case-insensitively', () => {
    const r = parseImport(JSON.stringify(mhProfile({ headers: [{ enabled: true, name: 'user-agent', value: UA }] })))
    expect(r.ok).toBe(true)
    expect(r.profiles[0].userAgent).toBe(UA)
  })

  it('skips a disabled User-Agent header (no importable profile -> errNoProfiles)', () => {
    const r = parseImport(JSON.stringify(mhProfile({ headers: [{ enabled: false, name: 'User-Agent', value: UA }] })))
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('errNoProfiles')
  })

  it('rejects a ModHeader profile with no User-Agent header', () => {
    const r = parseImport(JSON.stringify(mhProfile({ headers: [{ enabled: true, name: 'Referer', value: 'x' }] })))
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('errNoProfiles')
  })

  it('keeps ModHeader url filters that map to a domain, drops complex regexes', () => {
    const r = parseImport(
      JSON.stringify(
        mhProfile({
          urlFilters: [{ urlRegex: 'example.com' }, { urlRegex: 'https?://(.*\\.)?evil\\.(com|net)/.*' }],
        })
      )
    )
    expect(r.ok).toBe(true)
    expect(r.profiles[0].includeUrls).toEqual(['example.com'])
  })

  it('supports the older single `filters` array (type urls, urlRegex)', () => {
    const r = parseImport(
      JSON.stringify(
        mhProfile({
          urlFilters: undefined,
          filters: [
            { type: 'urls', urlRegex: 'shop.example.com' },
            { type: 'types', resourceType: ['main_frame'] },
          ],
        })
      )
    )
    expect(r.ok).toBe(true)
    expect(r.profiles[0].includeUrls).toEqual(['shop.example.com'])
  })

  it('still imports our own bundle format', () => {
    const bundle = exportBundle([profileA])
    const r = parseImport(JSON.stringify(bundle))
    expect(r.ok).toBe(true)
    expect(r.source).toBe('ua-intercept')
    expect(r.profiles[0].id).toBe('aaa')
  })

  it('rejects a totally unrecognized file', () => {
    const r = parseImport(JSON.stringify({ hello: 'world' }))
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('errUnrecognized')
  })

  it('maps excludeUrlFilters to excludeUrls (domain-resolvable only)', () => {
    const r = parseImport(JSON.stringify(mhProfile({ excludeUrlFilters: [{ urlRegex: 'ads.example.com' }] })))
    expect(r.ok).toBe(true)
    expect(r.profiles[0].excludeUrls).toEqual(['ads.example.com'])
  })

  it('uses a default name when the ModHeader profile has no title', () => {
    const r = parseImport(JSON.stringify(mhProfile({ title: undefined })))
    expect(r.ok).toBe(true)
    expect(r.profiles[0].name).toBe('Imported profile')
  })

  it('rejects a ModHeader profile whose User-Agent has control characters (validated, not bypassed)', () => {
    const r = parseImport(JSON.stringify(mhProfile({ headers: [{ enabled: true, name: 'User-Agent', value: 'Bad\r\nUA' }] })))
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('errProfileInvalid')
    expect(r.error.params.reason.code).toBe('errUaControl')
  })
})

describe('mergeImport', () => {
  let counter = 0
  const gen = () => `new-${counter++}`

  it('preserves id when no collision', () => {
    const out = mergeImport([profileA], [], gen)
    expect(out[0].id).toBe('aaa')
  })

  it('reassigns id ONLY on collision with an existing profile', () => {
    const out = mergeImport([profileA], [{ id: 'aaa' }], gen)
    expect(out[0].id).not.toBe('aaa')
    expect(out[0].id).toMatch(/^new-/)
  })

  it('re-derives uaData from presetId when absent', () => {
    const out = mergeImport([profileB], [], gen)
    expect(out[0].uaData).not.toBeNull()
    expect(Array.isArray(out[0].uaData.brands)).toBe(true)
  })
})
