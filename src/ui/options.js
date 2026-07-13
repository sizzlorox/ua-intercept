import { getProfiles, setProfiles, getState, setState } from '../shared/storage.js'
import { PRESETS, presetById } from '../core/presets.js'
import { validateProfile, normalizeProfile } from '../core/schema.js'
import { exportBundle, parseImport, mergeImport } from '../core/porting.js'
import { formatError } from '../core/errors.js'
import { t, localizeDom } from '../shared/i18n.js'

localizeDom()

let profiles = []
let activeId = null
let draft = null // the profile currently in the form (a working copy)

const listEl = document.getElementById('profile-list')
const paneEl = document.getElementById('edit-pane')
const placeholderHTML = paneEl.innerHTML

async function load() {
  let state
  ;[profiles, state] = await Promise.all([getProfiles(), getState()])
  activeId = state.activeProfileId
  profiles = profiles.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  renderList()

  const updates = document.getElementById('check-updates')
  updates.checked = !!state.checkUpdates
  updates.addEventListener('change', async () => {
    await setState({ ...(await getState()), checkUpdates: updates.checked })
  })

  // Popup's "New" button sets a flag; honor it once.
  const { __openNew } = await chrome.storage.local.get('__openNew')
  if (__openNew) {
    await chrome.storage.local.remove('__openNew')
    newProfile()
  }
}

function renderList() {
  listEl.replaceChildren()
  for (const p of profiles) {
    const li = document.createElement('li')
    if (draft && draft.id === p.id) li.classList.add('active')

    const dot = el('span', { class: 'dot' }, p.id === activeId ? '●' : '○')
    const name = el('span', { class: 'pname' }, p.name || t('unnamed'))
    name.tabIndex = 0
    name.setAttribute('role', 'button')
    name.addEventListener('click', () => selectProfile(p.id))
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectProfile(p.id) }
    })

    const ord = el('span', { class: 'ord' })
    const up = el('button', { class: 'icon', title: t('moveUp'), 'aria-label': t('moveUp') + ': ' + p.name }, '▲')
    const down = el('button', { class: 'icon', title: t('moveDown'), 'aria-label': t('moveDown') + ': ' + p.name }, '▼')
    up.addEventListener('click', () => move(p.id, -1))
    down.addEventListener('click', () => move(p.id, 1))
    ord.append(up, down)

    li.append(dot, name, ord)
    listEl.append(li)
  }
}

function newProfile() {
  draft = normalizeProfile({ id: crypto.randomUUID(), name: '', userAgent: '', spoofDepth: 'full', order: nextOrder() })
  renderForm()
}

function selectProfile(id) {
  const p = profiles.find((x) => x.id === id)
  if (!p) return
  draft = normalizeProfile({ ...p })
  renderForm()
  renderList()
}

function renderForm() {
  const tpl = document.getElementById('edit-template').content.cloneNode(true)
  paneEl.replaceChildren(tpl)

  localizeDom(paneEl)
  const $ = (id) => paneEl.querySelector('#' + id)
  const presetSel = $('f-preset')
  presetSel.append(new Option(t('presetCustom'), '__custom'))
  for (const p of PRESETS) presetSel.append(new Option(p.label, p.id))
  presetSel.value = draft.presetId || '__custom'

  $('f-name').value = draft.name
  $('f-ua').value = draft.userAgent
  $('f-platform').value = draft.platform || ''
  $('f-mobile').checked = !!draft.mobile
  ;(draft.spoofDepth === 'headers' ? $('f-depth-headers') : $('f-depth-full')).checked = true
  $('f-include').value = (draft.includeUrls || []).join('\n')
  $('f-exclude').value = (draft.excludeUrls || []).join('\n')

  presetSel.addEventListener('change', () => applyPreset(presetSel.value, $))
  paneEl.querySelector('#edit-form').addEventListener('submit', (e) => { e.preventDefault(); save($) })
  $('f-duplicate').addEventListener('click', () => duplicate())
  $('f-delete').addEventListener('click', () => del())
  $('f-name').focus()
}

