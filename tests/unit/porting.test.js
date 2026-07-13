import { describe, it, expect } from 'vitest'
import { exportBundle, parseBundle, parseImport, mergeImport, FORMAT_VERSION } from '../../src/core/porting.js'

const profileA = { id: 'aaa', name: 'A', spoofDepth: 'headers', presetId: null, tokens: [{ value: 'UA-A', enabled: true, mode: 'set' }] }
const profileB = { id: 'bbb', name: 'B', spoofDepth: 'full', presetId: 'win-chrome', uaData: null, tokens: [{ value: 'UA-B', enabled: true, mode: 'set' }] }

describe('exportBundle / parseBundle round-trip', () => {
  it('round-trips (format v2) and preserves id + tokens', () => {
    const bundle = exportBundle([profileA])
    expect(bundle.formatVersion).toBe(FORMAT_VERSION)
    const parsed = parseBundle(JSON.stringify(bundle))
    expect(parsed.ok).toBe(true)
    expect(parsed.profiles[0].id).toBe('aaa')
    expect(parsed.profiles[0].name).toBe('A')
    expect(parsed.profiles[0].tokens).toEqual([{ value: 'UA-A', enabled: true, mode: 'set' }])
  })

  it('migrates a legacy v1 export (single userAgent) to a set token', () => {
    const v1 = { formatVersion: 1, profiles: [{ id: 'x', name: 'Old', spoofDepth: 'headers', userAgent: 'Legacy/1' }] }
    const r = parseBundle(JSON.stringify(v1))
    expect(r.ok).toBe(true)
    expect(r.profiles[0].tokens).toEqual([{ value: 'Legacy/1', enabled: true, mode: 'set' }])
  })

  it('rejects a v1 userAgent with control chars (normalize-then-validate, not bypassed)', () => {
    const v1 = { formatVersion: 1, profiles: [{ name: 'x', spoofDepth: 'headers', userAgent: 'Bad\r\nUA' }] }
    const r = parseBundle(JSON.stringify(v1))
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('errProfileInvalid')
    expect(r.error.params.reason.code).toBe('errUaControl')
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
  it('rejects when any profile is invalid — atomic, with index + reason', () => {
    const bundle = { formatVersion: 2, profiles: [profileA, { name: '', tokens: [] }] }
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

  it('imports one profile with the UA as a token', () => {
    const r = parseImport(JSON.stringify(mhProfile()))
    expect(r.ok).toBe(true)
    expect(r.source).toBe('modheader')
    expect(r.profiles).toHaveLength(1)
    expect(r.profiles[0].name).toBe('My MH Profile')
    expect(r.profiles[0].color).toBe('#123456')
    expect(r.profiles[0].tokens).toEqual([{ value: UA, enabled: true, mode: 'set' }])
  })

  it('AGGREGATES every UA row (enabled + disabled) as tokens under ONE profile', () => {
    const r = parseImport(
      JSON.stringify(
        mhProfile({
          title: 'VR',
          headers: [
            { appendMode: 'append', enabled: true, name: 'User-Agent', value: 'HTCVRSDET;' },
            { appendMode: 'append', enabled: false, name: 'User-Agent', value: 'PersonaApp;' },
            { enabled: true, name: 'X-Other', value: 'ignored' },
            { appendMode: false, enabled: false, name: 'User-Agent', value: 'eland; ETISDET' },
          ],
        })
      )
    )
    expect(r.ok).toBe(true)
    expect(r.profiles).toHaveLength(1)
    expect(r.profiles[0].name).toBe('VR')
    expect(r.profiles[0].tokens).toEqual([
      { value: 'HTCVRSDET;', enabled: true, mode: 'append' },
      { value: 'PersonaApp;', enabled: false, mode: 'append' },
      { value: 'eland; ETISDET', enabled: false, mode: 'set' },
    ])
  })

  it('imports an array of ModHeader profiles → one UA Intercept profile each', () => {
    const r = parseImport(JSON.stringify([mhProfile({ title: 'A' }), mhProfile({ title: 'B' })]))
    expect(r.ok).toBe(true)
    expect(r.profiles.map((p) => p.name)).toEqual(['A', 'B'])
  })

  it('imports the REST-style { profile } wrapper', () => {
    const r = parseImport(JSON.stringify({ profile: mhProfile({ title: 'Wrapped' }) }))
    expect(r.ok).toBe(true)
    expect(r.profiles[0].name).toBe('Wrapped')
  })

  it('matches the User-Agent header case-insensitively', () => {
    const r = parseImport(JSON.stringify(mhProfile({ headers: [{ enabled: true, name: 'user-agent', value: UA }] })))
    expect(r.profiles[0].tokens[0].value).toBe(UA)
  })

  it('rejects a ModHeader profile with no User-Agent header', () => {
    const r = parseImport(JSON.stringify(mhProfile({ headers: [{ enabled: true, name: 'Referer', value: 'x' }] })))
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('errNoProfiles')
  })

  it('extracts domains from ModHeader regex URL filters', () => {
    const r = parseImport(
      JSON.stringify(
        mhProfile({
          urlFilters: [
            { enabled: true, urlRegex: 'https?://(.*\\.)?facebook\\.com/.*' },
            { enabled: true, urlRegex: '.*\\.google\\.com.*' },
            { enabled: true, urlRegex: 'https:\\/\\/.*.vive.com' },
          ],
        })
      )
    )
    expect(r.profiles[0].includeUrls).toEqual(['facebook.com', 'google.com', 'vive.com'])
  })

  it('maps excludeUrlFilters to excludeUrls', () => {
    const r = parseImport(JSON.stringify(mhProfile({ excludeUrlFilters: [{ urlRegex: 'ads.example.com' }] })))
    expect(r.profiles[0].excludeUrls).toEqual(['ads.example.com'])
  })

  it('uses a default name when the ModHeader profile has no title', () => {
    const r = parseImport(JSON.stringify(mhProfile({ title: undefined })))
    expect(r.profiles[0].name).toBe('Imported profile')
  })

  it('rejects a token with control characters (validated, not bypassed)', () => {
    const r = parseImport(JSON.stringify(mhProfile({ headers: [{ enabled: true, name: 'User-Agent', value: 'Bad\r\nUA' }] })))
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('errProfileInvalid')
    expect(r.error.params.reason.code).toBe('errUaControl')
  })

  it('still imports our own bundle format', () => {
    const r = parseImport(JSON.stringify(exportBundle([profileA])))
    expect(r.ok).toBe(true)
    expect(r.source).toBe('ua-intercept')
    expect(r.profiles[0].id).toBe('aaa')
  })

  it('rejects a totally unrecognized file', () => {
    const r = parseImport(JSON.stringify({ hello: 'world' }))
    expect(r.ok).toBe(false)
    expect(r.error.code).toBe('errUnrecognized')
  })
})

describe('mergeImport', () => {
  let counter = 0
  const gen = () => `new-${counter++}`

  it('preserves id when no collision', () => {
    expect(mergeImport([profileA], [], gen)[0].id).toBe('aaa')
  })
  it('reassigns id ONLY on collision', () => {
    const out = mergeImport([profileA], [{ id: 'aaa' }], gen)
    expect(out[0].id).toMatch(/^new-/)
  })
  it('re-derives uaData from presetId when absent', () => {
    const out = mergeImport([profileB], [], gen)
    expect(out[0].uaData).not.toBeNull()
    expect(Array.isArray(out[0].uaData.brands)).toBe(true)
  })
})
