import { describe, it, expect } from 'vitest'
import { deriveClientHints } from '../../src/core/client-hints.js'

const chromium = {
  userAgent: 'Mozilla/5.0 ... Chrome/131.0.0.0 ...',
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

const safari = {
  userAgent: 'Mozilla/5.0 (iPhone; ...) Version/17.6 Mobile Safari/604.1',
  platform: 'iPhone',
  mobile: true,
  uaData: null,
}

describe('deriveClientHints — chromium', () => {
  const { headerOps, injectConfig } = deriveClientHints(chromium)
  const byName = (n) => headerOps.find((h) => h.header === n)

  it('sets sec-ch-ua from brands', () => {
    expect(byName('sec-ch-ua')).toEqual({
      header: 'sec-ch-ua',
      operation: 'set',
      value: '"Chromium";v="131", "Google Chrome";v="131"',
    })
  })
  it('sets mobile ?0 and platform quoted', () => {
    expect(byName('sec-ch-ua-mobile').value).toBe('?0')
    expect(byName('sec-ch-ua-platform').value).toBe('"Windows"')
  })
  it('removes full-version-list on the wire', () => {
    expect(byName('sec-ch-ua-full-version-list').operation).toBe('remove')
  })
  it('injectConfig carries the userAgentData fields', () => {
    expect(injectConfig.brands.length).toBe(2)
    expect(injectConfig.platformVersion).toBe('15.0.0')
    expect(injectConfig.chPlatform).toBe('Windows')
  })
})

describe('deriveClientHints — non-chromium', () => {
  const { headerOps, injectConfig } = deriveClientHints(safari)

  it('removes every sec-ch-ua* (no Chromium brand sent)', () => {
    for (const h of headerOps) expect(h.operation).toBe('remove')
    expect(headerOps.map((h) => h.header)).toContain('sec-ch-ua')
    expect(JSON.stringify(headerOps)).not.toContain('Chromium')
  })
  it('injectConfig has empty brands', () => {
    expect(injectConfig.brands).toEqual([])
  })
})
