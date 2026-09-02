#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFigure } from './lib/figure.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(root, 'src/data/voxels.json')

const figure = buildFigure()

if (figure.count === 0) {
  console.error('Figure builder produced no voxels.')
  process.exit(1)
}

await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, JSON.stringify(figure))

const kb = (JSON.stringify(figure).length / 1024).toFixed(1)
console.log(`Wrote ${figure.count} surface voxels (${kb} KB) to src/data/voxels.json`)
