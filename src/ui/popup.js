import { getState, setState, getProfiles, setProfiles, getUpdate, setUpdate } from '../shared/storage.js'
import { t, localizeDom } from '../shared/i18n.js'

const master = document.getElementById('master')
const masterLabel = document.getElementById('master-label')
const statusEl = document.getElementById('status')
const bannerEl = document.getElementById('update-banner')

localizeDom()

// Nudge a (throttled) update check, then show the cached result if one is pending.
chrome.runtime.sendMessage({ type: 'checkUpdate' }).catch(() => {})
renderUpdate()

async function renderUpdate() {
  bannerEl.replaceChildren()
  const u = await getUpdate()
  if (!u || !u.available || u.dismissedVersion === u.latest) return
  const box = el('div', { class: 'update' })
  box.append(el('span', {}, t('updateAvailable', [u.latest])))
  box.append(el('span', { class: 'spacer' }))
  if (u.url) {
    const a = el('a', { href: u.url, target: '_blank', rel: 'noreferrer' }, t('updateView'))
    box.append(a)
  }
  const dismiss = el('button', {}, t('updateDismiss'))
  dismiss.addEventListener('click', async () => {
    await setUpdate({ ...u, dismissedVersion: u.latest })
    renderUpdate()
  })
  box.append(dismiss)
  bannerEl.append(box)
}

async function render() {
  const [state, profiles] = await Promise.all([getState(), getProfiles()])
  master.checked = state.enabled
  masterLabel.textContent = state.enabled ? t('on') : t('off')

  const active = profiles.find((p) => p.id === state.activeProfileId) || null
  statusEl.replaceChildren()

  if (profiles.length === 0) {
    statusEl.append(el('p', { class: 'empty' }, t('noProfilesYet')))
    return
  }

  // Active card
  const card = el('div', { class: 'card' + (state.enabled && active ? '' : ' inactive') })
  if (active) {
    card.append(el('div', { class: 'name' }, active.name))
    const bits = [active.spoofDepth === 'full' ? t('depthFullShort') : t('depthHeadersShort')]
    if (active.mobile) bits.push(t('mobile'))
    card.append(el('div', { class: 'meta' }, bits.join(' · ')))
  } else {
    card.append(el('div', { class: 'meta' }, t('noActiveProfile')))
  }
  statusEl.append(card)

  // Spoof badges — what is actually being spoofed right now.
  const applied = state.enabled && active
  const full = applied && active.spoofDepth === 'full'
  const badges = el('div', { class: 'badges' })
  badges.append(el('span', { class: 'badge ' + (applied ? 'on' : 'off') }, (applied ? '✓ ' : '· ') + t('badgeHeader')))
  const navText = '· ' + t('badgeNavigator') + (applied && !full ? ` (${t('badgeReal')})` : '')
  badges.append(el('span', { class: 'badge ' + (full ? 'on' : 'off') }, (full ? '✓ ' + t('badgeNavigator') : navText)))
  statusEl.append(badges)

  // Switch profile
  const fs = el('fieldset')
  fs.append(el('legend', {}, t('activeProfile')))
  const list = el('ul', { class: 'profiles', role: 'radiogroup', 'aria-label': t('activeProfile') })
  for (const p of profiles) {
    const id = 'p-' + p.id
    const input = el('input', { type: 'radio', name: 'active', id, value: p.id })
    input.checked = p.id === state.activeProfileId
    input.addEventListener('change', () => selectProfile(p.id))
    const label = el('label', { for: id })
    label.append(input, document.createTextNode(p.name))
    const del = el('button', { class: 'del-x', title: t('btnDelete'), 'aria-label': t('btnDelete') + ': ' + p.name }, '✕')
    del.addEventListener('click', () => removeProfile(p.id))
    const li = el('li')
    li.append(label, del)
    list.append(li)
  }
  fs.append(list)
  statusEl.append(fs)
}

async function selectProfile(id) {
  await setState({ enabled: true, activeProfileId: id })
  master.checked = true
  masterLabel.textContent = t('on')
  render()
}

async function removeProfile(id) {
  const [state, profiles] = await Promise.all([getState(), getProfiles()])
  const p = profiles.find((x) => x.id === id)
  if (!p) return
  if (!confirm(t('confirmDelete', [p.name || t('unnamed')]))) return
  await setProfiles(profiles.filter((x) => x.id !== id))
  if (state.activeProfileId === id) await setState({ ...state, enabled: false, activeProfileId: null })
  render()
}

master.addEventListener('change', async () => {
  const state = await getState()
  await setState({ ...state, enabled: master.checked })
  masterLabel.textContent = master.checked ? t('on') : t('off')
  render()
})

document.getElementById('manage-btn').addEventListener('click', () => chrome.runtime.openOptionsPage())
document.getElementById('new-btn').addEventListener('click', () => {
  chrome.storage.local.set({ __openNew: Date.now() }).then(() => chrome.runtime.openOptionsPage())
})

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  if (text != null) node.textContent = text
  return node
}

render()
