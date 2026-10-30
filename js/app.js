import { SPECIES } from '../data/species.js';
import { PAIRS } from '../data/pairs.js';
import { PHOTOS } from '../data/photos.js';
import {
  ROUND_SIZE,
  RANKS,
  POINTS,
  buildRound,
  dailySeed,
  dateKey,
  puzzleNumber,
  grade,
  summarize,
  rankFor,
  isFatalMixup,
  resultEmoji,
  shareText,
  computeStats,
  formatScore,
} from './game.js';
import { load, save, remove, keys } from './storage.js';
import { EDIBILITY, imageUrl, creditNodes, creditText } from './attribution.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const PAIR_BY_ID = Object.fromEntries(PAIRS.map((p) => [p.id, p]));
const PHOTO_BY_ID = new Map();
for (const [species, list] of Object.entries(PHOTOS)) {
  for (const photo of list) PHOTO_BY_ID.set(photo.id, { ...photo, species });
}

// Ignore answers/advances this soon after the screen changes, so a double click or a held key
// can't answer a question the player hasn't seen.
const INPUT_GUARD_MS = 350;

const today = dateKey();
const todayNumber = puzzleNumber(today);

// The round being played: { mode: 'daily' | 'practice', key, number, questions, answers, summaryOnly? }
let session = null;
let revealed = false;
let shownAt = 0;
let countdownTimer = null;

// ---------- helpers ----------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function speciesName(key) {
  return SPECIES[key].name;
}

function edibilityBadge(key) {
  const e = SPECIES[key].edibility;
  return el('span', { class: `badge ${e}` }, `${EDIBILITY[e].icon} ${EDIBILITY[e].label}`);
}

function showScreen(id) {
  for (const s of $$('.screen')) s.hidden = s.id !== id;
  window.scrollTo({ top: 0 });
}

function announce(message) {
  $('#sr-status').textContent = message;
}

function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function formatDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const isComplete = (round) => round.answers.length >= round.questions.length;

// A saved round stays usable as long as its pairs exist; a photo removed by a data update is
// shown as "unavailable" rather than throwing the player's progress away.
function isValidRound(saved) {
  return (
    saved &&
    Array.isArray(saved.questions) &&
    saved.questions.length === ROUND_SIZE &&
    Array.isArray(saved.answers) &&
    saved.answers.length <= ROUND_SIZE &&
    saved.questions.every((q) => PAIR_BY_ID[q.pair] && SPECIES[q.left?.species] && SPECIES[q.right?.species])
  );
}

function persist() {
  if (session.mode === 'daily') save(`daily:${session.key}`, { questions: session.questions, answers: session.answers });
}

const results = () => session.answers.map((a, i) => grade(session.questions[i], a));

// Record a finished daily round in the history (once).
function recordDaily(key, round) {
  const history = load('history', {});
  if (history[key] || !isComplete(round)) return;
  history[key] = summarize(round.answers.map((a, i) => grade(round.questions[i], a)));
  save('history', history);
}

// Record any finished rounds that never made it into the history (e.g. the tab was closed on the
// last reveal), then drop stored rounds from previous days.
function tidyStorage() {
  for (const key of keys('daily:')) {
    const day = key.slice('daily:'.length);
    const round = load(key, null);
    if (isValidRound(round)) recordDaily(day, round);
    if (day !== today) remove(key);
  }
}

// ---------- intro ----------

// The classic lookalike pair decorates the intro screen.
const HERO = ['chanterelle', 'jack-o-lantern'];

function showIntro() {
  $('#intro-number').textContent = `Puzzle #${todayNumber} · ${formatDate(today)}`;
  HERO.forEach((key, i) => {
    const img = $(i ? '#hero-b' : '#hero-a');
    const photo = PHOTOS[key]?.[0];
    if (!photo) {
      img.hidden = true;
      return;
    }
    img.src = imageUrl(photo.id);
    img.title = `${speciesName(key)}. ${creditText(photo)}`;
  });
  showScreen('screen-intro');
}

