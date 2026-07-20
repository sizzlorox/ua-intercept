import { getProfiles, setProfiles, getState, setState } from '../shared/storage.js'
import { PRESETS, presetById } from '../core/presets.js'
import { validateProfile, normalizeProfile } from '../core/schema.js'
import { buildRules } from '../core/dnr-rules.js'
import { effectiveUaPreview } from '../core/ua.js'
import { exportBundle, parseImport, mergeImport } from '../core/porting.js'
import { formatError } from '../core/errors.js'
import { t, localizeDom } from '../shared/i18n.js'

localizeDom()

let profiles = []
let activeId = null
let enabled = false
let draft = null // the profile currently in the form (a working copy)

const listEl = document.getElementById('profile-list')
const paneEl = document.getElementById('edit-pane')
// Snapshot of the empty edit pane, kept as nodes (not HTML) so restoring it never touches innerHTML.
const placeholderNodes = [...paneEl.childNodes].map((n) => n.cloneNode(true))
const restorePlaceholder = () => paneEl.replaceChildren(...placeholderNodes.map((n) => n.cloneNode(true)))

async function load() {
  let state
  ;[profiles, state] = await Promise.all([getProfiles(), getState()])
  activeId = state.activeProfileId
  enabled = state.enabled
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
    if (draft && draft.id === p.id) li.classList.add('editing')

    // checkbox = "this User-Agent is active". Only one can be, so checking one
    // deactivates the rest (a request sends a single User-Agent).
    const cb = el('input', { type: 'checkbox', class: 'active-cb', 'aria-label': t('activeProfile') + ': ' + p.name })
    cb.checked = enabled && p.id === activeId
    cb.addEventListener('change', () => toggleActive(p.id, cb.checked))

    const name = el('span', { class: 'pname', title: effectiveUaPreview(p) }, p.name || t('unnamed'))
    name.tabIndex = 0
    name.setAttribute('role', 'button')
    name.addEventListener('click', () => selectProfile(p.id))
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectProfile(p.id) }
    })

    const del = el('button', { class: 'del-x', title: t('btnDelete'), 'aria-label': t('btnDelete') + ': ' + p.name }, '✕')
    del.addEventListener('click', () => removeProfile(p.id))

    li.append(cb, name, del)
    listEl.append(li)
  }
}

async function toggleActive(id, checked) {
  const s = await getState()
  if (checked) {
    enabled = true
    activeId = id
    await setState({ ...s, enabled: true, activeProfileId: id })
  } else {
    enabled = false
    await setState({ ...s, enabled: false })
  }
  renderList()
}

async function removeProfile(id) {
  const p = profiles.find((x) => x.id === id)
  if (!p) return
  if (!confirm(t('confirmDelete', [p.name || t('unnamed')]))) return
  profiles = profiles.filter((x) => x.id !== id)
  if (activeId === id) {
    activeId = null
    enabled = false
    await setState({ ...(await getState()), enabled: false, activeProfileId: null })
  }
  if (draft && draft.id === id) {
    draft = null
    restorePlaceholder()
    localizeDom(paneEl)
  }
  await persist()
  renderList()
  toast(t('toastDeleted'))
}

function newProfile() {
  draft = normalizeProfile({
    id: crypto.randomUUID(),
    name: '',
    tokens: [{ value: '', enabled: true, mode: 'append' }],
    // Matches normalizeProfile's default and what applyPreset selects. The old
    // 'headers' default left navigator.userAgent reporting the real value, which
    // reads as "the extension is broken".
    spoofDepth: 'full',
    order: nextOrder(),
  })
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
  $('f-platform').value = draft.platform || ''
  $('f-mobile').checked = !!draft.mobile
  ;(draft.spoofDepth === 'headers' ? $('f-depth-headers') : $('f-depth-full')).checked = true
  $('f-include').value = (draft.includeUrls || []).join('\n')
  $('f-exclude').value = (draft.excludeUrls || []).join('\n')
  renderTokens($)

  $('f-add-token').addEventListener('click', () => {
    draft.tokens.push({ value: '', enabled: true, mode: 'append' })
    renderTokens($)
    const inputs = $('f-tokens').querySelectorAll('.tk-val')
    inputs[inputs.length - 1]?.focus()
  })
  presetSel.addEventListener('change', () => applyPreset(presetSel.value, $))
  paneEl.querySelector('#edit-form').addEventListener('submit', (e) => { e.preventDefault(); save($) })
  $('f-duplicate').addEventListener('click', () => duplicate())
  $('f-delete').addEventListener('click', () => del())
  $('f-name').focus()
}

