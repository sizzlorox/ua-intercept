// Generates icons/16.png, 48.png, 128.png — a domino-mask glyph on a teal rounded
// square, rendered at SS× supersample and box-downsampled for antialiased edges
// that stay crisp down to 16px. Run: `node scripts/gen-icons.mjs`
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons')
const SS = 4

const TEAL = [46, 169, 175]
const TEAL_DK = [32, 130, 135]
const WHITE = [245, 250, 250]

// signed-distance to a rounded rectangle (all coords in 0..1, center-relative)
function sdRoundRect(px, py, cx, cy, hx, hy, r) {
  const qx = Math.abs(px - cx) - (hx - r)
  const qy = Math.abs(py - cy) - (hy - r)
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by)
}

// returns [r,g,b,a] (0..255) for a normalized point
function sample(x, y) {
  if (sdRoundRect(x, y, 0.5, 0.5, 0.5, 0.5, 0.2) > 0) return [0, 0, 0, 0]

  // domino mask: a wide band across the eyes with two eye holes cut out; the
  // outer ends angle downward (cat-eye) so it reads as a mask, not goggles.
  const eye = dist(x, y, 0.34, 0.5) < 0.088 || dist(x, y, 0.66, 0.5) < 0.088
  const droop = Math.abs(x - 0.5) * 0.28
  const inBand = sdRoundRect(x, y - droop, 0.5, 0.5, 0.4, 0.155, 0.13) < 0
  if (inBand && !eye) return [...WHITE, 255]

  // subtle radial vignette for a little depth
  const t = Math.min(dist(x, y, 0.5, 0.5) / 0.7, 1)
  const bg = TEAL.map((c, i) => Math.round(c + (TEAL_DK[i] - c) * t * 0.5))
  return [...bg, 255]
}

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (~c) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
function png(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [pr, pg, pb, pa] = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)
          const w = pa / 255
          r += pr * w; g += pg * w; b += pb * w; a += pa
        }
      }
      const i = y * (size * 4 + 1) + 1 + x * 4
      const aw = a > 0 ? a / 255 : 1
      raw[i] = Math.round(r / aw)
      raw[i + 1] = Math.round(g / aw)
      raw[i + 2] = Math.round(b / aw)
      raw[i + 3] = Math.round(a / (SS * SS))
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync(iconsDir, { recursive: true })
for (const s of [16, 48, 128]) {
  writeFileSync(join(iconsDir, `${s}.png`), png(s))
  console.log(`wrote icons/${s}.png (${s}x${s})`)
}
