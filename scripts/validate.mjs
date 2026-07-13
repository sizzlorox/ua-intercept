// Standalone repo sanity check for CI (no test framework needed):
// manifest validity, locale key parity, and icon presence.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const fail = (m) => problems.push(m)

// --- manifest ---
let manifest
try {
  manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
} catch (e) {
  fail(`manifest.json is not valid JSON: ${e.message}`)
}
if (manifest) {
  if (manifest.manifest_version !== 3) fail('manifest_version must be 3')
  for (const key of ['name', 'version', 'default_locale', 'background', 'action', 'icons']) {
    if (!(key in manifest)) fail(`manifest is missing "${key}"`)
  }
  if (manifest.default_locale !== 'en') fail('default_locale should be "en"')
}

// --- icons ---
for (const size of [16, 48, 128]) {
  const p = join(root, 'icons', `${size}.png`)
  if (!existsSync(p)) fail(`missing icons/${size}.png`)
  else {
    const b = readFileSync(p)
    if (b.slice(1, 4).toString() !== 'PNG') fail(`icons/${size}.png is not a PNG`)
  }
}

// --- locales ---
const localesDir = join(root, '_locales')
const enPath = join(localesDir, 'en', 'messages.json')
if (!existsSync(enPath)) fail('missing _locales/en/messages.json')
else {
  const en = JSON.parse(readFileSync(enPath, 'utf8'))
  const enKeys = Object.keys(en).sort()
  for (const loc of readdirSync(localesDir)) {
    const p = join(localesDir, loc, 'messages.json')
    if (!existsSync(p)) continue
    let m
    try {
      m = JSON.parse(readFileSync(p, 'utf8'))
    } catch (e) {
      fail(`_locales/${loc}/messages.json invalid JSON: ${e.message}`)
      continue
    }
    const keys = Object.keys(m).sort()
    if (JSON.stringify(keys) !== JSON.stringify(enKeys)) {
      const missing = enKeys.filter((k) => !keys.includes(k))
      const extra = keys.filter((k) => !enKeys.includes(k))
      fail(`_locales/${loc}: key mismatch (missing: ${missing.join(',') || 'none'}; extra: ${extra.join(',') || 'none'})`)
    }
    // Chrome caps the manifest description (__MSG_extDescription__) at 132 chars.
    const desc = m.extDescription && m.extDescription.message
    if (typeof desc === 'string' && desc.length > 132) {
      fail(`_locales/${loc}: extDescription is ${desc.length} chars (Chrome limit is 132)`)
    }
  }
}

if (problems.length) {
  console.error('Validation failed:\n' + problems.map((p) => '  - ' + p).join('\n'))
  process.exit(1)
}
console.log('Validation passed: manifest, icons, and all locales OK.')
