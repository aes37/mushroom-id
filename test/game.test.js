import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUND_SIZE,
  EPOCH,
  RANKS,
  addDays,
  buildRound,
  computeStats,
  dailySeed,
  dateKey,
  grade,
  hashString,
  isFatalMixup,
  mulberry32,
  puzzleNumber,
  rankFor,
  shareText,
  summarize,
} from '../js/game.js';

const SPECIES = {
  a: { name: 'A', edibility: 'edible' },
  b: { name: 'B', edibility: 'deadly' },
  c: { name: 'C', edibility: 'edible' },
  d: { name: 'D', edibility: 'toxic' },
  e: { name: 'E', edibility: 'edible' },
  f: { name: 'F', edibility: 'inedible' },
};
const PAIRS = [
  { id: 'a-b', a: 'a', b: 'b' },
  { id: 'c-d', a: 'c', b: 'd' },
  { id: 'e-f', a: 'e', b: 'f' },
  { id: 'a-d', a: 'a', b: 'd' },
];
const PHOTOS = Object.fromEntries(
  Object.keys(SPECIES).map((k, i) => [k, Array.from({ length: 8 }, (_, j) => ({ id: (i + 1) * 100 + j }))]),
);

test('dateKey formats local dates as YYYY-MM-DD', () => {
  assert.equal(dateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(dateKey(new Date(2026, 11, 31, 0, 0)), '2026-12-31');
});

test('puzzle numbers count days from the epoch, unaffected by DST', () => {
  assert.equal(puzzleNumber(EPOCH), 1);
  assert.equal(puzzleNumber(addDays(EPOCH, 1)), 2);
  assert.equal(puzzleNumber('2027-03-15') - puzzleNumber('2027-03-14'), 1);
  assert.equal(puzzleNumber('2027-11-08') - puzzleNumber('2027-11-07'), 1);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('the PRNG is deterministic and in [0, 1)', () => {
  const r1 = mulberry32(hashString('seed'));
  const r2 = mulberry32(hashString('seed'));
  for (let i = 0; i < 1000; i++) {
    const x = r1();
    assert.equal(x, r2());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(hashString('2026-10-30'), hashString('2026-10-31'));
});

test('a round is the same for everyone on the same day and differs between days', () => {
  const day1 = buildRound({ pairs: PAIRS, photos: PHOTOS, seed: dailySeed('2026-10-30') });
  const again = buildRound({ pairs: PAIRS, photos: PHOTOS, seed: dailySeed('2026-10-30') });
  const day2 = buildRound({ pairs: PAIRS, photos: PHOTOS, seed: dailySeed('2026-10-31') });
  assert.deepEqual(day1, again);
  assert.notDeepEqual(day1, day2);
});

test('round questions are well formed', () => {
  const round = buildRound({ pairs: PAIRS, photos: PHOTOS, seed: 'x' });
  assert.equal(round.length, ROUND_SIZE);
  for (const q of round) {
    const pair = PAIRS.find((p) => p.id === q.pair);
    assert.ok(pair);
    assert.deepEqual([q.left.species, q.right.species].sort(), [pair.a, pair.b].sort());
    assert.equal(q[q.answer].species, q.target);
    assert.ok(PHOTOS[q.left.species].some((p) => p.id === q.left.photo));
    assert.ok(PHOTOS[q.right.species].some((p) => p.id === q.right.photo));
  }
});

test('both targets and both sides come up', () => {
  const round = buildRound({ pairs: PAIRS, photos: PHOTOS, seed: 'balance', size: 200 });
  const left = round.filter((q) => q.answer === 'left').length;
  assert.ok(left > 70 && left < 130, `left answers: ${left}`);
  const askedA = round.filter((q) => q.target === PAIRS.find((p) => p.id === q.pair).a).length;
  assert.ok(askedA > 70 && askedA < 130, `asked first species: ${askedA}`);
});

test('pairs without photos are never used', () => {
  const photos = { ...PHOTOS, f: [] };
  const round = buildRound({ pairs: PAIRS, photos, seed: 'y' });
  assert.ok(round.every((q) => q.pair !== 'e-f'));
});

test('grading and scoring: +1 right, 0 unsure, -1 wrong', () => {
  const q = { answer: 'left' };
  assert.equal(grade(q, 'left'), 'correct');
  assert.equal(grade(q, 'right'), 'wrong');
  assert.equal(grade(q, 'unsure'), 'unsure');
  const s = summarize(['correct', 'correct', 'wrong', 'unsure']);
  assert.deepEqual(s, { correct: 2, wrong: 1, unsure: 1, score: 1, total: 4 });
});

test('ranks cover every possible score', () => {
  for (let score = -ROUND_SIZE; score <= ROUND_SIZE; score++) assert.ok(rankFor(score), `score ${score}`);
  assert.equal(rankFor(ROUND_SIZE).title, RANKS[0].title);
  assert.equal(rankFor(-ROUND_SIZE).title, RANKS[RANKS.length - 1].title);
  assert.equal(rankFor(0).title, RANKS[RANKS.length - 1].title);
});

test('wrong answers on pairs with a deadly species are fatal mix-ups', () => {
  const deadlyQ = { left: { species: 'a' }, right: { species: 'b' } };
  const toxicQ = { left: { species: 'c' }, right: { species: 'd' } };
  assert.equal(isFatalMixup(deadlyQ, 'wrong', SPECIES), true);
  assert.equal(isFatalMixup(deadlyQ, 'correct', SPECIES), false);
  assert.equal(isFatalMixup(deadlyQ, 'unsure', SPECIES), false);
  assert.equal(isFatalMixup(toxicQ, 'wrong', SPECIES), false);
});

test('share text has a header, a 10-wide grid and the rank', () => {
  const questions = buildRound({ pairs: PAIRS, photos: PHOTOS, seed: 'share' });
  const results = questions.map((q, i) => (i % 5 === 0 ? 'wrong' : i % 7 === 0 ? 'unsure' : 'correct'));
  const text = shareText({ number: 3, questions, results, species: SPECIES, url: 'https://example.com/' });
  const lines = text.split('\n');
  const { score } = summarize(results);
  assert.equal(lines[0], `Mushroom ID #3: ${score}/20`);
  assert.equal([...lines[1]].length, 10);
  assert.equal([...lines[2]].length, 10);
  assert.ok(lines[3].endsWith(rankFor(score).title));
  assert.equal(lines[4], 'https://example.com/');
});

test('stats: streaks only count consecutive days', () => {
  const h = (score) => ({ score });
  const history = {
    '2026-11-01': h(5),
    '2026-11-02': h(10),
    '2026-11-03': h(15),
    '2026-11-05': h(20),
    '2026-11-06': h(-2),
  };
  assert.deepEqual(computeStats(history, '2026-11-06'), { played: 5, best: 20, average: 9.6, streak: 2, maxStreak: 3 });
  assert.equal(computeStats(history, '2026-11-07').streak, 2);
  assert.equal(computeStats(history, '2026-11-08').streak, 0);
  assert.deepEqual(computeStats({}, '2026-11-08'), { played: 0, best: null, average: null, streak: 0, maxStreak: 0 });
});
