#!/usr/bin/env node
/**
 * Build photo candidates from the iNaturalist API (research-grade observations, CC0 / CC BY / CC BY-SA photos only).
 * Output has the same shape as the open-data pipeline, so scripts/finalize-photos.py can consume it.
 *
 *   node scripts/fetch-candidates-api.mjs work/candidates.json [perSpecies=40]
 *
 * Be polite to the API: it is rate limited (~1 request/second). This script sleeps between calls.
 * Note: this script was written alongside the open-data pipeline but could not be run in the
 * environment where the bundled photos were produced (the API host was blocked there).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const names = JSON.parse(fs.readFileSync(path.join(here, 'species-inat.json'), 'utf8'))
const out = process.argv[2] ?? 'work/candidates.json'
const perSpecies = Number(process.argv[3] ?? 40)
const UA = 'mushroom-lookalikes photo pipeline (github.com/aes37/mushroom-id)'
const OK = { cc0: 'CC0', 'cc-by': 'CC-BY', 'cc-by-sa': 'CC-BY-SA' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  await sleep(1100)
  return res.json()
}

async function taxonId(name) {
  const j = await get(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&rank=species&per_page=5`)
  const hit = j.results.find((t) => t.name === name && t.is_active) ?? j.results.find((t) => t.name === name)
  return hit ? { id: hit.id, name: hit.name } : null
}

const result = {}
for (const [slug, candidates] of Object.entries(names)) {
  let taxon = null
  for (const n of candidates) {
    taxon = await taxonId(n)
    if (taxon) break
  }
  if (!taxon) {
    console.error(`no taxon for ${slug}`)
    continue
  }
  const list = []
  const seenObs = new Set()
  const perUser = {}
  for (let page = 1; page <= 4 && list.length < perSpecies; page++) {
    const j = await get(
      `https://api.inaturalist.org/v1/observations?taxon_id=${taxon.id}&quality_grade=research&photos=true&photo_license=cc0,cc-by,cc-by-sa&order_by=votes&order=desc&per_page=50&page=${page}`,
    )
    for (const o of j.results) {
      if (seenObs.has(o.uuid)) continue
      const login = o.user?.login ?? ''
      if ((perUser[login] ?? 0) >= 3) continue
      const p = o.photos?.find((ph) => OK[ph.license_code])
      if (!p) continue
      seenObs.add(o.uuid)
      perUser[login] = (perUser[login] ?? 0) + 1
      const ext = (p.url.match(/\.(jpe?g|png)(\?|$)/i)?.[1] ?? 'jpg').toLowerCase()
      list.push({
        photo_id: p.id,
        ext,
        license: OK[p.license_code],
        w: p.original_dimensions?.width ?? 0,
        h: p.original_dimensions?.height ?? 0,
        obs: o.uuid,
        observer_id: String(o.user?.id ?? ''),
        login,
        name: o.user?.name ?? '',
        observed_on: o.observed_on ?? '',
        position: 0,
        lat: '',
        lon: '',
      })
      if (list.length >= perSpecies) break
    }
    if (j.results.length < 50) break
  }
  result[slug] = list
  console.error(`${slug.padEnd(30)} ${taxon.name} (${taxon.id}): ${list.length} candidates`)
}
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(result, null, 1))
console.error(`wrote ${out}`)
