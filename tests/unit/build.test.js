import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { firefoxManifest } from '../../scripts/build.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const chrome = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))

describe('firefoxManifest transform', () => {
  const ff = firefoxManifest(chrome)

  it('keeps shared fields identical (single-sourced)', () => {
    expect(ff.version).toBe(chrome.version)
    expect(ff.permissions).toEqual(chrome.permissions)
    expect(ff.host_permissions).toEqual(chrome.host_permissions)
    expect(ff.default_locale).toBe('en')
  })

  it('adds gecko settings and drops Chrome-only fields', () => {
    expect(ff.browser_specific_settings.gecko.id).toMatch(/@/)
    expect(ff.browser_specific_settings.gecko.strict_min_version).toBeTruthy()
    expect('minimum_chrome_version' in ff).toBe(false)
  })

  it('declares no data collection (AMO requires the key)', () => {
    expect(ff.browser_specific_settings.gecko.data_collection_permissions).toEqual({ required: ['none'] })
  })

  it('converts the service worker to an event-page module background', () => {
    expect(ff.background.service_worker).toBeUndefined()
    expect(ff.background.scripts).toEqual([chrome.background.service_worker])
    expect(ff.background.type).toBe('module')
  })

  it('uses options_ui instead of options_page', () => {
    expect('options_page' in ff).toBe(false)
    expect(ff.options_ui.page).toBe(chrome.options_page)
    expect(ff.options_ui.open_in_tab).toBe(true)
  })

  it('does not mutate the input', () => {
    expect(chrome.background.service_worker).toBeTruthy()
    expect('options_page' in chrome).toBe(true)
  })
})
