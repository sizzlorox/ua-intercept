import { describe, it, expect } from 'vitest'
import { badgeText } from '../../src/core/badge.js'

describe('badgeText', () => {
  it('uses the first two alphanumerics, uppercased', () => {
    expect(badgeText('iPhone Safari')).toBe('IP')
    expect(badgeText('Windows — Chrome')).toBe('WI')
    expect(badgeText('bot')).toBe('BO')
  })
  it('skips leading non-alphanumerics', () => {
    expect(badgeText('  (test)')).toBe('TE')
    expect(badgeText('繁體中文')).toBe('繁體')
  })
  it('falls back to ON for empty/blank/non-string names', () => {
    expect(badgeText('')).toBe('ON')
    expect(badgeText('   ')).toBe('ON')
    expect(badgeText('!!!')).toBe('ON')
    expect(badgeText(null)).toBe('ON')
  })
})
