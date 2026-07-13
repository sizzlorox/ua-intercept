// Thin async wrappers over chrome.storage.local. Keys: `profiles`, `state`.

const DEFAULT_STATE = { enabled: false, activeProfileId: null, checkUpdates: false }

export async function getProfiles() {
  const { profiles } = await chrome.storage.local.get('profiles')
  return Array.isArray(profiles) ? profiles : []
}

export async function setProfiles(profiles) {
  await chrome.storage.local.set({ profiles })
}

export async function getState() {
  const { state } = await chrome.storage.local.get('state')
  return { ...DEFAULT_STATE, ...(state && typeof state === 'object' ? state : {}) }
}

export async function setState(state) {
  await chrome.storage.local.set({ state })
}

/** Cached update-check result: { available, latest, url, checkedAt } | null. */
export async function getUpdate() {
  const { update } = await chrome.storage.local.get('update')
  return update && typeof update === 'object' ? update : null
}

export async function setUpdate(update) {
  await chrome.storage.local.set({ update: update || null })
}
