// Pure game logic: daily seeding, round generation, scoring, ranks and share text.
// No DOM access here so it can be unit-tested in Node.

export const ROUND_SIZE = 20;
// Puzzle #1 is played on this (local) date.
export const EPOCH = '2026-10-30';

export const POINTS = { correct: 1, unsure: 0, wrong: -1 };

// Ordered from best to worst; a score earns the first rank whose `min` it reaches.
export const RANKS = [
  { min: 20, title: 'Golden Chanterelle', emoji: '🏆', blurb: 'A perfect round. The forest has no secrets from you.' },
  { min: 17, title: 'King Bolete', emoji: '👑', blurb: 'Royalty of the forest floor. A near-flawless eye.' },
  { min: 13, title: 'Hen of the Woods', emoji: '🧺', blurb: 'A rich haul. You know your lookalikes.' },
  { min: 9, title: 'Oyster Mushroom', emoji: '🦪', blurb: 'Solid and dependable, with a few gaps to fill.' },
  { min: 5, title: 'Button Mushroom', emoji: '🍄', blurb: 'Still growing. Keep at it.' },
  { min: 1, title: 'Puffball', emoji: '💨', blurb: 'Mostly hot air so far, but you came out ahead.' },
  { min: -Infinity, title: 'Toadstool', emoji: '☠️', blurb: 'Your guesses are a hazard. Shop-bought mushrooms only, please.' },
];

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function keyToUTC(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function puzzleNumber(key) {
  return Math.round((keyToUTC(key) - keyToUTC(EPOCH)) / 86400000) + 1;
}

export function addDays(key, n) {
  const d = new Date(keyToUTC(key) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

// 32-bit string hash (based on cyrb53's mixing) used to seed the PRNG.
export function hashString(str) {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}

// Small, fast seeded PRNG returning floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, rng) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sharesSpecies = (p, q) => p.a === q.a || p.a === q.b || p.b === q.a || p.b === q.b;

// Append the pair, or slot it into the first gap where it clashes with neither neighbour.
function place(out, item) {
  if (!out.length || !sharesSpecies(out[out.length - 1], item)) {
    out.push(item);
    return true;
  }
  const gap = out.findIndex((next, i) => !sharesSpecies(next, item) && (i === 0 || !sharesSpecies(out[i - 1], item)));
  if (gap === -1) return false;
  out.splice(gap, 0, item);
  return true;
}

// Reorder so that consecutive questions don't reuse a species when avoidable. Pairs that don't fit
// yet are retried as the list grows; any that never fit go at the end.
function spreadApart(list) {
  const out = [];
  let pending = [];
  for (const item of list) {
    if (!place(out, item)) pending.push(item);
    pending = pending.filter((p) => !place(out, p));
  }
  return out.concat(pending);
}

// Build a round of `size` questions. Identical inputs and seed always give an identical round,
// which is what makes the daily puzzle the same for everyone.
export function buildRound({ pairs, photos, seed, size = ROUND_SIZE }) {
  const rng = mulberry32(hashString(String(seed)));
  const playable = pairs.filter((p) => photos[p.a]?.length && photos[p.b]?.length);
  if (!playable.length) throw new Error('No playable pairs');

  let chosen = [];
  while (chosen.length < size) chosen = chosen.concat(shuffle(playable, rng));
  chosen = spreadApart(chosen.slice(0, size));

  const used = new Set();
  const pickPhoto = (species) => {
    const all = photos[species];
    const fresh = all.filter((p) => !used.has(p.id));
    const pool = fresh.length ? fresh : all;
    const photo = pool[Math.floor(rng() * pool.length)];
    used.add(photo.id);
    return photo.id;
  };

  return chosen.map((pair) => {
    const askA = rng() < 0.5;
    const target = askA ? pair.a : pair.b;
    const other = askA ? pair.b : pair.a;
    const targetLeft = rng() < 0.5;
    const targetCard = { species: target, photo: pickPhoto(target) };
    const otherCard = { species: other, photo: pickPhoto(other) };
    return {
      pair: pair.id,
      target,
      left: targetLeft ? targetCard : otherCard,
      right: targetLeft ? otherCard : targetCard,
      answer: targetLeft ? 'left' : 'right',
    };
  });
}

export function dailySeed(key) {
  return `mushroom-id:daily:${key}`;
}

export function grade(question, choice) {
  if (choice === 'unsure') return 'unsure';
  return choice === question.answer ? 'correct' : 'wrong';
}

export function summarize(results) {
  const counts = { correct: 0, wrong: 0, unsure: 0 };
  for (const r of results) counts[r] += 1;
  const score = counts.correct * POINTS.correct + counts.wrong * POINTS.wrong + counts.unsure * POINTS.unsure;
  return { ...counts, score, total: results.length };
}

// Typographic minus for negative scores.
export function formatScore(score) {
  return score < 0 ? `\u2212${-score}` : String(score);
}

export function rankFor(score) {
  return RANKS.find((r) => score >= r.min);
}

// A wrong answer on a pair that involves a deadly species is a potentially fatal mix-up.
export function isFatalMixup(question, result, species) {
  if (result !== 'wrong') return false;
  return species[question.left.species]?.edibility === 'deadly' || species[question.right.species]?.edibility === 'deadly';
}

export function resultEmoji(question, result, species) {
  if (result === 'correct') return '🟩';
  if (result === 'unsure') return '⬜';
  return isFatalMixup(question, result, species) ? '💀' : '🟥';
}

export function shareText({ number, questions, results, species, url }) {
  const { score, total } = summarize(results);
  const rank = rankFor(score);
  const cells = questions.map((q, i) => resultEmoji(q, results[i], species));
  const rows = [];
  for (let i = 0; i < cells.length; i += 10) rows.push(cells.slice(i, i + 10).join(''));
  const header = number ? `Mushroom ID #${number}` : 'Mushroom ID (practice)';
  return [`${header}: ${formatScore(score)}/${total}`, ...rows, `${rank.emoji} ${rank.title}`, url].filter(Boolean).join('\n');
}

// Streaks and totals from a { [dateKey]: { score, ... } } history of completed dailies.
export function computeStats(history, todayKey) {
  const keys = Object.keys(history).sort();
  const scores = keys.map((k) => history[k].score);
  const played = keys.length;
  const best = played ? Math.max(...scores) : null;
  const average = played ? scores.reduce((s, x) => s + x, 0) / played : null;

  let maxStreak = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    maxStreak = Math.max(maxStreak, run);
    prev = k;
  }
  // The current streak is alive if the last completed day is today or yesterday.
  let streak = 0;
  if (prev && (prev === todayKey || addDays(prev, 1) === todayKey)) {
    streak = 1;
    for (let i = keys.length - 1; i > 0 && addDays(keys[i - 1], 1) === keys[i]; i--) streak++;
  }
  return { played, best, average, streak, maxStreak };
}
