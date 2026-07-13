// Compute the effective User-Agent modification from a profile's token list.
// Each token is { value, enabled, mode: 'append' | 'set' }.
//   - enabled 'set' tokens replace the UA (last one wins as the base)
//   - enabled 'append' tokens are appended (space-joined) to that base, or to
//     the browser's real UA when there is no set token
// Returns { mode: 'set' | 'append', value } or null when nothing is enabled.
export function effectiveUa(profile) {
  const tokens = Array.isArray(profile && profile.tokens) ? profile.tokens : []
  const enabled = tokens.filter((t) => t && t.enabled !== false && typeof t.value === 'string' && t.value.trim())
  const appends = enabled.filter((t) => t.mode !== 'set').map((t) => t.value.trim())
  const sets = enabled.filter((t) => t.mode === 'set').map((t) => t.value.trim())
  const setVal = sets.length ? sets[sets.length - 1] : null
  const appendVal = appends.join(' ')
  if (setVal !== null) return { mode: 'set', value: appendVal ? `${setVal} ${appendVal}` : setVal }
  if (appendVal) return { mode: 'append', value: appendVal }
  return null
}

/** Convenience for tests/UI: a plain string preview ("+append" prefixed when appending). */
export function effectiveUaPreview(profile, realUa = '<real UA>') {
  const e = effectiveUa(profile)
  if (!e) return realUa
  return e.mode === 'set' ? e.value : `${realUa} ${e.value}`
}
