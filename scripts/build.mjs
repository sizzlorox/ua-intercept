// Cross-browser packager. Reads the Chrome manifest at repo root and emits
// dist/chrome/ and dist/firefox/ (source + the right manifest). No bundler —
// files are copied as-is (plain ES modules). Run: `node scripts/build.mjs [target]`
//   target: chrome | firefox | all (default all)
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = ['_locales', 'icons', 'src']

/**
 * Pure transform: Chrome manifest -> Firefox manifest. Kept side-effect-free so
 * it can be unit-tested.
 */
export function firefoxManifest(chrome) {
  const ff = structuredClone(chrome)
  delete ff.minimum_chrome_version // Chrome-only
  ff.browser_specific_settings = {
    gecko: {
      id: 'ua-intercept@sizzlorox.github.io',
      strict_min_version: '128.0',
      // AMO requires this key. The extension collects and transmits nothing.
      data_collection_permissions: { required: ['none'] },
    },
  }
  // Firefox MV3 uses an event-page background (module scripts), not a SW.
  if (ff.background && ff.background.service_worker) {
    ff.background = { scripts: [ff.background.service_worker], type: 'module' }
  }
  // Firefox prefers options_ui; keep it opening in a tab.
  if (ff.options_page) {
    ff.options_ui = { page: ff.options_page, open_in_tab: true }
    delete ff.options_page
  }
  return ff
}

function buildTarget(target, manifest) {
  const out = join(root, 'dist', target)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  for (const asset of ASSETS) cpSync(join(root, asset), join(out, asset), { recursive: true })
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  return out
}

function main() {
  const target = process.argv[2] || 'all'
  const chrome = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
  const targets = target === 'all' ? ['chrome', 'firefox'] : [target]
  for (const t of targets) {
    const manifest = t === 'firefox' ? firefoxManifest(chrome) : chrome
    const out = buildTarget(t, manifest)
    console.log(`built dist/${t}/  (${manifest.background.service_worker ? 'service_worker' : 'event-page'})`)
    void out
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