function startDaily() {
  const saved = load(`daily:${today}`, null);
  const recorded = load('history', {})[today];
  if (isValidRound(saved)) {
    session = { mode: 'daily', key: today, number: todayNumber, questions: saved.questions, answers: saved.answers };
  } else if (recorded) {
    // Today's result is final even if the stored round is gone; show it rather than a replay.
    session = { mode: 'daily', key: today, number: todayNumber, questions: [], answers: [], summaryOnly: recorded };
    showResults();
    return;
  } else {
    const questions = buildRound({ pairs: PAIRS, photos: PHOTOS, seed: dailySeed(today) });
    session = { mode: 'daily', key: today, number: todayNumber, questions, answers: [] };
    persist();
  }
  if (isComplete(session)) finish();
  else showQuestion();
}

function startPractice() {
  const seed = `practice:${Date.now()}:${Math.random()}`;
  session = { mode: 'practice', questions: buildRound({ pairs: PAIRS, photos: PHOTOS, seed }), answers: [] };
  showQuestion();
}

// ---------- play ----------

function renderDots() {
  const dots = $('#dots');
  dots.replaceChildren();
  const res = results();
  session.questions.forEach((q, i) => {
    const cls = i < res.length ? res[i] : i === res.length ? 'current' : '';
    dots.append(el('li', { class: `dot ${cls}` }));
  });
}

function setCard(side, card) {
  const fig = $(`#card-${side}`);
  const img = $('img', fig);
  fig.classList.remove('is-answer', 'is-wrong', 'missing');
  // Hide the card until its new photo has loaded so the previous one never shows under a new prompt.
  fig.classList.add('loading');
  img.onload = () => fig.classList.remove('loading');
  img.onerror = () => fig.classList.replace('loading', 'missing');
  img.src = imageUrl(card.photo);
  if (img.complete && img.naturalWidth) fig.classList.remove('loading');
  img.alt = `${side === 'left' ? 'Left' : 'Right'} mushroom photo`;
  // Absolute URL: a relative url() in a custom property resolves against the stylesheet, not the page.
  fig.style.setProperty('--bg-img', `url("${new URL(imageUrl(card.photo), document.baseURI)}")`);
  const label = $('.label', fig);
  label.hidden = true;
  label.replaceChildren();
}

function preload(question) {
  if (!question) return;
  for (const side of ['left', 'right']) new Image().src = imageUrl(question[side].photo);
}

function showQuestion() {
  revealed = false;
  shownAt = performance.now();
  const i = session.answers.length;
  const q = session.questions[i];
  const target = SPECIES[q.target];

  $('#q-count').textContent = `${i + 1} / ${session.questions.length}`;
  $('#mode-tag').hidden = session.mode !== 'practice';
  $('#running-score').textContent = `Score ${formatScore(summarize(results()).score)}`;
  renderDots();

  $('#prompt-article').textContent = target.article ?? 'the';
  $('#prompt-name').textContent = target.name;
  $('#prompt-sci').textContent = target.sci;

  setCard('left', q.left);
  setCard('right', q.right);
  $$('.pick').forEach((b) => (b.disabled = false));
  $('#answer-actions').hidden = false;
  $('#feedback').hidden = true;
  showScreen('screen-play');
  $('#prompt').focus({ preventScroll: true });
  preload(session.questions[i + 1]);
}

// Another tab may have moved today's round on; adopt its progress instead of overwriting it.
function syncFromStorage() {
  if (session?.mode !== 'daily' || session.summaryOnly) return false;
  const stored = load(`daily:${session.key}`, null);
  if (!isValidRound(stored) || stored.answers.length === session.answers.length) return false;
  session.questions = stored.questions;
  session.answers = stored.answers;
  if (isComplete(session)) finish();
  else showQuestion();
  toast('Updated with progress from another tab');
  return true;
}

function answer(choice) {
  if (!session || revealed || $('#screen-play').hidden) return;
  if (performance.now() - shownAt < INPUT_GUARD_MS || $('.card.loading')) return;
  if (syncFromStorage()) return;
  const q = session.questions[session.answers.length];
  session.answers.push(choice);
  persist();
  if (session.mode === 'daily') recordDaily(session.key, session);
  reveal(q, choice);
}

