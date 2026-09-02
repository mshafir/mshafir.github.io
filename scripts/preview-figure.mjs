#!/usr/bin/env node
/**
 * Render the figure to a PNG contact sheet at several angles.
 *
 * A dev aid for sculpting: a painter's-algorithm voxel render is far quicker to
 * iterate against than a full build plus a headless browser.
 *
 * Usage: node scripts/preview-figure.mjs [out.png]
 */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { buildFigure } from './lib/figure.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, process.argv[2] ?? 'figure-preview.png')

const TILE = 300
const SCALE = 6.2
const ANGLES = [-0.5, -0.18, 0, 0.5, 1.2, Math.PI]
const BG = [11, 14, 19]

// Brightness per cube face, so the blocks read as blocks.
const FACE_LIGHT = { front: 1, top: 1.18, side: 0.72, bottom: 0.5 }

function renderAngle(voxels, yaw) {
  const buf = Buffer.alloc(TILE * TILE * 3)
  for (let i = 0; i < TILE * TILE; i++) {
    buf[i * 3] = BG[0]
    buf[i * 3 + 1] = BG[1]
    buf[i * 3 + 2] = BG[2]
  }
  const depth = new Float32Array(TILE * TILE).fill(-Infinity)

  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const pitch = 0.12
  const cosP = Math.cos(pitch)
  const sinP = Math.sin(pitch)

  const projected = voxels.map(([x, y, z, r, g, b]) => {
    const rx = x * cos + z * sin
    const rz = -x * sin + z * cos
    const ry = y * cosP - rz * sinP
    const rzz = y * sinP + rz * cosP
    return { rx, ry, rz: rzz, r, g, b }
  })
  projected.sort((a, b) => a.rz - b.rz)

  const half = TILE / 2
  for (const v of projected) {
    const px = Math.round(half + v.rx * SCALE)
    const py = Math.round(half - (v.ry - 1) * SCALE)
    const size = Math.ceil(SCALE)
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const x = px + dx
        const y = py + dy
        if (x < 0 || y < 0 || x >= TILE || y >= TILE) continue
        const i = y * TILE + x
        if (depth[i] > v.rz) continue
        depth[i] = v.rz
        // Fake a lit top edge and a shaded left edge on each cube.
        const shade =
          dy === 0 ? FACE_LIGHT.top : dx === 0 ? FACE_LIGHT.side : FACE_LIGHT.front
        buf[i * 3] = Math.min(255, v.r * shade)
        buf[i * 3 + 1] = Math.min(255, v.g * shade)
        buf[i * 3 + 2] = Math.min(255, v.b * shade)
      }
    }
  }
  return buf
}

const figure = buildFigure()
console.log(`${figure.count} surface voxels`)

const tiles = await Promise.all(
  ANGLES.map(async (yaw) =>
    sharp(renderAngle(figure.voxels, yaw), { raw: { width: TILE, height: TILE, channels: 3 } })
      .png()
      .toBuffer(),
  ),
)

await sharp({
  create: {
    width: TILE * 3,
    height: TILE * 2,
    channels: 3,
    background: { r: BG[0], g: BG[1], b: BG[2] },
  },
})
  .composite(
    tiles.map((input, i) => ({
      input,
      left: (i % 3) * TILE,
      top: Math.floor(i / 3) * TILE,
    })),
  )
  .png()
  .toFile(out)

console.log('wrote', out)
