import { describe, it, expect } from 'vitest'
import { formatError } from '../../src/core/errors.js'

// stub i18n: substitutes $1/$2 like chrome.i18n
const messages = {
  errNameRequired: 'Name is required',
  errNewerVersion: 'This file is from a newer version',
  errProfileInvalid: 'Profile $1 is invalid: $2',
}
const getMessage = (key, subs) => {
  let m = messages[key] ?? key
  if (subs) subs.forEach((s, i) => (m = m.split('$' + (i + 1)).join(s)))
  return m
}

describe('formatError', () => {
  it('resolves a simple code', () => {
    expect(formatError({ code: 'errNewerVersion' }, getMessage)).toBe('This file is from a newer version')
  })
  it('resolves a nested { code, params: { reason } } error recursively', () => {
    const err = { code: 'errProfileInvalid', params: { index: 2, reason: { code: 'errNameRequired' } } }
    expect(formatError(err, getMessage)).toBe('Profile 2 is invalid: Name is required')
  })
  it('passes through a plain string and empty for nullish', () => {
    expect(formatError('legacy', getMessage)).toBe('legacy')
    expect(formatError(null, getMessage)).toBe('')
  })
})
