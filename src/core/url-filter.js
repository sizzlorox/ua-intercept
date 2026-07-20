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
  s = s.toLowerCase()
  const m = s.match(/([a-z0-9-]+\.)+[a-z]{2,}/)
  if (m) return m[0]

  // An IPv4 literal has no alphabetic TLD, so the pattern above never matches one.
  const ip = s.match(/\d{1,3}(?:\.\d{1,3}){3}/)
  if (ip && ip[0].split('.').every((o) => Number(o) <= 255)) return ip[0]

  // A dotless host ("localhost", an intranet name). Only accepted when the whole host
  // section is a clean label — otherwise regex noise like ".*" would be read as a host.
  // Without this, scoping a profile to localhost fails CLOSED and silently kills it.
  const host = s.split(/[/:?#]/)[0]
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(host) ? host : null
}
