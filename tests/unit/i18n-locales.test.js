import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const localesDir = join(root, '_locales')

const en = JSON.parse(readFileSync(join(localesDir, 'en', 'messages.json'), 'utf8'))
const enKeys = Object.keys(en).sort()
const placeholderKeys = enKeys.filter((k) => en[k].placeholders)

const locales = readdirSync(localesDir).filter((d) => existsSync(join(localesDir, d, 'messages.json')))

describe('i18n locales', () => {
  it('has en plus at least 15 other locales', () => {
    expect(locales).toContain('en')
    expect(locales).toContain('zh_TW') // Traditional Chinese explicitly requested
    expect(locales.length).toBeGreaterThanOrEqual(16)
  })

  for (const loc of locales) {
    const msgs = JSON.parse(readFileSync(join(localesDir, loc, 'messages.json'), 'utf8'))

    it(`${loc}: has exactly the same keys as en`, () => {
      expect(Object.keys(msgs).sort()).toEqual(enKeys)
    })

    it(`${loc}: every message is a non-empty string`, () => {
      for (const k of enKeys) {
        expect(typeof msgs[k].message, `${loc}.${k}`).toBe('string')
        expect(msgs[k].message.length, `${loc}.${k}`).toBeGreaterThan(0)
      }
    })

    it(`${loc}: preserves placeholders and their tokens`, () => {
      for (const k of placeholderKeys) {
        expect(msgs[k].placeholders, `${loc}.${k}`).toEqual(en[k].placeholders)
        // the $token$ must survive translation so substitution still works
        for (const ph of Object.keys(en[k].placeholders)) {
          expect(msgs[k].message, `${loc}.${k}`).toContain(`$${ph}$`)
        }
      }
    })
  }
})
