// Regenerate the file manifest at the end of vendor/carve-grammars/PROVENANCE.
//
// The prose header is written by hand and preserved; everything from the
// `# <state> <git blob sha1> <path>` marker down is replaced. Run this after
// refreshing the vendored copy or changing a vendor patch, and commit the
// result - engine-drift.yml reads it back, so a manifest nobody regenerates
// fails the build rather than drifting quietly.
//
// Usage: node tools/record-vendor-provenance.mjs <path-to-carve-grammars-checkout>
//
// The checkout is only used to decide `verbatim` vs `local` and must be at the
// commit named in the header.

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { argv, exit, stdout } from 'node:process'

const upstream = argv[2]
if (!upstream) {
  stdout.write('usage: node tools/record-vendor-provenance.mjs <path-to-carve-grammars-checkout>\n')
  exit(2)
}

const vendorDir = 'vendor/carve-grammars'
const provenancePath = join(vendorDir, 'PROVENANCE')
const marker = '# <state> <git blob sha1> <path>'

const existing = readFileSync(provenancePath, 'utf8')
const markerAt = existing.indexOf(marker)
if (markerAt === -1) {
  stdout.write(`${provenancePath} has no "${marker}" line; refusing to guess where the manifest starts\n`)
  exit(1)
}
const header = existing.slice(0, markerAt + marker.length)

const commit = /^commit\s+([0-9a-f]{40})$/m.exec(existing)?.[1]
if (!commit) {
  stdout.write(`${provenancePath} records no 40-hex commit\n`)
  exit(1)
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      out.push(...walk(path))
      continue
    }
    out.push(path)
  }
  return out
}

const hash = (path) => execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim()

const rows = walk(vendorDir)
  .map((path) => relative(vendorDir, path))
  .filter((path) => path !== 'PROVENANCE')
  .sort()
  .map((path) => {
    const local = hash(join(vendorDir, path))
    let upstreamHash = null
    try {
      upstreamHash = execFileSync('git', ['-C', upstream, 'rev-parse', `${commit}:${path}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      upstreamHash = null
    }
    const state = upstreamHash === local ? 'verbatim' : 'local'
    return `${state.padEnd(8)} ${local} ${path}`
  })

writeFileSync(provenancePath, `${header}\n${rows.join('\n')}\n`)
stdout.write(`recorded ${rows.length} files against carve-grammars ${commit}\n`)
