import { validateProfile, normalizeProfile } from './schema.js'
import { presetById } from './presets.js'
import { extractDomain } from './url-filter.js'

export const FORMAT_VERSION = 1

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
  for (let i = 0; i < data.profiles.length; i++) {
    const v = validateProfile(data.profiles[i])
    // reason is itself a { code } error, resolved recursively by the UI's formatError.
    if (!v.ok) return { ok: false, error: { code: 'errProfileInvalid', params: { index: i + 1, reason: v.error } } }
  }
  return { ok: true, profiles: data.profiles.map(normalizeProfile) }
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
    const profiles = mh.map(fromModHeaderProfile).filter(Boolean)
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

// Convert one ModHeader profile to a UA Intercept profile, or null if it has no
// active User-Agent header (nothing for us to import). ModHeader is header-only,
// so imported profiles default to `headers` depth. id is left unset — mergeImport
// assigns one. URL filters are kept only where they map cleanly to a domain
// (ModHeader uses regex; our v1 is domain-scoped), so imports never fail closed.
function fromModHeaderProfile(mh) {
  if (!mh || typeof mh !== 'object') return null
  const headers = Array.isArray(mh.headers) ? mh.headers : []
  const ua = headers.find(
    (h) => h && h.enabled !== false && typeof h.name === 'string' && h.name.toLowerCase() === 'user-agent' && h.value
  )
  if (!ua) return null
  // color/backgroundColor is often absent (ModHeader only exports styles on request)
  // -> undefined here, normalizeProfile supplies the default. The UA value may be a
  // ModHeader template like "{{uuid}}"; imported verbatim (the user's own data).
  // Current exports use urlFilters/excludeUrlFilters; older ones use a single `filters`.
  return normalizeProfile({
    name: (typeof mh.title === 'string' && mh.title.trim()) || 'Imported profile',
    userAgent: String(ua.value),
    spoofDepth: 'headers',
    presetId: null,
    color: typeof mh.backgroundColor === 'string' ? mh.backgroundColor : undefined,
    includeUrls: mapFilters([...toArray(mh.urlFilters), ...toArray(mh.filters)]),
    excludeUrls: mapFilters(mh.excludeUrlFilters),
  })
}

function toArray(v) {
  return Array.isArray(v) ? v : []
}

// ModHeader filter items may be strings or objects; keep only those that reduce
// to a real domain (drop complex regexes rather than silently matching nothing).
function mapFilters(filters) {
  if (!Array.isArray(filters)) return []
  const out = []
  for (const item of filters) {
    const raw = typeof item === 'string' ? item : item && (item.urlRegex || item.url || item.value || item.pattern)
    if (typeof raw === 'string' && raw && extractDomain(raw) && !out.includes(raw)) out.push(raw)
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
