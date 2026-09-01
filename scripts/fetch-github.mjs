#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { curate } from './lib/curate.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = resolve(root, 'content/projects.config.json')
const OUTPUT = resolve(root, 'src/data/projects.json')
const USER = 'mshafir'

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': `${USER}-site` }
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

const response = await fetch(
  `https://api.github.com/users/${USER}/repos?sort=pushed&per_page=100`,
  { headers },
)

// Exit without writing on failure: a network blip must never blank the
// committed artifact the build depends on.
if (!response.ok) {
  console.error(`GitHub API returned ${response.status} ${response.statusText}`)
  console.error('Leaving the existing src/data/projects.json untouched.')
  process.exit(1)
}

const config = JSON.parse(await readFile(CONFIG, 'utf8'))
const projects = curate(await response.json(), config)

await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, `${JSON.stringify(projects, null, 2)}\n`)

console.log(
  `Wrote ${projects.length} projects (${projects.filter((p) => p.featured).length} featured)`,
)