// Render the token rows from draft.tokens; edits update draft.tokens live.
function renderTokens($) {
  const box = $('f-tokens')
  box.replaceChildren()
  draft.tokens.forEach((tk, idx) => {
    const cb = el('input', { type: 'checkbox', class: 'tk-en', 'aria-label': t('tokenEnabled') })
    cb.checked = tk.enabled !== false
    cb.addEventListener('change', () => (tk.enabled = cb.checked))

    const mode = el('select', { class: 'tk-mode', 'aria-label': t('tokenMode') })
    mode.append(new Option(t('tokenAppend'), 'append'), new Option(t('tokenReplace'), 'set'))
    mode.value = tk.mode === 'set' ? 'set' : 'append'
    mode.addEventListener('change', () => (tk.mode = mode.value))

    const val = el('input', { type: 'text', class: 'tk-val', 'aria-label': t('tokenValue'), autocomplete: 'off' })
    val.value = tk.value || ''
    val.addEventListener('input', () => (tk.value = val.value))

    const del = el('button', { type: 'button', class: 'tk-del', title: t('btnDelete'), 'aria-label': t('btnDelete') }, '✕')
    del.addEventListener('click', () => { draft.tokens.splice(idx, 1); renderTokens($) })

    const row = el('div', { class: 'token-row' })
    row.append(cb, mode, val, del)
    box.append(row)
  })
}

function applyPreset(id, $) {
  if (id === '__custom') { draft.presetId = null; draft.uaData = null; return }
  const preset = presetById(id)
  if (!preset) return
  draft.presetId = preset.id
  draft.uaData = preset.uaData
  if (!$('f-name').value.trim()) $('f-name').value = preset.label
  // a preset is a single "set" (switch-browser) token
  draft.tokens = [{ value: preset.userAgent, enabled: true, mode: 'set' }]
  draft.platform = preset.platform || ''
  $('f-platform').value = preset.platform || ''
  $('f-mobile').checked = !!preset.mobile
  ;($('f-depth-full')).checked = true
  renderTokens($)
}

async function save($) {
  draft.name = $('f-name').value.trim()
  draft.platform = $('f-platform').value.trim()
  draft.mobile = $('f-mobile').checked
  draft.spoofDepth = $('f-depth-headers').checked ? 'headers' : 'full'
  draft.presetId = $('f-preset').value === '__custom' ? null : $('f-preset').value
  draft.includeUrls = splitLines($('f-include').value)
  draft.excludeUrls = splitLines($('f-exclude').value)
  draft.tokens = (draft.tokens || []).filter((tk) => tk.value && tk.value.trim())

  const v = validateProfile(draft)
  if (!v.ok) { toast(formatError(v.error, t), true); return }
  // Saving a profile that yields no DNR rules is the single most confusing failure in
  // this extension: it activates, the badge lights, and nothing is spoofed. Keyed on
  // the rule output rather than on tokens — a full-depth uaData profile legitimately
  // has no UA token but still emits client-hint rules.
  if (buildRules(draft).length === 0) { toast(t('errUaRequired'), true); return }

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
  if (draft) await removeProfile(draft.id)
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
    const s = changes.state.newValue || {}
    activeId = s.activeProfileId ?? null
    enabled = !!s.enabled
    renderList()
  }
})

const reportErr = (e) => {
  console.error('[ua-intercept]', e)
  toast(String((e && e.message) || e), true)
}

document.getElementById('new-btn').addEventListener('click', newProfile)
document.getElementById('add-ua').addEventListener('click', newProfile)
document.getElementById('export-btn').addEventListener('click', () => doExport().catch(reportErr))
document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click())
document.getElementById('import-file').addEventListener('change', (e) => {
  const f = e.target.files[0]
  if (f) doImport(f).catch(reportErr)
  e.target.value = ''
})

load()