function reveal(q, choice) {
  revealed = true;
  shownAt = performance.now();
  const result = grade(q, choice);
  const pair = PAIR_BY_ID[q.pair];

  for (const side of ['left', 'right']) {
    const card = q[side];
    const fig = $(`#card-${side}`);
    const photo = PHOTO_BY_ID.get(card.photo);
    fig.classList.toggle('is-answer', side === q.answer);
    fig.classList.toggle('is-wrong', side === choice && result === 'wrong');
    $('img', fig).alt = photo ? `${speciesName(card.species)} (${photo.taxon})` : speciesName(card.species);
    const label = $('.label', fig);
    label.replaceChildren(el('span', { class: 'label-name' }, speciesName(card.species)), edibilityBadge(card.species));
    if (photo) label.append(el('span', { class: 'label-credit' }, creditNodes(photo, { prefix: '' })));
    label.hidden = false;
  }
  $$('.pick').forEach((b) => (b.disabled = true));

  const verdict = $('#verdict');
  verdict.className = `verdict ${result}`;
  if (result === 'correct') verdict.textContent = `Correct! +${POINTS.correct}`;
  else if (result === 'unsure') verdict.textContent = 'No guess. 0 points, and no harm done.';
  else verdict.textContent = `Not quite: that was the ${speciesName(q[choice].species)}. −${-POINTS.wrong}`;
  if (isFatalMixup(q, result, SPECIES)) verdict.textContent += ' ☠️ In the field, this mix-up could be fatal.';

  $('#ids').replaceChildren(
    ...[pair.a, pair.b].map((key) => {
      const s = SPECIES[key];
      return el(
        'li',
        { class: 'id-row' },
        edibilityBadge(key),
        el('span', {}, el('strong', {}, s.name), ' ', el('em', {}, s.sci), s.note ? ` · ${s.note}` : ''),
      );
    }),
  );

  $('#tip').textContent = pair.tip;
  const sources = $('#tip-sources');
  sources.replaceChildren();
  if (pair.sources?.length) {
    sources.append('Sources: ');
    pair.sources.forEach((src, i) => {
      if (i) sources.append(', ');
      sources.append(el('a', { href: src.url, target: '_blank', rel: 'noopener' }, src.name));
    });
  }

  $('#answer-actions').hidden = true;
  $('#feedback').hidden = false;
  $('#btn-next').textContent = isComplete(session) ? 'See results' : 'Next';
  $('#running-score').textContent = `Score ${formatScore(summarize(results()).score)}`;
  renderDots();
  announce(verdict.textContent);
  $('#btn-next').focus({ preventScroll: true });
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('#feedback').scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
}

function next() {
  if (!revealed || performance.now() - shownAt < INPUT_GUARD_MS) return;
  if (isComplete(session)) finish();
  else showQuestion();
}

function finish() {
  if (session.mode === 'daily') recordDaily(session.key, session);
  showResults();
}

// ---------- results ----------

function showResults() {
  revealed = false;
  const summary = session.summaryOnly ?? summarize(results());
  const res = results();
  const rank = rankFor(summary.score);

  $('#results-title').textContent =
    session.mode === 'daily' ? `Puzzle #${session.number} · ${formatDate(session.key)}` : 'Practice round';
  $('#rank-emoji').textContent = rank.emoji;
  $('#rank-title').textContent = rank.title;
  $('#rank-blurb').textContent = rank.blurb;
  $('#score').textContent = formatScore(summary.score);
  $('#score-max').textContent = summary.total;
  $('#breakdown').textContent = `${summary.correct} right · ${summary.wrong} wrong · ${summary.unsure} don't know`;

  $('#result-grid').replaceChildren(
    ...session.questions.map((q, i) =>
      el('li', { title: `${i + 1}. ${speciesName(q.left.species)} vs ${speciesName(q.right.species)}: ${res[i]}` },
        resultEmoji(q, res[i], SPECIES)),
    ),
  );

  const fatal = session.questions.filter((q, i) => isFatalMixup(q, res[i], SPECIES));
  const fatalBox = $('#fatal');
  fatalBox.hidden = !fatal.length;
  if (fatal.length) {
    fatalBox.replaceChildren(
      el('h3', {}, `☠️ ${fatal.length} potentially fatal mix-up${fatal.length > 1 ? 's' : ''}`),
      el('ul', {}, ...fatal.map((q) => {
        const pair = PAIR_BY_ID[q.pair];
        return el('li', {}, `${speciesName(pair.a)} ↔ ${speciesName(pair.b)}`);
      })),
    );
  }

  renderReview(res);
  $('.review').hidden = !session.questions.length;
  $('#btn-share').hidden = !session.questions.length;

  const { streak } = computeStats(load('history', {}), dateKey());
  $('#streak-line').textContent = session.mode === 'daily' && streak > 1 ? `🔥 ${streak}-day streak · ` : '';
  $('#btn-practice').textContent = session.mode === 'practice' ? 'Another practice round' : 'Practice round';

  // After a practice round, point back to the daily if it hasn't been played yet.
  const daily = load(`daily:${today}`, null);
  const dailyDone = load('history', {})[today] || (isValidRound(daily) && isComplete(daily));
  const offerDaily = session.mode === 'practice' && !dailyDone;
  $('#btn-daily').hidden = !offerDaily;
  $('.next-puzzle').hidden = offerDaily;

  showScreen('screen-results');
  $('#rank-title').focus({ preventScroll: true });
  announce(`${rank.title}. ${formatScore(summary.score)} points out of ${summary.total}.`);
  if (!offerDaily) startCountdown();
}

