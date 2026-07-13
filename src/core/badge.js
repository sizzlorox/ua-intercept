// Pure: derive the short toolbar-badge label from a profile name (like ModHeader's
// shortTitle). First two letters/digits, uppercased; falls back to "ON".
export function badgeText(name) {
  if (typeof name !== 'string') return 'ON'
  const alnum = name.replace(/[^\p{L}\p{N}]/gu, '')
  if (!alnum) return 'ON'
  return alnum.slice(0, 2).toUpperCase()
}
