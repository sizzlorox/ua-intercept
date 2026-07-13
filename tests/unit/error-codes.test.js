import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Guards that every err* code returned by the core actually has an en locale key,
// so a validation/import failure never shows a raw code to the user.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const en = JSON.parse(readFileSync(join(root, '_locales', 'en', 'messages.json'), 'utf8'))

const sources = ['src/core/schema.js', 'src/core/porting.js'].map((f) =>
  readFileSync(join(root, f), 'utf8')
)
const emitted = new Set()
for (const src of sources) {
  for (const m of src.matchAll(/['"](err[A-Z][A-Za-z0-9]*)['"]/g)) emitted.add(m[1])
}

describe('error-code coverage', () => {
  it('emits at least the known error codes', () => {
    expect(emitted.size).toBeGreaterThanOrEqual(8)
  })
  it('every emitted err* code has an en message', () => {
    for (const code of emitted) {
      expect(en[code], `missing en message for ${code}`).toBeTruthy()
    }
  })
})
