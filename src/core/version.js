// Pure semver-ish version comparison for the update check. No chrome.*.

export function normalizeVersion(v) {
  return String(v || '')
    .trim()
    .replace(/^v/i, '')
}

/** True if `latest` is strictly newer than `current` (numeric dotted compare). */
export function isNewerVersion(latest, current) {
  const a = parts(latest)
  const b = parts(current)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0
    const y = b[i] || 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

function parts(v) {
  return normalizeVersion(v)
    .split('.')
    .map((n) => parseInt(n, 10) || 0)
}
