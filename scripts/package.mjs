// Zips dist/chrome and dist/firefox for store upload. Run: `npm run package`
//
// Do NOT use PowerShell's Compress-Archive here: on Windows PowerShell 5.1 it
// writes "\" separators into entry names, which the zip spec forbids and AMO
// rejects ("Invalid file name in archive: icons\128.png"). web-ext writes "/".
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, copyFileSync, rmSync, mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

// v0.1.2 shipped to both stores built from a dirty tree, so the published bytes were
// not reproducible from the tag. Refuse by default; ALLOW_DIRTY=1 to override.
const dirty = execSync('git status --porcelain', { cwd: root }).toString().trim()
if (dirty && !process.env.ALLOW_DIRTY) {
  console.error(`refusing to package a dirty working tree:\n${dirty}\n\ncommit first, or set ALLOW_DIRTY=1`)
  process.exit(1)
}

for (const target of ['chrome', 'firefox']) {
  // web-ext names the artifact from the manifest, so both targets collide —
  // build each into its own temp dir, then copy out under a distinct name.
  const tmp = mkdtempSync(join(tmpdir(), `ua-pkg-${target}-`))
  // execSync (shell) rather than execFileSync: on Windows, Node refuses to spawn npx.cmd directly.
  execSync(`${npx} --yes web-ext build --source-dir dist/${target} --artifacts-dir "${tmp}"`, {
    cwd: root,
    stdio: 'ignore',
  })
  const built = readdirSync(tmp).find((f) => f.endsWith('.zip'))
  const out = join(root, `ua-intercept-${target}-v${version}.zip`)
  copyFileSync(join(tmp, built), out)
  rmSync(tmp, { recursive: true, force: true })
  console.log(`packaged ${out}`)
}