function renderReview(res) {
  $('#review-list').replaceChildren(
    ...session.questions.map((q, i) => {
      const pair = PAIR_BY_ID[q.pair];
      const thumbs = el(
        'div',
        { class: 'review-thumbs' },
        ...['left', 'right'].map((side) => {
          const photo = PHOTO_BY_ID.get(q[side].photo);
          const img = el('img', { src: imageUrl(q[side].photo), alt: speciesName(q[side].species), loading: 'lazy' });
          if (photo) img.title = creditText(photo);
          return el('figure', { class: side === q.answer ? 'is-answer' : '' }, img,
            el('figcaption', {}, speciesName(q[side].species)));
        }),
      );
      return el(
        'li',
        { class: `review-item ${res[i]}` },
        el('p', { class: 'review-q' }, el('span', { class: 'review-mark' }, resultEmoji(q, res[i], SPECIES)),
          ` Which one is the ${speciesName(q.target)}?`),
        thumbs,
        el('p', { class: 'review-tip' }, pair.tip),
      );
    }),
  );
}

function startCountdown() {
  clearInterval(countdownTimer);
  const out = $('#next-puzzle');
  const tick = () => {
    const now = new Date();
    if (dateKey(now) !== today) {
      out.replaceChildren('A new puzzle is ready. ', el('a', { href: './' }, 'Play it'));
      clearInterval(countdownTimer);
      return;
    }
    const ms = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    const h = Math.floor(ms / 3.6e6);
    const m = Math.floor((ms % 3.6e6) / 6e4);
    const s = Math.floor((ms % 6e4) / 1000);
    out.textContent = `Next puzzle in ${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

async function share() {
  const text = shareText({
    number: session.mode === 'daily' ? session.number : null,
    questions: session.questions,
    results: results(),
    species: SPECIES,
    url: location.origin + location.pathname,
  });
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast('Result copied to clipboard');
  } catch (err) {
    if (err?.name === 'AbortError') return;
    window.prompt('Copy your result:', text);
  }
}

// ---------- dialogs ----------

function renderRankList() {
  $('#rank-list').replaceChildren(
    ...RANKS.map((r, i) => {
      const upper = i === 0 ? null : RANKS[i - 1].min - 1;
      const range = i === 0 ? `${r.min}` : r.min === -Infinity ? `${upper} or less` : `${r.min}–${upper}`;
      return el('li', {}, el('span', { class: 'rank-range' }, range), ` ${r.emoji} ${r.title}`);
    }),
  );
}

function showStats() {
  const history = load('history', {});
  const s = computeStats(history, dateKey());
  const fmt = (v, digits = 0) => (v == null ? '–' : v.toFixed(digits).replace('-', '−'));
  const tile = (value, label) =>
    el('div', { class: 'stat' }, el('span', { class: 'stat-value' }, value), el('span', { class: 'stat-label' }, label));
  const box = $('#stats');
  box.replaceChildren(
    tile(String(s.played), 'Played'),
    tile(fmt(s.average, 1), 'Avg score'),
    tile(fmt(s.best), 'Best'),
    tile(String(s.streak), 'Streak'),
    tile(String(s.maxStreak), 'Max streak'),
  );
  const counts = new Map(RANKS.map((r) => [r.title, 0]));
  for (const h of Object.values(history)) counts.set(rankFor(h.score).title, counts.get(rankFor(h.score).title) + 1);
  const max = Math.max(1, ...counts.values());
  box.append(
    el('h3', { class: 'dist-title' }, 'Ranks earned'),
    el('ul', { class: 'dist' },
      ...RANKS.map((r) =>
        el('li', {},
          el('span', { class: 'dist-name' }, `${r.emoji} ${r.title}`),
          el('span', { class: 'dist-bar', style: `--w:${(counts.get(r.title) / max) * 100}%` }, String(counts.get(r.title))),
        ),
      ),
    ),
  );
  $('#dlg-stats').showModal();
}

function openZoom(side) {
  if (!session || $('#screen-play').hidden) return;
  const q = session.questions[revealed ? session.answers.length - 1 : session.answers.length];
  if (!q) return;
  const card = q[side];
  const photo = PHOTO_BY_ID.get(card.photo);
  const img = $('#zoom-img');
  img.src = imageUrl(card.photo);
  img.alt = revealed ? speciesName(card.species) : `${side === 'left' ? 'Left' : 'Right'} mushroom photo`;
  const credit = $('#zoom-credit');
  credit.replaceChildren();
  if (!revealed) credit.textContent = 'Photo credit appears after you answer.';
  else if (photo) credit.append(`${speciesName(card.species)} (${photo.taxon}) · `, creditNodes(photo));
  else credit.textContent = speciesName(card.species);
  $('#dlg-zoom').showModal();
}

// Close a dialog only when a press both starts and ends on the backdrop (outside its box).
function closeOnBackdrop(dialog) {
  let downOutside = false;
  const outside = (e) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  dialog.addEventListener('pointerdown', (e) => (downOutside = e.target === dialog && outside(e)));
  dialog.addEventListener('click', (e) => {
    if (downOutside && e.target === dialog && outside(e)) dialog.close();
    downOutside = false;
  });
}

// ---------- wiring ----------

const ANSWER_KEYS = { ArrowLeft: 'left', ArrowRight: 'right', d: 'unsure', D: 'unsure' };

function onKeydown(e) {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  if ($('#screen-play').hidden) return;
  if (!revealed) {
    const choice = ANSWER_KEYS[e.key];
    if (choice && !e.target.closest?.('input, textarea, select')) {
      e.preventDefault();
      answer(choice);
    }
    return;
  }
  if (e.key !== 'Enter' && e.key !== ' ') return;
  // Let links, buttons and other controls handle their own activation.
  if (e.target.closest?.('a, button, summary, input, select, textarea, [tabindex]:not([tabindex="-1"])')) return;
  e.preventDefault();
  next();
}

// When the page comes back after midnight, start from the new day (unless mid-round).
function onResume() {
  if (document.visibilityState !== 'visible' || dateKey() === today) return;
  if ($('#screen-play').hidden) location.reload();
}

function bind() {
  $('#btn-start').addEventListener('click', startDaily);
  $('#btn-daily').addEventListener('click', startDaily);
  $('#btn-practice-intro').addEventListener('click', startPractice);
  $('#btn-practice').addEventListener('click', startPractice);
  $('#btn-next').addEventListener('click', next);
  $('#btn-share').addEventListener('click', share);
  $('#btn-help').addEventListener('click', () => $('#dlg-help').showModal());
  $('#btn-stats').addEventListener('click', showStats);
  $$('[data-choice]').forEach((b) => b.addEventListener('click', () => answer(b.dataset.choice)));
  $$('[data-zoom]').forEach((b) => b.addEventListener('click', () => openZoom(b.dataset.zoom)));
  $$('dialog').forEach(closeOnBackdrop);
  $('#zoom-img').addEventListener('click', () => $('#dlg-zoom').close());
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('pageshow', onResume);
  window.addEventListener('storage', (e) => {
    if (e.key?.endsWith(`daily:${today}`) && !revealed && !$('#screen-play').hidden) syncFromStorage();
  });
}

function init() {
  bind();
  renderRankList();
  tidyStorage();
  const saved = load(`daily:${today}`, null);
  if ((isValidRound(saved) && saved.answers.length > 0) || load('history', {})[today]) {
    // Resume today's round, or show its results if it's finished.
    startDaily();
  } else {
    showIntro();
  }
}

try {
  init();
} catch (err) {
  console.error(err);
  $('#loading-msg').textContent = 'Sorry, something went wrong loading the game. Please reload the page.';
  showScreen('screen-loading');
}
