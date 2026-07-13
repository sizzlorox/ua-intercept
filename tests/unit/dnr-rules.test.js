import { describe, it, expect } from 'vitest'
import { buildRules, RULE_UA, RULE_SERVER_TIMING } from '../../src/core/dnr-rules.js'

const setToken = (value) => ({ value, enabled: true, mode: 'set' })
const appendToken = (value) => ({ value, enabled: true, mode: 'append' })

const headersProfile = { id: 'h', name: 'H', spoofDepth: 'headers', tokens: [setToken('FakeUA/1.0')] }
const appendProfile = { id: 'a', name: 'A', spoofDepth: 'headers', tokens: [appendToken('HTCVRSDET;')] }
const emptyProfile = { id: 'e', name: 'E', spoofDepth: 'headers', tokens: [] }

const fullChromium = {
  id: 'f',
  name: 'F',
  spoofDepth: 'full',
  tokens: [setToken('FakeChrome/131')],
  platform: 'Win32',
  mobile: false,
  uaData: {
    brands: [{ brand: 'Chromium', version: '131' }],
    fullVersionList: [{ brand: 'Chromium', version: '131.0.0.0' }],
    platformVersion: '15.0.0',
    chPlatform: 'Windows',
  },
}

describe('buildRules', () => {
  it('returns [] when disabled / no profile / no enabled tokens', () => {
    expect(buildRules(null)).toEqual([])
    expect(buildRules(emptyProfile)).toEqual([])
  })

  it('headers depth, set token: one rule, UA header set, main_frame present', () => {
    const rules = buildRules(headersProfile)
    expect(rules).toHaveLength(1)
    expect(rules[0].id).toBe(RULE_UA)
    expect(rules[0].condition.resourceTypes).toContain('main_frame')
    expect(rules[0].action.requestHeaders[0]).toEqual({ header: 'user-agent', operation: 'set', value: 'FakeUA/1.0' })
  })

  it('append token uses the APPEND operation (augment real UA)', () => {
    const rules = buildRules(appendProfile)
    expect(rules[0].action.requestHeaders[0]).toEqual({ header: 'user-agent', operation: 'append', value: 'HTCVRSDET;' })
  })

  it('full chromium set: Rule A gets CH lines, Rule B is the Server-Timing channel', () => {
    const rules = buildRules(fullChromium)
    expect(rules.map((r) => r.id).sort()).toEqual([RULE_UA, RULE_SERVER_TIMING])
    const ruleA = rules.find((r) => r.id === RULE_UA)
    const names = ruleA.action.requestHeaders.map((h) => h.header)
    expect(names).toContain('user-agent')
    expect(names).toContain('sec-ch-ua')
    const ruleB = rules.find((r) => r.id === RULE_SERVER_TIMING)
    expect(ruleB.action.responseHeaders[0].header).toBe('server-timing')
    const cfg = JSON.parse(decodeURIComponent(ruleB.action.responseHeaders[0].value.match(/desc="([^"]*)"/)[1]))
    expect(cfg.uaMode).toBe('set')
    expect(cfg.uaValue).toBe('FakeChrome/131')
  })
})
