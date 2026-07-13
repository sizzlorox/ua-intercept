import { describe, it, expect } from 'vitest'
import { isNewerVersion, normalizeVersion } from '../../src/core/version.js'

describe('normalizeVersion', () => {
  it('strips a leading v and trims', () => {
    expect(normalizeVersion('v0.1.0')).toBe('0.1.0')
    expect(normalizeVersion('  V2.3.4 ')).toBe('2.3.4')
    expect(normalizeVersion(null)).toBe('')
  })
})

describe('isNewerVersion', () => {
  it('detects a newer version', () => {
    expect(isNewerVersion('v0.2.0', '0.1.0')).toBe(true)
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true)
    expect(isNewerVersion('0.1.1', '0.1.0')).toBe(true)
  })
  it('is false for equal or older', () => {
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false)
    expect(isNewerVersion('v0.1.0', '0.1.0')).toBe(false)
    expect(isNewerVersion('0.0.9', '0.1.0')).toBe(false)
  })
  it('handles differing lengths', () => {
    expect(isNewerVersion('0.2', '0.1.9')).toBe(true)
    expect(isNewerVersion('0.1', '0.1.0')).toBe(false)
  })
  it('ignores pre-release suffixes (compares numeric parts)', () => {
    expect(isNewerVersion('0.2.0-beta', '0.1.0')).toBe(true)
  })
})
