import { getState, getProfiles, getUpdate, setUpdate } from '../shared/storage.js'
import { buildRules } from '../core/dnr-rules.js'
import { badgeText } from '../core/badge.js'
import { isNewerVersion, normalizeVersion } from '../core/version.js'

const OVERRIDE_ID = 'ua-override'
const OVERRIDE_JS = 'src/injected/override.js'

// Opt-in update check (default off). When on, asks GitHub's public Releases API
// for the latest tag once a day; sends no user data. Cleared when turned off.
const RELEASES_API = 'https://api.github.com/repos/sizzlorox/ua-intercept/releases/latest'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

async function checkForUpdate(force = false) {
  const state = await getState()
  if (!state.checkUpdates) {
    if (await getUpdate()) await setUpdate(null) // clear stale banner when disabled
    return
  }
  const cached = await getUpdate()
  if (!force && cached && cached.checkedAt && Date.now() - cached.checkedAt < CHECK_INTERVAL_MS) return
  try {
    const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return
    const data = await res.json()
    const latest = normalizeVersion(data.tag_name)
    if (!latest) return
    const current = chrome.runtime.getManifest().version
    await setUpdate({
      available: isNewerVersion(latest, current),
      latest,
      url: typeof data.html_url === 'string' ? data.html_url : '',
      checkedAt: Date.now(),
      // carry a prior dismissal forward so re-checking the same version stays hidden
      dismissedVersion: cached && cached.dismissedVersion === latest ? latest : null,
    })
  } catch (e) {
    console.warn('[ua-intercept] update check failed:', e)
  }
}

// DNR rules + the registered content script are a pure function of (state, profiles).
// applyState reconciles the real browser state to match — self-healing after the
// service worker is suspended and revived.
//
// Single-flight: overlapping triggers coalesce. If a change lands while a reconcile
// is running, we run exactly one more pass afterward (last stored state wins), so
// concurrent scripting calls never race and rapid writes can't leave stale rules.
let running = false
let rerun = false

export async function applyState() {
  if (running) {
    rerun = true
    return
  }
  running = true
  try {
    do {
      rerun = false
      try {
        await reconcile()
      } catch (e) {
        // A storage read (or any reconcile step) failing must not drop a pending
        // rerun or surface as an unhandled rejection — log and keep draining.
        console.warn('[ua-intercept] reconcile failed:', e)
      }
    } while (rerun)
  } finally {
    running = false
  }
}

async function reconcile() {
  const [state, profiles] = await Promise.all([getState(), getProfiles()])
  const active =
    state.enabled && state.activeProfileId
      ? profiles.find((p) => p.id === state.activeProfileId) || null
      : null
  const dnrOk = await applyDnr(active)
  const injOk = await applyInjection(active)
  applyBadge(active, dnrOk && injOk)
}

// Toolbar indicator: colored badge + tooltip while a profile is active; cleared when off.
// A RED badge means the profile is active but did not take effect. Every apply step
// swallows its own errors, so without this the badge would report success regardless.
function applyBadge(profile, ok = true) {
  try {
    if (profile) {
      chrome.action.setBadgeText({ text: badgeText(profile.name) })
      chrome.action.setBadgeBackgroundColor({ color: ok ? profile.color || '#2ea9af' : '#c0392b' })
      chrome.action.setBadgeTextColor?.({ color: '#ffffff' })
      const depth = chrome.i18n.getMessage(profile.spoofDepth === 'full' ? 'depthFullShort' : 'depthHeadersShort')
      const title = `${chrome.i18n.getMessage('extName')} — ${profile.name} · ${depth}`
      chrome.action.setTitle({ title: ok ? title : `${title} ⚠` })
    } else {
      chrome.action.setBadgeText({ text: '' })
      chrome.action.setTitle({ title: chrome.i18n.getMessage('extName') })
    }
  } catch (e) {
    console.warn('[ua-intercept] badge update failed:', e)
  }
}

async function applyDnr(profile) {
  try {
    const addRules = buildRules(profile)
    const existing = await chrome.declarativeNetRequest.getDynamicRules()
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map((r) => r.id),
      addRules,
    })
    // An active profile that produces no rules changes nothing — no enabled token, or
    // a URL scope that matches nothing. That is a misconfiguration, not a success.
    return !profile || addRules.length > 0
  } catch (e) {
    console.warn('[ua-intercept] DNR apply failed:', e)
    return false
  }
}

async function applyInjection(profile) {
  const wantFull = !!(profile && profile.spoofDepth === 'full')
  let isRegistered = false
  try {
    const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [OVERRIDE_ID] })
    isRegistered = registered.length > 0
  } catch {
    isRegistered = false
  }

  try {
    if (wantFull) {
      const script = {
        id: OVERRIDE_ID,
        world: 'MAIN',
        runAt: 'document_start',
        allFrames: true,
        matchOriginAsFallback: true,
        persistAcrossSessions: true,
        matches: ['<all_urls>'],
        js: [OVERRIDE_JS],
      }
      if (isRegistered) await chrome.scripting.updateContentScripts([script])
      else await chrome.scripting.registerContentScripts([script])
    } else if (isRegistered) {
      await chrome.scripting.unregisterContentScripts({ ids: [OVERRIDE_ID] })
    }
    return true
  } catch (e) {
    // Tolerate duplicate-id / nonexistent-id races; the next reconcile self-heals.
    console.warn('[ua-intercept] injection apply failed:', e)
    return false
  }
}

chrome.runtime.onInstalled.addListener(() => {
  applyState()
  checkForUpdate()
})
chrome.runtime.onStartup.addListener(() => {
  applyState()
  checkForUpdate()
})
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  // Only reconcile on the keys that actually drive behavior — ignore UI-only flags.
  if ('state' in changes || 'profiles' in changes) applyState()
  if ('state' in changes) checkForUpdate() // re-check (or clear) when the toggle flips
})

// Popup nudges a (throttled) check when it opens.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'checkUpdate') checkForUpdate()
  return false
})
