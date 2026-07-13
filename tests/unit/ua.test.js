import { describe, it, expect } from 'vitest'
import { effectiveUa, effectiveUaPreview } from '../../src/core/ua.js'

const tk = (value, enabled = true, mode = 'append') => ({ value, enabled, mode })

describe('effectiveUa', () => {
  it('null when there are no enabled tokens', () => {
    expect(effectiveUa({ tokens: [] })).toBeNull()
    expect(effectiveUa({ tokens: [tk('X', false)] })).toBeNull()
    expect(effectiveUa({})).toBeNull()
  })

  it('one enabled append token → append mode', () => {
    expect(effectiveUa({ tokens: [tk('HTCVRSDET;')] })).toEqual({ mode: 'append', value: 'HTCVRSDET;' })
  })

  it('joins multiple enabled append tokens with a space', () => {
    expect(effectiveUa({ tokens: [tk('HTCVRSDET;'), tk('FBAN;', false), tk('ViverseApp/1.0;')] })).toEqual({
      mode: 'append',
      value: 'HTCVRSDET; ViverseApp/1.0;',
    })
  })

  it('a set token replaces (last set wins)', () => {
    expect(effectiveUa({ tokens: [tk('Old', true, 'set'), tk('New', true, 'set')] })).toEqual({
      mode: 'set',
      value: 'New',
    })
  })

  it('set base + enabled appends are combined into one set value', () => {
    expect(effectiveUa({ tokens: [tk('Mozilla/5.0 Base', true, 'set'), tk('FBAN;')] })).toEqual({
      mode: 'set',
      value: 'Mozilla/5.0 Base FBAN;',
    })
  })
})

describe('effectiveUaPreview', () => {
  it('append shows real UA + tokens; set shows the value; none shows real', () => {
    expect(effectiveUaPreview({ tokens: [tk('FBAN;')] }, 'REAL')).toBe('REAL FBAN;')
    expect(effectiveUaPreview({ tokens: [tk('X', true, 'set')] }, 'REAL')).toBe('X')
    expect(effectiveUaPreview({ tokens: [] }, 'REAL')).toBe('REAL')
  })
})
