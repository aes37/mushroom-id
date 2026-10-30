// Pure game logic: daily puzzle generation, scoring and ranks. No DOM access here,
// so it can be unit-tested with `node --test`.
import { seededRng, shuffle } from './rng.js';

export const QUESTIONS_PER_GAME = 20;
// Puzzle #1. Changing this renumbers every puzzle, so leave it alone once shared.
export const EPOCH = '2026-10-30';
// Keep any one species from dominating a day (e.g. Galerina is in several pairs).
const MAX_SPECIES_PER_GAME = 2;
const DAY_MS = 86400000;

export const EDIBILITY = {
  choice: { label: 'Choice edible', icon: '🍽️', tone: 'good' },
  edible: { label: 'Edible', icon: '✅', tone: 'good' },
  caution: { label: 'Edible with caution', icon: '⚠️', tone: 'warn' },
  inedible: { label: 'Inedible', icon: '🚫', tone: 'meh' },
  toxic: { label: 'Toxic', icon: '🤢', tone: 'bad' },
  deadly: { label: 'Deadly', icon: '☠️', tone: 'deadly' },
};

// Ordered best first; a score qualifies for the first rank whose `min` it reaches.
export const RANKS = [
  { min: 20, title: 'Mycological Oracle', emoji: '🔮', blurb: 'Twenty out of twenty. The forest keeps no secrets from you.' },
  { min: 17, title: 'Master Forager', emoji: '🧺', blurb: 'Sharp eyes, a full basket and a very happy liver.' },
  { min: 13, title: 'Seasoned Mushroom Hunter', emoji: '🍄', blurb: 'You know your gills from your ridges. A few tricksters still slip past.' },
  { min: 9, title: 'Keen Mycophile', emoji: '🔍', blurb: 'Solid instincts. Keep studying the tells and you will climb fast.' },
  { min: 5, title: 'Spore Print Apprentice', emoji: '📓', blurb: 'You are learning the ropes. Bring an expert on your next foray.' },
  { min: 1, title: 'Mycelium in Training', emoji: '🌱', blurb: 'Growing quietly underground. Lots of potential, not yet ready to fruit.' },
  { min: -Infinity, title: 'Supermarket Forager', emoji: '🛒', blurb: 'Stick to the shop shelves for now, and come back tomorrow for more practice.' },
];

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function keyToUtc(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function puzzleNumber(key) {
  return Math.round((keyToUtc(key) - keyToUtc(EPOCH)) / DAY_MS) + 1;
}

export function previousDateKey(key) {
  const d = new Date(keyToUtc(key) - DAY_MS);
  return d.toISOString().slice(0, 10);
}

export function msUntilTomorrow(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}

function pickPhoto(list, used, rng) {
  const fresh = list.filter((p) => !used.has(p.id));
  const pool = fresh.length ? fresh : list;
  const photo = pool[Math.floor(rng() * pool.length)];
  used.add(photo.id);
  return photo.id;
}

// Builds a list of questions. `photos` maps species id -> [{ id, ... }].
// Every random choice comes from `rng`, so the same seed always yields the same quiz.
export function buildQuiz(pairs, photos, rng, count = QUESTIONS_PER_GAME) {
  const usable = pairs.filter((p) => photos[p.a]?.length && photos[p.b]?.length);
  if (!usable.length) return [];

  const chosen = [];
  const deferred = [];
  const uses = new Map();
  for (const pair of shuffle(usable, rng)) {
    if (chosen.length === count) break;
    if ([pair.a, pair.b].every((s) => (uses.get(s) || 0) < MAX_SPECIES_PER_GAME)) {
      chosen.push(pair);
      for (const s of [pair.a, pair.b]) uses.set(s, (uses.get(s) || 0) + 1);
    } else {
      deferred.push(pair);
    }
  }
  // If the per-species cap left us short, top up with the pairs it skipped,
  // then (only for tiny datasets) repeat pairs.
  for (const pair of deferred) {
    if (chosen.length === count) break;
    chosen.push(pair);
  }
  while (chosen.length < count) chosen.push(usable[Math.floor(rng() * usable.length)]);

  const usedPhotos = new Set();
  return shuffle(chosen, rng).map((pair) => {
    const [target, other] = rng() < 0.5 ? [pair.a, pair.b] : [pair.b, pair.a];
    const targetCard = { species: target, photo: pickPhoto(photos[target], usedPhotos, rng) };
    const otherCard = { species: other, photo: pickPhoto(photos[other], usedPhotos, rng) };
    const answer = rng() < 0.5 ? 'left' : 'right';
    return {
      pair: pair.id,
      target,
      answer,
      left: answer === 'left' ? targetCard : otherCard,
      right: answer === 'left' ? otherCard : targetCard,
    };
  });
}

export function dailyQuiz(key, pairs, photos) {
  return buildQuiz(pairs, photos, seededRng(`mushroom-id:${key}`));
}

function deadlySpecies(question, species) {
  return [question.left.species, question.right.species].filter((s) => species[s]?.edibility === 'deadly');
}

// answer: 'left' | 'right' | 'unsure'. Returns 'correct' | 'wrong' | 'deadly' | 'unsure'.
// With only two options, a wrong pick means the two species were swapped, so any miss
// on a pair that includes a deadly species is a potentially fatal mix-up.
export function judge(question, answer, species) {
  if (answer === 'unsure') return 'unsure';
  if (answer === question.answer) return 'correct';
  return deadlySpecies(question, species).length ? 'deadly' : 'wrong';
}

// +1 for a correct pick, -1 for a wrong one, 0 for "don't know".
export function scoreGame(questions, answers, species) {
  const results = answers.map((a, i) => judge(questions[i], a, species));
  const correct = results.filter((r) => r === 'correct').length;
  const unsure = results.filter((r) => r === 'unsure').length;
  const wrong = results.length - correct - unsure;
  const closeCalls = results.flatMap((r, i) => (r === 'deadly' ? deadlySpecies(questions[i], species) : []));
  return { results, correct, wrong, unsure, score: correct - wrong, closeCalls };
}

export function rankFor(score) {
  return RANKS.find((r) => score >= r.min);
}

const GRID = { correct: '🟩', wrong: '🟥', deadly: '💀', unsure: '⬜' };

export function shareText({ number, score, results, url }) {
  const rank = rankFor(score);
  const rows = [];
  for (let i = 0; i < results.length; i += 10) {
    rows.push(results.slice(i, i + 10).map((r) => GRID[r]).join(''));
  }
  return [`Mushroom ID #${number}: ${score}/${QUESTIONS_PER_GAME}`, `${rank.emoji} ${rank.title}`, ...rows, url]
    .filter(Boolean)
    .join('\n');
}

// history: { [dateKey]: { score, ... } }
export function computeStats(history, today) {
  const keys = Object.keys(history).sort();
  const scores = keys.map((k) => history[k].score);
  let maxStreak = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    run = prev && previousDateKey(k) === prev ? run + 1 : 1;
    maxStreak = Math.max(maxStreak, run);
    prev = k;
  }
  let streak = 0;
  let cursor = history[today] ? today : previousDateKey(today);
  while (history[cursor]) {
    streak++;
    cursor = previousDateKey(cursor);
  }
  const distribution = RANKS.map((r) => ({ ...r, count: 0 }));
  for (const s of scores) distribution[RANKS.indexOf(rankFor(s))].count++;
  return {
    played: keys.length,
    best: scores.length ? Math.max(...scores) : null,
    average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    streak,
    maxStreak,
    distribution,
  };
}
