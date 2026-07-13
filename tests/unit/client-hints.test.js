import { describe, it, expect } from 'vitest'
import { deriveClientHints } from '../../src/core/client-hints.js'

const chromium = {
  platform: 'Win32',
  mobile: false,
  uaData: {
    brands: [
      { brand: 'Chromium', version: '131' },
      { brand: 'Google Chrome', version: '131' },
    ],
    fullVersionList: [{ brand: 'Chromium', version: '131.0.6778.140' }],
    platformVersion: '15.0.0',
    chPlatform: 'Windows',
  },
}
const setUa = { mode: 'set', value: 'Mozilla/5.0 ... Chrome/131.0.0.0 ...' }

const mobileChromium = { ...chromium, platform: '', mobile: true }

const safari = { platform: 'iPhone', mobile: true, uaData: null }
const safariSet = { mode: 'set', value: 'Mozilla/5.0 (iPhone; ...) Version/17.6 Mobile Safari/604.1' }

describe('deriveClientHints — chromium set UA', () => {
  const { headerOps, injectConfig } = deriveClientHints(chromium, setUa)
  const byName = (n) => headerOps.find((h) => h.header === n)

  it('sets sec-ch-ua from brands', () => {
    expect(byName('sec-ch-ua').value).toBe('"Chromium";v="131", "Google Chrome";v="131"')
  })
  it('sets mobile ?0 and platform quoted', () => {
    expect(byName('sec-ch-ua-mobile').value).toBe('?0')
    expect(byName('sec-ch-ua-platform').value).toBe('"Windows"')
  })
  it('removes full-version-list on the wire', () => {
    expect(byName('sec-ch-ua-full-version-list').operation).toBe('remove')
  })
  it('injectConfig carries set mode + userAgentData fields', () => {
    expect(injectConfig.uaMode).toBe('set')
    expect(injectConfig.uaValue).toBe(setUa.value)
    expect(injectConfig.brands.length).toBe(2)
    expect(injectConfig.chPlatform).toBe('Windows')
  })
  it('injectConfig.mobile matches the ?0 wire header (desktop)', () => {
    expect(injectConfig.mobile).toBe(false)
  })
})

describe('deriveClientHints — mobile chromium set UA', () => {
  const { headerOps, injectConfig } = deriveClientHints(mobileChromium, setUa)
  const byName = (n) => headerOps.find((h) => h.header === n)
  // The header and the JS-visible userAgentData.mobile must agree, else a page
  // cross-checking them detects the spoof.
  it('sends sec-ch-ua-mobile ?1 AND injectConfig.mobile true', () => {
    expect(byName('sec-ch-ua-mobile').value).toBe('?1')
    expect(injectConfig.mobile).toBe(true)
  })
})

describe('deriveClientHints — non-chromium set UA', () => {
  const { headerOps, injectConfig } = deriveClientHints(safari, safariSet)
  it('removes every sec-ch-ua* (no Chromium brand sent)', () => {
    for (const h of headerOps) expect(h.operation).toBe('remove')
    expect(JSON.stringify(headerOps)).not.toContain('Chromium')
  })
  it('injectConfig has empty brands', () => {
    expect(injectConfig.brands).toEqual([])
  })
})

describe('deriveClientHints — append token (augment, keep real identity)', () => {
  const { headerOps, injectConfig } = deriveClientHints(chromium, { mode: 'append', value: 'FBAN;' })
  it('does NOT touch sec-ch-ua* for an append', () => {
    expect(headerOps).toEqual([])
  })
  it('injectConfig marks append mode with empty brands/platform, mobile false', () => {
    expect(injectConfig.uaMode).toBe('append')
    expect(injectConfig.uaValue).toBe('FBAN;')
    expect(injectConfig.brands).toEqual([])
    expect(injectConfig.platform).toBe('')
    expect(injectConfig.mobile).toBe(false)
  })
})
