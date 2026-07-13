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

// Extract a registrable host from a domain, a match pattern, a full URL, OR a
// ModHeader-style regex. Examples that all yield "example.com":
//   "example.com" · "*://*.example.com/*" · "https://foo.com/bar" (-> "foo.com")
//   ".*\.example\.com.*" · "https?://(.*\.)?example\.com/.*"
// Returns null if no domain-like token is found.
export function extractDomain(pattern) {
  if (typeof pattern !== 'string') return null
  let s = pattern.trim()
  if (!s) return null
  s = s.replace(/\\/g, '') // drop regex escapes: \. -> .
  s = s.replace(/^[a-z?*]+:\/\//i, '') // strip scheme, incl "*://" and ModHeader "https?://"
  // Take the FIRST domain-like token (label(.label)+.tld). Not splitting on "/" or
  // "?" first — those appear as regex quantifiers in ModHeader patterns like
  // "https?://(.*\.)?example\.com/.*" and must not truncate the host.
  const m = s.toLowerCase().match(/([a-z0-9-]+\.)+[a-z]{2,}/)
  return m ? m[0] : null
}
