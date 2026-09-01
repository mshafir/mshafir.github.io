#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { voxelize } from './lib/voxelize.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(root, 'assets/source/headshot.png')
const OUTPUT = resolve(root, 'src/data/voxels.json')

const { data, info } = await sharp(await readFile(SOURCE))
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

// Tuning lives in voxelize.mjs DEFAULTS, so there is one place to change it.
const result = voxelize({ data, width: info.width, height: info.height })

if (result.count === 0) {
  console.error('Voxelizer produced no voxels — check the background tolerance.')
  process.exit(1)
}

await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, JSON.stringify(result))

const kb = (JSON.stringify(result).length / 1024).toFixed(1)
console.log(`Wrote ${result.count} voxels (${kb} KB) to src/data/voxels.json`)
