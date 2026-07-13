import { describe, it, expect } from 'vitest'
import { buildRules, RULE_UA, RULE_SERVER_TIMING } from '../../src/core/dnr-rules.js'

const headersProfile = {
  id: 'h',
  name: 'H',
  userAgent: 'FakeUA/1.0',
  spoofDepth: 'headers',
}

const fullChromium = {
  id: 'f',
  name: 'F',
  userAgent: 'FakeChrome/131',
  spoofDepth: 'full',
  platform: 'Win32',
  mobile: false,
  uaData: {
    brands: [{ brand: 'Chromium', version: '131' }],
    fullVersionList: [{ brand: 'Chromium', version: '131.0.0.0' }],
    platformVersion: '15.0.0',
    chPlatform: 'Windows',
  },
}

const fullSafari = { id: 's', name: 'S', userAgent: 'FakeSafari', spoofDepth: 'full', uaData: null }

describe('buildRules', () => {
  it('returns [] when disabled / no profile', () => {
    expect(buildRules(null)).toEqual([])
    expect(buildRules(undefined)).toEqual([])
  })

  it('headers depth: one rule, UA header only, main_frame present', () => {
    const rules = buildRules(headersProfile)
    expect(rules).toHaveLength(1)
    const rule = rules[0]
    expect(rule.id).toBe(RULE_UA)
    expect(rule.condition.resourceTypes).toContain('main_frame')
    const headers = rule.action.requestHeaders
    expect(headers).toHaveLength(1)
    expect(headers[0]).toEqual({ header: 'user-agent', operation: 'set', value: 'FakeUA/1.0' })
  })

  it('full chromium: Rule A gets CH lines, Rule B is the Server-Timing channel', () => {
    const rules = buildRules(fullChromium)
    expect(rules.map((r) => r.id).sort()).toEqual([RULE_UA, RULE_SERVER_TIMING])

    const ruleA = rules.find((r) => r.id === RULE_UA)
    const names = ruleA.action.requestHeaders.map((h) => h.header)
    expect(names).toContain('user-agent')
    expect(names).toContain('sec-ch-ua')
    expect(names).toContain('sec-ch-ua-mobile')
    expect(names).toContain('sec-ch-ua-platform')

    const ruleB = rules.find((r) => r.id === RULE_SERVER_TIMING)
    expect(ruleB.action.responseHeaders[0].header).toBe('server-timing')
    expect(ruleB.condition.resourceTypes).toEqual(['main_frame', 'sub_frame'])
    // the appended value carries the encoded injectConfig
    const decoded = decodeURIComponent(ruleB.action.responseHeaders[0].value.match(/desc="([^"]*)"/)[1])
    expect(JSON.parse(decoded).userAgent).toBe('FakeChrome/131')
  })

  it('full non-chromium: sec-ch-ua* use remove (no fake Chromium hints)', () => {
    const rules = buildRules(fullSafari)
    const ruleA = rules.find((r) => r.id === RULE_UA)
    const ch = ruleA.action.requestHeaders.filter((h) => h.header.startsWith('sec-ch-ua'))
    expect(ch.length).toBeGreaterThan(0)
    for (const h of ch) expect(h.operation).toBe('remove')
  })
})
