#!/usr/bin/env node
/**
 * Build src/data/voxels.json from content/figure/head.json.
 *
 * head.json holds what was extracted from a head scan (see extract-head.mjs):
 * landmarks and a smoothed shape. This draws the cartoon bust to those
 * measurements. No scan is needed, so it runs anywhere the repo does.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCaricature, shapeFrom } from './lib/caricature.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HEAD = resolve(root, 'content/figure/head.json')
const OUTPUT = resolve(root, process.argv[2] ?? 'src/data/voxels.json')

const { measurements, shape } = JSON.parse(await readFile(HEAD, 'utf8'))
const figure = buildCaricature(measurements, shapeFrom(shape, measurements.axis), {
  bounds: { x: 30, z: 28 },
})

if (figure.count === 0) {
  console.error('Figure builder produced no voxels.')
  process.exit(1)
}

await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, JSON.stringify(figure))
const kb = (JSON.stringify(figure).length / 1024).toFixed(1)
console.log(`Wrote ${figure.count} voxels (${kb} KB) to ${OUTPUT}`)