function applyPreset(id, $) {
  if (id === '__custom') { draft.presetId = null; draft.uaData = null; return }
  const preset = presetById(id)
  if (!preset) return
  draft.presetId = preset.id
  draft.uaData = preset.uaData
  if (!$('f-name').value.trim()) $('f-name').value = preset.label
  $('f-ua').value = preset.userAgent
  $('f-platform').value = preset.platform || ''
  $('f-mobile').checked = !!preset.mobile
}

async function save($) {
  draft.name = $('f-name').value.trim()
  draft.userAgent = $('f-ua').value.trim()
  draft.platform = $('f-platform').value.trim()
  draft.mobile = $('f-mobile').checked
  draft.spoofDepth = $('f-depth-headers').checked ? 'headers' : 'full'
  draft.presetId = $('f-preset').value === '__custom' ? null : $('f-preset').value
  draft.includeUrls = splitLines($('f-include').value)
  draft.excludeUrls = splitLines($('f-exclude').value)

  const v = validateProfile(draft)
  if (!v.ok) { toast(formatError(v.error, t), true); return }

  const i = profiles.findIndex((p) => p.id === draft.id)
  if (i >= 0) profiles[i] = { ...draft }
  else profiles.push({ ...draft })
  await persist()
  toast(t('toastSaved'))
  renderList()
}

async function duplicate() {
  if (!draft) return
  const copy = normalizeProfile({ ...draft, id: crypto.randomUUID(), name: (draft.name || 'Profile') + ' ' + t('copySuffix'), order: nextOrder() })
  profiles.push(copy)
  await persist()
  selectProfile(copy.id)
  toast(t('toastDuplicated'))
}

async function del() {
  if (!draft) return
  if (!confirm(t('confirmDelete', [draft.name || t('unnamed')]))) return
  profiles = profiles.filter((p) => p.id !== draft.id)
  if (activeId === draft.id) { activeId = null; await setState({ enabled: false, activeProfileId: null }) }
  draft = null
  await persist()
  paneEl.innerHTML = placeholderHTML
  localizeDom(paneEl)
  renderList()
  toast(t('toastDeleted'))
}

async function move(id, dir) {
  const i = profiles.findIndex((p) => p.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= profiles.length) return
  ;[profiles[i], profiles[j]] = [profiles[j], profiles[i]]
  profiles.forEach((p, k) => (p.order = k))
  await persist()
  renderList()
}

async function doExport() {
  const bundle = exportBundle(profiles)
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `ua-intercept-profiles-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast(t('toastExported', [String(profiles.length)]))
}

async function doImport(file) {
  const text = await file.text()
  const parsed = parseImport(text)
  if (!parsed.ok) { toast(formatError(parsed.error, t), true); return }
  const added = mergeImport(parsed.profiles, profiles)
  let order = nextOrder()
  for (const p of added) p.order = order++
  profiles.push(...added)
  await persist()
  renderList()
  toast(t('toastImported', [String(added.length)]))
}

async function persist() {
  profiles = profiles.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  await setProfiles(profiles)
}

function nextOrder() {
  return profiles.length ? Math.max(...profiles.map((p) => p.order ?? 0)) + 1 : 0
}

function splitLines(s) {
  return s.split('\n').map((x) => x.trim()).filter(Boolean)
}

let toastTimer
function toast(msg, isError = false) {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.classList.toggle('error', isError)
  t.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500)
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  if (text != null) node.textContent = text
  return node
}

// Keep the in-memory list fresh if another options tab/window (or the popup) writes.
// Mitigates lost updates: a later save/persist here operates on the current set.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes.profiles) {
    profiles = (changes.profiles.newValue || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    renderList()
  }
  if (changes.state) {
    activeId = changes.state.newValue ? changes.state.newValue.activeProfileId ?? null : null
    renderList()
  }
})

const reportErr = (e) => {
  console.error('[ua-intercept]', e)
  toast(String((e && e.message) || e), true)
}

document.getElementById('new-btn').addEventListener('click', newProfile)
document.getElementById('export-btn').addEventListener('click', () => doExport().catch(reportErr))
document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click())
document.getElementById('import-file').addEventListener('change', (e) => {
  const f = e.target.files[0]
  if (f) doImport(f).catch(reportErr)
  e.target.value = ''
})

load()
