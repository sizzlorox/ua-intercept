// Pure shape definitions + validators. No chrome.* here.

export const SPOOF_DEPTHS = ['headers', 'full']

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp("[\u0000-\u001f\u007f]")

// Errors are returned as { code, params? } so the UI can localize them; core stays
// browser-free. `code` matches an i18n message key.
function err(code, params) {
  return { ok: false, error: params ? { code, params } : { code } }
}

export const TOKEN_MODES = ['append', 'set']

/** @returns {{ok: true} | {ok: false, error: {code: string, params?: object}}} */
export function validateProfile(p) {
  if (!p || typeof p !== 'object') return err('errNotObject')
  if (typeof p.name !== 'string' || p.name.trim() === '') return err('errNameRequired')
  if (!SPOOF_DEPTHS.includes(p.spoofDepth)) return err('errDepth')
  if (p.includeUrls != null && !isStringArray(p.includeUrls)) return err('errIncludeType')
  if (p.excludeUrls != null && !isStringArray(p.excludeUrls)) return err('errExcludeType')
  // Tokens hold the User-Agent value(s). Control chars in any of them make the
  // whole DNR batch reject on activation, so forbid them.
  if (p.tokens != null) {
    if (!Array.isArray(p.tokens)) return err('errNotObject')
    for (const tk of p.tokens) {
      if (!tk || typeof tk.value !== 'string') return err('errNotObject')
      if (CONTROL_CHARS.test(tk.value)) return err('errUaControl')
    }
  }
  // uaData strings become sec-ch-ua* header values; same control-char hazard.
  if (uaDataHasControl(p.uaData)) return err('errUaControl')
  return { ok: true }
}

function uaDataHasControl(uaData) {
  if (!uaData || typeof uaData !== 'object') return false
  const strings = [uaData.platformVersion, uaData.chPlatform, uaData.architecture, uaData.bitness, uaData.model]
  for (const list of [uaData.brands, uaData.fullVersionList]) {
    if (Array.isArray(list)) for (const b of list) strings.push(b && b.brand, b && b.version)
  }
  return strings.some((s) => typeof s === 'string' && CONTROL_CHARS.test(s))
}

/** @returns {{ok: true} | {ok: false, error: string}} */
export function validateState(s) {
  if (!s || typeof s !== 'object') return { ok: false, error: 'not an object' }
  if (typeof s.enabled !== 'boolean') return { ok: false, error: 'enabled must be boolean' }
  if (s.activeProfileId != null && typeof s.activeProfileId !== 'string') {
    return { ok: false, error: 'activeProfileId must be string or null' }
  }
  return { ok: true }
}

function isStringArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/** Fill a partial profile with safe defaults and coerce loose (e.g. imported) fields.
 * Migrates the legacy single `userAgent` string to a one-token `set` list. */
export function normalizeProfile(p) {
  const merged = {
    spoofDepth: 'full',
    presetId: null,
    platform: '',
    mobile: false,
    uaData: null,
    tokens: undefined,
    includeUrls: [],
    excludeUrls: [],
    color: '#2ea9af',
    order: 0,
    ...p,
  }
  merged.mobile = !!merged.mobile
  merged.platform = typeof merged.platform === 'string' ? merged.platform : ''
  merged.includeUrls = isStringArray(merged.includeUrls) ? merged.includeUrls : []
  merged.excludeUrls = isStringArray(merged.excludeUrls) ? merged.excludeUrls : []
  merged.tokens = normalizeTokens(merged.tokens, merged.userAgent)
  delete merged.userAgent // superseded by tokens
  return merged
}

export function normalizeTokens(tokens, legacyUserAgent) {
  if (!Array.isArray(tokens)) {
    // migrate a legacy single userAgent -> one "set" token
    if (typeof legacyUserAgent === 'string' && legacyUserAgent.trim()) {
      return [{ value: legacyUserAgent, enabled: true, mode: 'set' }]
    }
    return []
  }
  return tokens
    .filter((t) => t && typeof t.value === 'string')
    .map((t) => ({
      value: t.value,
      enabled: t.enabled !== false,
      mode: t.mode === 'set' ? 'set' : 'append',
    }))
}
