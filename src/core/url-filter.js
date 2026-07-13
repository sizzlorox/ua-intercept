// Map a profile's include/exclude URL patterns to DNR condition fields.
// Note: v1 scopes by DOMAIN only (requestDomains matches a domain + its
// subdomains). Full path/regex globbing is deferred — extract the host from
// whatever the user typed (bare domain, match pattern, or full URL).

export function urlFilterFrom(profile) {
  const cond = {}
  const incRaw = (profile && profile.includeUrls) || []
  const inc = toDomains(incRaw)
  const exc = toDomains(profile && profile.excludeUrls)
  if (inc.length) {
    cond.requestDomains = inc
  } else if (incRaw.length > 0) {
    // User asked to scope to specific URLs but none resolved to a domain. Fail
    // CLOSED (match nothing) rather than silently broadening to all sites.
    // invalid.invalid is a reserved TLD that never resolves.
    cond.requestDomains = ['invalid.invalid']
  }
  if (exc.length) cond.excludedRequestDomains = exc
  return cond
}

function toDomains(patterns) {
  if (!Array.isArray(patterns)) return []
  const out = []
  for (const raw of patterns) {
    const d = extractDomain(raw)
    if (d && !out.includes(d)) out.push(d)
  }
  return out
}

// "*://*.example.com/*" | "https://foo.com/bar" | "example.com" -> "example.com"
// Exported so importers can keep only filters that map cleanly to a domain.
export function extractDomain(pattern) {
  if (typeof pattern !== 'string') return null
  let s = pattern.trim()
  if (!s) return null
  s = s.replace(/^[a-z*]+:\/\//i, '') // strip scheme (incl "*://")
  s = s.split('/')[0] // drop path
  s = s.split('?')[0].split('#')[0]
  s = s.replace(/^\*+\.?/, '') // strip leading wildcard label ("*." or "*")
  s = s.replace(/:\d+$/, '') // strip :port
  s = s.toLowerCase()
  // A DNR requestDomain must be a canonical dotted host: no leftover wildcards, only
  // host chars, and at least one dot (drops bare words like "https" left by a regex).
  if (!s || s.includes('*') || !/^[a-z0-9.-]+$/.test(s) || !s.includes('.')) return null
  return s
}
