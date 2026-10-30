import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUESTIONS_PER_GAME, buildQuiz, computeStats, dailyQuiz, judge, previousDateKey,
  puzzleNumber, rankFor, scoreGame, shareText,
} from '../js/game.js';
import { mulberry32, seededRng } from '../js/rng.js';

const content = JSON.parse(readFileSync(new URL('../data/content.json', import.meta.url)));
const photos = JSON.parse(readFileSync(new URL('../data/photos.json', import.meta.url)));

function toyData(pairCount, photosPer = 3) {
  const pairs = [];
  const ph = {};
  for (let i = 0; i < pairCount; i++) {
    pairs.push({ id: `p${i}`, a: `a${i}`, b: `b${i}` });
    for (const s of [`a${i}`, `b${i}`]) ph[s] = Array.from({ length: photosPer }, (_, j) => ({ id: `${s}-${j}` }));
  }
  return { pairs, ph };
}

test('rng is deterministic', () => {
  const a = seededRng('2026-10-30');
  const b = seededRng('2026-10-30');
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
  const r = mulberry32(1);
  for (let i = 0; i < 1000; i++) {
    const x = r();
    assert.ok(x >= 0 && x < 1);
  }
});

test('puzzle numbers count days from the epoch', () => {
  assert.equal(puzzleNumber('2026-10-30'), 1);
  assert.equal(puzzleNumber('2026-10-31'), 2);
  assert.equal(puzzleNumber('2027-03-29'), 151); // across a DST change
  assert.equal(previousDateKey('2027-01-01'), '2026-12-31');
});

test('daily quiz is the same for the same date and differs between dates', () => {
  const q1 = dailyQuiz('2026-11-05', content.pairs, photos);
  const q2 = dailyQuiz('2026-11-05', content.pairs, photos);
  const q3 = dailyQuiz('2026-11-06', content.pairs, photos);
  assert.deepEqual(q1, q2);
  assert.notDeepEqual(q1, q3);
});

test('real data: 20 distinct pairs, valid sides, no photo shown twice, species cap respected', () => {
  for (let day = 1; day <= 60; day++) {
    const key = `2027-01-${String((day % 28) + 1).padStart(2, '0')}-${day}`;
    const quiz = dailyQuiz(key, content.pairs, photos);
    assert.equal(quiz.length, QUESTIONS_PER_GAME);
    assert.equal(new Set(quiz.map((q) => q.pair)).size, QUESTIONS_PER_GAME);
    const shown = quiz.flatMap((q) => [q.left.photo, q.right.photo]);
    assert.equal(new Set(shown).size, shown.length);
    const counts = {};
    for (const q of quiz) {
      assert.ok(q.answer === 'left' || q.answer === 'right');
      assert.equal(q[q.answer].species, q.target);
      assert.notEqual(q.left.species, q.right.species);
      for (const s of [q.left.species, q.right.species]) counts[s] = (counts[s] || 0) + 1;
    }
    assert.ok(Math.max(...Object.values(counts)) <= 3, `species overused on ${key}`);
  }
});

test('real data: every pair and photo references known species', () => {
  const ids = new Set(Object.keys(content.species));
  for (const p of content.pairs) {
    assert.ok(ids.has(p.a), `${p.id}: unknown species ${p.a}`);
    assert.ok(ids.has(p.b), `${p.id}: unknown species ${p.b}`);
    assert.ok(p.tip && p.tip.length > 20, `${p.id}: missing tip`);
    assert.ok(photos[p.a]?.length >= 3 && photos[p.b]?.length >= 3, `${p.id}: too few photos`);
  }
  assert.ok(content.pairs.length >= QUESTIONS_PER_GAME);
  for (const [sid, list] of Object.entries(photos)) {
    assert.ok(ids.has(sid), `photos for unknown species ${sid}`);
    for (const ph of list) {
      assert.ok(['CC0', 'CC-BY', 'CC-BY-SA'].includes(ph.license), `${ph.id}: license ${ph.license}`);
      assert.ok(ph.author && ph.source, `${ph.id}: missing attribution`);
    }
  }
});

