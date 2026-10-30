import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SPECIES } from '../data/species.js';
import { PAIRS } from '../data/pairs.js';
import { PHOTOS } from '../data/photos.js';
import { ROUND_SIZE, addDays, buildRound, dailySeed, EPOCH } from '../js/game.js';

const EDIBILITY = new Set(['edible', 'inedible', 'toxic', 'deadly']);
const LICENSES = new Set(['CC0', 'CC-BY', 'CC-BY-SA']);
const MIN_PHOTOS = 4;

test('species entries are complete', () => {
  for (const [key, s] of Object.entries(SPECIES)) {
    assert.ok(s.name && s.sci, `${key} needs name and sci`);
    assert.ok(EDIBILITY.has(s.edibility), `${key} has bad edibility ${s.edibility}`);
  }
});

test('pairs reference known species and carry a tip with sources', () => {
  const ids = new Set();
  for (const p of PAIRS) {
    assert.ok(!ids.has(p.id), `duplicate pair id ${p.id}`);
    ids.add(p.id);
    assert.ok(SPECIES[p.a] && SPECIES[p.b], `${p.id} references unknown species`);
    assert.notEqual(p.a, p.b);
    assert.ok(p.tip && p.tip.length > 40, `${p.id} needs a tip`);
    assert.ok(p.sources?.length, `${p.id} needs sources`);
    for (const s of p.sources) assert.match(s.url, /^https:\/\//, `${p.id} source url`);
  }
  assert.ok(PAIRS.length >= ROUND_SIZE, 'enough pairs for a round without repeats');
});

test('every species in a pair has enough openly licensed photos on disk', () => {
  const seen = new Set();
  const used = new Set(PAIRS.flatMap((p) => [p.a, p.b]));
  for (const key of used) {
    const photos = PHOTOS[key] ?? [];
    assert.ok(photos.length >= MIN_PHOTOS, `${key} has only ${photos.length} photos`);
    for (const ph of photos) {
      assert.ok(!seen.has(ph.id), `photo ${ph.id} used twice`);
      seen.add(ph.id);
      assert.ok(LICENSES.has(ph.license), `photo ${ph.id} has license ${ph.license}`);
      assert.ok(ph.by && ph.taxon, `photo ${ph.id} needs attribution and taxon`);
      assert.ok(existsSync(new URL(`../img/${ph.id}.webp`, import.meta.url)), `missing img/${ph.id}.webp`);
    }
  }
});

test('a year of daily rounds: 20 distinct pairs, no photo repeats, no back-to-back species', () => {
  for (let i = 0; i < 365; i++) {
    const round = buildRound({ pairs: PAIRS, photos: PHOTOS, seed: dailySeed(addDays(EPOCH, i)) });
    assert.equal(new Set(round.map((q) => q.pair)).size, ROUND_SIZE);
    const photos = round.flatMap((q) => [q.left.photo, q.right.photo]);
    assert.equal(new Set(photos).size, photos.length, `day ${i} repeats a photo`);
    for (let j = 1; j < round.length; j++) {
      const prev = new Set([round[j - 1].left.species, round[j - 1].right.species]);
      const shared = [round[j].left.species, round[j].right.species].some((s) => prev.has(s));
      assert.ok(!shared, `day ${i} question ${j + 1} repeats a species from the previous question`);
    }
  }
});
