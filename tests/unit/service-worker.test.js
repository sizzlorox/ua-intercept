import { describe, it, expect, beforeEach } from 'vitest'
import { applyState } from '../../src/background/service-worker.js'

const { store, fx, reset } = globalThis.__chrome

const fullProfile = {
  id: 'p1',
  name: 'Windows Chrome',
  userAgent: 'FakeChrome/131',
  spoofDepth: 'full',
  color: '#123456',
  platform: 'Win32',
  mobile: false,
  uaData: { brands: [{ brand: 'Chromium', version: '131' }], chPlatform: 'Windows' },
}
const headersProfile = { id: 'p2', name: 'Bot', userAgent: 'Bot/1', spoofDepth: 'headers' }

beforeEach(reset)

describe('service worker applyState', () => {
  it('active full profile: applies DNR rules, registers injection, sets badge', async () => {
    store.profiles = [fullProfile]
    store.state = { enabled: true, activeProfileId: 'p1' }
    await applyState()

    const uaRule = fx.dynamicRules.find((r) => r.action.requestHeaders?.some((h) => h.header === 'user-agent'))
    expect(uaRule.action.requestHeaders[0].value).toBe('FakeChrome/131')
    expect(fx.registered.some((s) => s.id === 'ua-override')).toBe(true)
    expect(fx.badge.text).toBe('WI') // badgeText('Windows Chrome')
    expect(fx.badge.color).toBe('#123456')
    expect(fx.badge.title).toContain('Windows Chrome')
  })

  it('headers profile: DNR rule only, no injection registered', async () => {
    store.profiles = [headersProfile]
    store.state = { enabled: true, activeProfileId: 'p2' }
    await applyState()
    expect(fx.dynamicRules.length).toBeGreaterThan(0)
    expect(fx.registered.some((s) => s.id === 'ua-override')).toBe(false)
    expect(fx.badge.text).toBe('BO')
  })

  it('disabled: clears DNR rules, unregisters injection, clears badge', async () => {
    // start active+full so there is something to clear
    store.profiles = [fullProfile]
    store.state = { enabled: true, activeProfileId: 'p1' }
    await applyState()
    // now disable
    store.state = { enabled: false, activeProfileId: 'p1' }
    await applyState()
    expect(fx.dynamicRules).toEqual([])
    expect(fx.registered.some((s) => s.id === 'ua-override')).toBe(false)
    expect(fx.badge.text).toBe('')
  })
})