test('targets are balanced between the two species of a pair and between sides', () => {
  const { pairs, ph } = toyData(30);
  let left = 0;
  let firstSpecies = 0;
  const n = 400;
  for (let i = 0; i < n; i++) {
    for (const q of buildQuiz(pairs, ph, seededRng(`t${i}`))) {
      if (q.answer === 'left') left++;
      if (q.target.startsWith('a')) firstSpecies++;
    }
  }
  const total = n * QUESTIONS_PER_GAME;
  assert.ok(Math.abs(left / total - 0.5) < 0.03);
  assert.ok(Math.abs(firstSpecies / total - 0.5) < 0.03);
});

test('small datasets still produce a full quiz', () => {
  const { pairs, ph } = toyData(5);
  const quiz = buildQuiz(pairs, ph, seededRng('x'));
  assert.equal(quiz.length, QUESTIONS_PER_GAME);
  assert.deepEqual(buildQuiz([], {}, seededRng('x')), []);
});

test('scoring: +1 correct, -1 wrong, 0 unsure; deadly picks are flagged', () => {
  const species = { good: { edibility: 'choice' }, bad: { edibility: 'deadly' }, meh: { edibility: 'toxic' } };
  const qs = [
    { answer: 'left', left: { species: 'good' }, right: { species: 'bad' } },
    { answer: 'left', left: { species: 'good' }, right: { species: 'bad' } },
    { answer: 'right', left: { species: 'meh' }, right: { species: 'good' } },
    { answer: 'right', left: { species: 'meh' }, right: { species: 'good' } },
    // Picking the edible one when asked for the deadly one is the same mix-up.
    { answer: 'right', left: { species: 'good' }, right: { species: 'bad' } },
  ];
  const r = scoreGame(qs, ['left', 'right', 'left', 'unsure', 'left'], species);
  assert.deepEqual(r.results, ['correct', 'deadly', 'wrong', 'unsure', 'deadly']);
  assert.equal(r.correct, 1);
  assert.equal(r.wrong, 3);
  assert.equal(r.unsure, 1);
  assert.equal(r.score, -2);
  assert.deepEqual(r.closeCalls, ['bad', 'bad']);
  assert.equal(judge(qs[0], 'left', species), 'correct');
});

test('ranks cover the whole score range', () => {
  assert.equal(rankFor(20).title, 'Mycological Oracle');
  assert.equal(rankFor(17).title, 'Master Forager');
  assert.equal(rankFor(16).title, 'Seasoned Mushroom Hunter');
  assert.equal(rankFor(0).title, 'Supermarket Forager');
  assert.equal(rankFor(-20).title, 'Supermarket Forager');
  for (let s = -20; s <= 20; s++) assert.ok(rankFor(s));
});

test('share text', () => {
  const results = Array(20).fill('correct');
  results[3] = 'deadly';
  results[12] = 'unsure';
  const text = shareText({ number: 7, score: 17, results, url: 'https://example.com' });
  const lines = text.split('\n');
  assert.equal(lines[0], 'Mushroom ID #7: 17/20');
  assert.equal(lines[1], '🧺 Master Forager');
  assert.equal([...lines[2]].length, 10);
  assert.ok(lines[2].includes('💀'));
  assert.ok(lines[3].includes('⬜'));
  assert.equal(lines[4], 'https://example.com');
});

test('stats: streaks, best and average', () => {
  const history = {
    '2026-10-30': { score: 10 },
    '2026-10-31': { score: 14 },
    '2026-11-02': { score: 20 },
    '2026-11-03': { score: 5 },
    '2026-11-04': { score: -2 },
  };
  const s = computeStats(history, '2026-11-05');
  assert.equal(s.played, 5);
  assert.equal(s.best, 20);
  assert.equal(s.average, 47 / 5);
  assert.equal(s.streak, 3); // today not played yet: streak runs through yesterday
  assert.equal(s.maxStreak, 3);
  assert.equal(computeStats(history, '2026-11-07').streak, 0);
  assert.equal(s.distribution.reduce((a, d) => a + d.count, 0), 5);
  assert.equal(computeStats({}, '2026-11-05').best, null);
});
