import { urlFilterFrom } from './url-filter.js'
import { deriveClientHints } from './client-hints.js'
import { effectiveUa } from './ua.js'

// MUST include main_frame explicitly — omitting resourceTypes matches every type
// EXCEPT main_frame, silently skipping the top-level document (the request that
// matters most). See research.md / contracts/dnr-and-injection.md.
export const RESOURCE_TYPES = [
  'main_frame',
  'sub_frame',
  'script',
  'stylesheet',
  'image',
  'font',
  'xmlhttprequest',
  'media',
  'websocket',
  'ping',
  'other',
]

export const RULE_UA = 1
export const RULE_SERVER_TIMING = 2

/**
 * Build the DNR dynamic rules for an active profile.
 * Returns [] when profile is null/undefined (disabled / no active profile).
 */
export function buildRules(profile) {
  if (!profile) return []

  const eff = effectiveUa(profile) // { mode:'set'|'append', value } | null
  const requestHeaders = []
  if (eff) requestHeaders.push({ header: 'user-agent', operation: eff.mode, value: eff.value })

  const full = profile.spoofDepth === 'full'
  let injectConfig = null

  if (full) {
    const derived = deriveClientHints(profile, eff)
    requestHeaders.push(...derived.headerOps)
    injectConfig = derived.injectConfig
  }

  // Nothing to change (no enabled tokens and no client-hint ops) → no rules.
  if (!requestHeaders.length) return []

  const rules = [
    {
      id: RULE_UA,
      priority: 1,
      action: { type: 'modifyHeaders', requestHeaders },
      condition: { resourceTypes: RESOURCE_TYPES, ...urlFilterFrom(profile) },
    },
  ]

  if (full && injectConfig) {
    // Rule B: Server-Timing config channel, read synchronously at document_start.
    rules.push({
      id: RULE_SERVER_TIMING,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          {
            header: 'server-timing',
            operation: 'append',
            value: `uaint;desc="${encodeURIComponent(JSON.stringify(injectConfig))}"`,
          },
        ],
      },
      condition: { resourceTypes: ['main_frame', 'sub_frame'], ...urlFilterFrom(profile) },
    })
  }

  return rules
}
