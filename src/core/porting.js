import { validateProfile, normalizeProfile } from './schema.js'
import { presetById } from './presets.js'
import { extractDomain } from './url-filter.js'

// v2 stores a per-profile `tokens` list; v1 stored a single `userAgent` string.
// normalizeProfile migrates v1 -> v2 on import, so we accept both.
export const FORMAT_VERSION = 2

/** Serialize every stored profile field (incl. uaData) into a versioned bundle. */
export function exportBundle(profiles) {
  return {
    formatVersion: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    profiles: profiles.map(normalizeProfile),
  }
}

/**
 * Validate an import file's text.
 * @returns {{ok:true, profiles: object[]} | {ok:false, error:string}}
 * Atomic: any invalid profile rejects the whole file.
 */
export function parseBundle(jsonText) {
  let data
  try {
    data = JSON.parse(jsonText)
  } catch {
    return { ok: false, error: { code: 'errBadJson' } }
  }
  if (!data || typeof data !== 'object' || typeof data.formatVersion !== 'number') {
    return { ok: false, error: { code: 'errUnrecognized' } }
  }
  if (data.formatVersion > FORMAT_VERSION) {
    return { ok: false, error: { code: 'errNewerVersion' } }
  }
  if (!Array.isArray(data.profiles)) {
    return { ok: false, error: { code: 'errNoProfiles' } }
  }
  // Normalize FIRST, then validate — so a migrated v1 `userAgent` (now a token) is
  // control-char checked like any other. Validating the raw profile would skip it.
  const profiles = data.profiles.map(normalizeProfile)
  for (let i = 0; i < profiles.length; i++) {
    const v = validateProfile(profiles[i])
    // reason is itself a { code } error, resolved recursively by the UI's formatError.
    if (!v.ok) return { ok: false, error: { code: 'errProfileInvalid', params: { index: i + 1, reason: v.error } } }
  }
  return { ok: true, profiles }
}

/**
 * Format-detecting import: accepts either our own bundle (has `formatVersion`)
 * or a ModHeader export (a profile object, an array of them, or `{profile}`).
 * @returns {{ok:true, profiles: object[], source: 'ua-intercept'|'modheader'} | {ok:false, error:{code:string,params?:object}}}
 */
export function parseImport(jsonText) {
  let data
  try {
    data = JSON.parse(jsonText)
  } catch {
    return { ok: false, error: { code: 'errBadJson' } }
  }
  if (data && typeof data === 'object' && typeof data.formatVersion === 'number') {
    const r = parseBundle(jsonText)
    return r.ok ? { ...r, source: 'ua-intercept' } : r
  }
  const mh = modHeaderProfiles(data)
  if (mh) {
    const profiles = mh.flatMap(modHeaderToProfiles)
    if (!profiles.length) return { ok: false, error: { code: 'errNoProfiles' } }
    // Validate like the bundle path — a ModHeader UA with control chars would
    // otherwise poison the DNR batch on activation.
    for (let i = 0; i < profiles.length; i++) {
      const v = validateProfile(profiles[i])
      if (!v.ok) return { ok: false, error: { code: 'errProfileInvalid', params: { index: i + 1, reason: v.error } } }
    }
    return { ok: true, profiles, source: 'modheader' }
  }
  return { ok: false, error: { code: 'errUnrecognized' } }
}

// Normalize the various ModHeader export shapes to a flat array of MH profiles.
function modHeaderProfiles(data) {
  if (Array.isArray(data) && data.every((d) => d && typeof d === 'object')) return data
  if (data && typeof data === 'object') {
    if (data.profile) return [].concat(data.profile)
    if (Array.isArray(data.headers) || 'title' in data || 'version' in data) return [data]
  }
  return null
}

// Convert ONE ModHeader profile to ONE UA Intercept profile. Its User-Agent
// header rows (enabled AND disabled) become the profile's token list, preserving
// each row's enabled state and append/set mode — mirroring how a ModHeader profile
// groups several toggleable UA tokens. Returns [] if there is no User-Agent header.
// ModHeader is header-only, so depth defaults to `headers`; id is left unset
// (mergeImport assigns one). URL filters carry over to the profile.
function modHeaderToProfiles(mh) {
  if (!mh || typeof mh !== 'object') return []
  const headers = Array.isArray(mh.headers) ? mh.headers : []
  const tokens = headers
    .filter((h) => h && typeof h.name === 'string' && h.name.toLowerCase() === 'user-agent' && h.value)
    .map((h) => ({
      value: String(h.value),
      enabled: h.enabled !== false,
      // ModHeader appendMode "append" -> append; anything else (false/override) -> set
      mode: h.appendMode === 'append' ? 'append' : 'set',
    }))
  if (!tokens.length) return []

  const title = (typeof mh.title === 'string' && mh.title.trim()) || 'Imported profile'
  const color = typeof mh.backgroundColor === 'string' ? mh.backgroundColor : undefined
  return [
    normalizeProfile({
      name: title,
      tokens,
      spoofDepth: 'headers',
      presetId: null,
      color,
      includeUrls: mapFilters([...toArray(mh.urlFilters), ...toArray(mh.filters)]),
      excludeUrls: mapFilters(mh.excludeUrlFilters),
    }),
  ]
}

function toArray(v) {
  return Array.isArray(v) ? v : []
}

// ModHeader filter items may be strings or objects; ModHeader uses regex, so we
// extract the domain (our v1 filters are domain-scoped) and store the clean
// domain. Entries that don't resolve to a domain are dropped.
function mapFilters(filters) {
  if (!Array.isArray(filters)) return []
  const out = []
  for (const item of filters) {
    const raw = typeof item === 'string' ? item : item && (item.urlRegex || item.url || item.value || item.pattern)
    const domain = extractDomain(raw)
    if (domain && !out.includes(domain)) out.push(domain)
  }
  return out
}

/**
 * Prepare validated imported profiles for merge into the existing set.
 * Preserves each id; reassigns a fresh id ONLY on collision with an existing profile.
 * Re-derives uaData from presetId when absent (so full-spoof survives round-trip).
 * @param newId optional id generator (defaults to crypto.randomUUID) — injectable for tests.
 */
export function mergeImport(imported, existing = [], newId = () => crypto.randomUUID()) {
  const taken = new Set(existing.map((p) => p.id))
  return imported.map((p) => {
    const out = { ...p }
    if (!out.id || taken.has(out.id)) out.id = newId()
    taken.add(out.id)
    if (out.uaData == null && out.presetId) {
      const preset = presetById(out.presetId)
      if (preset && preset.uaData) out.uaData = preset.uaData
    }
    return out
  })
}
