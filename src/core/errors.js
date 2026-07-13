// Resolve a core error into a localized string. Core validators/parsers return
// stable { code, params? } errors (params.reason may itself be a nested error);
// the UI passes its i18n getMessage(key, subs) so this stays browser-free.
export function formatError(error, getMessage) {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (!error.params) return getMessage(error.code)
  const subs = Object.values(error.params).map((v) =>
    v && typeof v === 'object' && v.code ? formatError(v, getMessage) : String(v)
  )
  return getMessage(error.code, subs)
}
