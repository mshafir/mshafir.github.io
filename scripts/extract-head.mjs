#!/usr/bin/env node
/**
 * Reduce the head scan in content/figure to content/figure/head.json.
 *
 * The scan is a Scaniverse export: a textured OBJ of head and one shoulder. It
 * stays on this machine (it is gitignored). What is committed is what this
 * script extracts from it: landmarks, and a smoothed symmetric radius per row
 * and bearing with a hair fraction alongside. That is all the caricature
 * needs (see lib/caricature.mjs and build-figure.mjs).
 *
 * The pose and the cranium fit below are for that particular scan, found by
 * eye against `node scripts/preview-figure.mjs --json`. A new scan means
 * re-tuning them; the landmarks are measured automatically.
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { carve, measure } from './lib/caricature.mjs'
import { clampHighlights, completeHead, loadMesh, mirrorBelow, solidOf, voxelize } from './lib/voxelize.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCAN = resolve(root, 'content/figure/scan.obj')
const OUTPUT = resolve(root, process.argv[2] ?? 'content/figure/head.json')

const deg = (d) => (d * Math.PI) / 180

const { mesh, texture } = await loadMesh(SCAN)

// Pose: the scan was taken with the head tipped forward and rolled a little.
let figure = voxelize(mesh, texture, {
  height: 60,
  yaw: deg(0),
  pitch: deg(-15),
  roll: deg(-10),
  // Scaniverse fills the gaps in its atlas with this grey.
  padding: [76, 76, 76],
})

// Head centre in that grid, measured from the per-row extents.
const HEAD = { x: 10, y: 40, z: -2 }

// Lose the ragged bottom edge of the shirt.
figure = { ...figure, voxels: figure.voxels.filter((v) => v[1] >= 6) }

// Only the left shoulder was captured; reflect it, and lose the stray edge.
figure = mirrorBelow(figure, { x: HEAD.x, belowY: 18, halfWidth: 22 })

// Grey-white glare on the crown.
figure = clampHighlights(figure, { aboveY: 46, maxLuma: 150, maxSpread: 40 })

// The crown and the back of the skull are missing from the scan. The
// ellipsoid sits back from the forehead so it never breaks through the skin.
// This also seals the interior, closing pinholes and the open bottom.
figure = completeHead(figure, {
  centre: [HEAD.x, HEAD.y, -4],
  radii: [17.5, 22, 17],
  aboveY: 46,
  behindZ: -6,
})

// From here on the photo texture is only consulted for the hairline and the
// glasses; the shape is smoothed and the rest is discarded.
const solid = solidOf(figure)
const m = measure(solid, figure.voxels, { axis: { x: HEAD.x, z: HEAD.z } })
const shape = carve(solid, figure.voxels, m, { fromY: m.chinY, toY: m.topY, exaggerate: 1.15 })

const head = { measurements: m, shape }
await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, JSON.stringify(head))
const kb = (JSON.stringify(head).length / 1024).toFixed(1)
console.log('landmarks', {
  chinY: m.chinY,
  mouthY: m.mouthY,
  noseY: m.noseY,
  noseZ: +m.noseZ.toFixed(1),
  glasses: { ...m.glasses, halfWidth: +m.glasses.halfWidth.toFixed(1) },
  topY: m.topY,
})
console.log(`Wrote head measurements (${kb} KB) to ${OUTPUT}`)
