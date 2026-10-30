import {
  EDIBILITY, QUESTIONS_PER_GAME, RANKS, buildQuiz, computeStats, dailyQuiz, dateKey, judge,
  msUntilTomorrow, puzzleNumber, rankFor, scoreGame, shareText,
} from './game.js';
import { mulberry32 } from './rng.js';
import { load, save } from './storage.js';

const app = document.getElementById('app');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const lightbox = document.getElementById('lightbox');
const toastEl = document.getElementById('toast');

const LICENSES = {
  CC0: { label: 'CC0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  'CC-BY': { label: 'CC BY', url: 'https://creativecommons.org/licenses/by/4.0/' },
  'CC-BY-SA': { label: 'CC BY-SA', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
};

const ICON_ZOOM = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5"/></svg>';

let content;
let species;
let photosBySpecies;
let photoById;
let pairById;

// The game being played: { mode: 'daily' | 'practice', key?, number?, questions, answers, started }
let game = null;
let practice = null;
// True while the feedback for the latest answer is on screen.
let revealed = false;
let countdownTimer = null;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function init() {
  try {
    [content, photosBySpecies] = await Promise.all([fetchJson('data/content.json'), fetchJson('data/photos.json')]);
  } catch (err) {
    app.innerHTML = `<p class="error">Couldn't load the mushrooms (${esc(err.message)}).<br>
      If you opened index.html straight from disk, serve the folder over HTTP instead (see README).</p>`;
    return;
  }
  species = content.species;
  photoById = new Map(Object.values(photosBySpecies).flat().map((p) => [p.id, p]));
  pairById = new Map(content.pairs.map((p) => [p.id, p]));

  window.addEventListener('hashchange', route);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  route();
  if (!load('seenHelp', false)) {
    showHelp();
    save('seenHelp', true);
  }
}

// ---------- Routing ----------

function route() {
  clearInterval(countdownTimer);
  closeLightbox();
  const [, page, arg] = location.hash.split('/');
  if (page === 'guide') return viewGuide(arg);
  if (page === 'credits') return viewCredits();
  if (page === 'about') return viewAbout();
  if (page === 'practice') {
    if (!practice || practice.answers.length === practice.questions.length) startPractice();
    game = practice;
  } else {
    game = loadDaily();
  }
  revealed = false;
  renderGame();
}

function loadDaily() {
  const key = dateKey();
  const saved = load(`daily:${key}`, null);
  if (saved?.questions?.length && saved.questions.every(questionIsValid)) return saved;
  return {
    mode: 'daily',
    key,
    number: puzzleNumber(key),
    questions: dailyQuiz(key, content.pairs, photosBySpecies),
    answers: [],
    started: false,
  };
}

// Saved games reference photos by id; drop a saved game if the photo set has since changed.
function questionIsValid(q) {
  return pairById.has(q.pair) && photoById.has(q.left.photo) && photoById.has(q.right.photo);
}

function startPractice() {
  const rng = mulberry32((Math.random() * 2 ** 32) >>> 0);
  practice = {
    mode: 'practice',
    questions: buildQuiz(content.pairs, photosBySpecies, rng),
    answers: [],
    started: true,
  };
}

function persist() {
  if (game.mode !== 'daily') return;
  save(`daily:${game.key}`, game);
  if (game.answers.length === game.questions.length) {
    const r = scoreGame(game.questions, game.answers, species);
    const history = load('history', {});
    history[game.key] = { score: r.score, correct: r.correct, wrong: r.wrong, unsure: r.unsure, number: game.number };
    save('history', history);
  }
}

// ---------- Game views ----------

function renderGame() {
  if (game.mode === 'daily' && game.key !== dateKey() && game.answers.length < game.questions.length) {
    game = loadDaily(); // the day rolled over mid-game
  }
  if (!game.started) return viewIntro();
  if (game.answers.length === game.questions.length && !revealed) return viewResults();
  viewQuestion();
}

function viewIntro() {
  const teaser = content.teaser.map((sid) => photosBySpecies[sid]?.[0]).filter(Boolean);
  app.innerHTML = `
    <section class="intro">
      <p class="eyebrow">Mushroom ID #${game.number} · ${formatDate(game.key)}</p>
      <h1>Can you spot the lookalike?</h1>
      <p class="lede">Twenty pairs of mushrooms that people really do mix up, sometimes with deadly results.
        For each pair, pick the one we name.</p>
      ${teaser.length === 2 ? `<div class="intro-preview">${teaser.map((p) => `<img src="${esc(p.file)}" alt="" width="${p.w}" height="${p.h}">`).join('')}</div>` : ''}
      <div class="rules">
        <ul>
          <li><strong>+1</strong> for a correct pick, <strong>−1</strong> for a wrong one.</li>
          <li><strong>0</strong> for “Don’t know”. When in doubt, throw it out.</li>
          <li>Everyone gets the same 20 today. A new set appears at midnight.</li>
        </ul>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" data-action="start">Play today’s 20</button>
        <a class="btn btn-secondary" href="#/practice">Practice round</a>
      </div>
    </section>`;
}

function currentIndex() {
  return revealed ? game.answers.length - 1 : game.answers.length;
}

function viewQuestion() {
  const idx = currentIndex();
  const q = game.questions[idx];
  const target = species[q.target];
  const results = game.answers.map((a, i) => judge(game.questions[i], a, species));
  const score = results.filter((r) => r === 'correct').length - results.filter((r) => r === 'wrong' || r === 'deadly').length;
  const dots = game.questions.map((_, i) => {
    const cls = i < results.length ? results[i] : i === idx ? 'current' : '';
    return `<span class="${cls}"></span>`;
  }).join('');

  app.innerHTML = `
    <section class="game ${revealed ? 'revealed' : 'answering'}">
      <div class="game-head">
        <span>${game.mode === 'daily' ? `#${game.number}` : 'Practice'}</span>
        <span>Question ${idx + 1} of ${game.questions.length}</span>
        <span>Score ${score}</span>
      </div>
      <div class="progress" aria-hidden="true">${dots}</div>
      <div class="prompt">
        <p class="which">Which one is…</p>
        <h2>${esc(target.common)}</h2>
        <p class="sci">${esc(target.scientific)}</p>
      </div>
      <div class="choices">${card(q, 'left', idx)}${card(q, 'right', idx)}</div>
      ${revealed ? feedback(q, game.answers[idx]) : `
        <div class="actions">
          <button class="btn btn-secondary" data-action="unsure">🤷 Don’t know</button>
          <p class="hint">Tap a photo to choose<span class="kbd-hint"> · <kbd>←</kbd> <kbd>→</kbd> to pick, <kbd>↓</kbd> for don’t know</span></p>
        </div>`}
    </section>`;

  if (revealed) {
    app.querySelector('[data-action="next"]')?.focus({ preventScroll: true });
    app.querySelector('.feedback')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else {
    preload(game.questions[idx + 1]);
  }
}

function card(q, side, idx) {
  const c = q[side];
  const photo = photoById.get(c.photo);
  const sp = species[c.species];
  const isAnswer = q.answer === side;
  const picked = game.answers[idx] === side;
  let cls = 'card';
  let verdict = '';
  if (revealed) {
    if (isAnswer) {
      cls += ' is-correct';
      verdict = `<span class="verdict">✓ ${picked ? 'Correct' : 'This one'}</span>`;
    } else if (picked) {
      cls += ' is-wrong';
      verdict = '<span class="verdict">✗ Your pick</span>';
    } else {
      cls += ' is-faded';
    }
  }
  const sideName = side === 'left' ? 'Left' : 'Right';
  const alt = revealed ? `${sp.common} (${sp.scientific})` : `${sideName} mystery mushroom`;
  return `
    <div class="${cls}">
      <button class="card-pick" data-pick="${side}" ${revealed ? 'disabled' : ''} aria-label="${esc(revealed ? sp.common : `Choose the ${side} photo`)}"
        style="--photo: url('${esc(new URL(photo.file, location.href).href)}')">
        <img src="${esc(photo.file)}" alt="${esc(alt)}" width="${photo.w}" height="${photo.h}">
      </button>
      ${revealed ? verdict : `<span class="side-label">${side === 'left' ? '← Left' : 'Right →'}</span>`}
      <button class="icon-btn zoom" data-zoom="${esc(photo.id)}" aria-label="Enlarge ${side} photo">${ICON_ZOOM}</button>
      ${revealed ? `
        <div class="reveal">
          <div class="name">${esc(sp.common)}</div>
          <div class="sci">${esc(sp.scientific)}</div>
          ${badge(sp)}
        </div>` : ''}
      <div class="credit">${credit(photo)}</div>
    </div>`;
}

function badge(sp) {
  const e = EDIBILITY[sp.edibility];
  return `<span class="badge ${e.tone}">${e.icon} ${esc(sp.edibilityLabel || e.label)}</span>`;
}

function credit(photo) {
  const lic = LICENSES[photo.license];
  return `Photo: ${esc(photo.author)} · <a href="${lic.url}" target="_blank" rel="noopener license">${lic.label}</a>
    · <a href="${esc(photo.source)}" target="_blank" rel="noopener">iNaturalist</a>`;
}

const HEADLINES = {
  correct: ['Correct! +1', ''],
  wrong: ['Not quite. −1', ''],
  deadly: ['Not quite, and this mix-up can kill. −1', ''],
  unsure: ['Skipped. 0 points', 'When in doubt, throw it out.'],
};

function feedback(q, answer) {
  const result = judge(q, answer, species);
  const pair = pairById.get(q.pair);
  const [headline, sub] = HEADLINES[result];
  const last = game.answers.length === game.questions.length;
  return `
    <div class="feedback ${result}">
      <h3>${headline}</h3>
      ${sub ? `<p>${sub}</p>` : ''}
      <p><span class="tip-label">How to tell them apart:</span> ${esc(pair.tip)}</p>
      <p class="region">Where people mix these up: ${esc(pair.region)}</p>
      <div class="btn-row"><button class="btn btn-primary" data-action="next">${last ? 'See results' : 'Next'} →</button></div>
    </div>`;
}

function preload(q) {
  if (!q) return;
  for (const side of ['left', 'right']) new Image().src = photoById.get(q[side].photo).file;
}

function answer(choice) {
  if (revealed || !game.started || game.answers.length >= game.questions.length) return;
  game.answers.push(choice);
  revealed = true;
  persist();
  viewQuestion();
}

function next() {
  if (!revealed) return;
  revealed = false;
  renderGame();
  window.scrollTo({ top: 0 });
  app.focus({ preventScroll: true });
}

function viewResults() {
  const r = scoreGame(game.questions, game.answers, species);
  const rank = rankFor(r.score);
  const daily = game.mode === 'daily';
  const closeCalls = [...new Set(r.closeCalls)].map((s) => species[s].common);
  const cells = r.results.map((res, i) => `<span class="${res}" title="Question ${i + 1}: ${res}"></span>`).join('');
  const review = game.questions.map((q, i) => {
    const other = q[q.answer === 'left' ? 'right' : 'left'].species;
    const label = { correct: '✓', wrong: '✗', deadly: '💀', unsure: '?' }[r.results[i]];
    return `<li><span class="res ${r.results[i]}">${label}</span>
      <a href="#/guide/${esc(q.pair)}">${esc(species[q.target].common)}</a>
      <span class="muted">vs ${esc(species[other].common)}</span></li>`;
  }).join('');

  app.innerHTML = `
    <section class="results">
      <p class="eyebrow">${daily ? `Mushroom ID #${game.number} · ${formatDate(game.key)}` : 'Practice round'}</p>
      <div class="rank-emoji" aria-hidden="true">${rank.emoji}</div>
      <h1 class="rank-title">${esc(rank.title)}</h1>
      <p class="blurb">${esc(rank.blurb)}</p>
      <div class="score-big">${r.score}<small> / ${QUESTIONS_PER_GAME}</small></div>
      <div class="breakdown"><span>✓ ${r.correct} correct</span><span>✗ ${r.wrong} wrong</span><span>? ${r.unsure} don’t know</span></div>
      <div class="grid" aria-hidden="true">${cells}</div>
      ${closeCalls.length ? `
        <div class="callout">
          <p><strong>💀 Close calls: ${r.closeCalls.length}</strong></p>
          <p>You mixed up a deadly species with its lookalike: ${esc(closeCalls.join(', '))}. In the woods, that could have been fatal.</p>
        </div>` : r.score > 0 ? `
        <div class="callout safe"><p><strong>No deadly mix-ups.</strong> You never confused a deadly mushroom with its lookalike.</p></div>` : ''}
      <div class="btn-row">
        ${daily ? '<button class="btn btn-primary" data-action="share">Share result</button>' : '<button class="btn btn-primary" data-action="practice-again">Another practice round</button>'}
        ${daily ? '<a class="btn btn-secondary" href="#/practice">Practice round</a>' : '<a class="btn btn-secondary" href="#/">Today’s puzzle</a>'}
        <button class="btn btn-secondary" data-action="stats">Statistics</button>
      </div>
      ${daily ? '<p class="next-in">New mushrooms in <strong id="countdown"></strong></p>' : ''}
      <div class="review">
        <h3>Review today’s pairs</h3>
        <ol>${review}</ol>
      </div>
    </section>`;
  if (daily) startCountdown();
}

function startCountdown() {
  const el = document.getElementById('countdown');
  const tick = () => {
    const ms = msUntilTomorrow();
    if (game.key !== dateKey()) {
      clearInterval(countdownTimer);
      el.innerHTML = '<a href="#/" data-action="reload-daily">now: play the new puzzle</a>';
      return;
    }
    const s = Math.floor(ms / 1000);
    el.textContent = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

// ---------- Other pages ----------

function viewGuide(focusPair) {
  const pairs = content.pairs.map((p) => `
    <article class="guide-pair" id="pair-${esc(p.id)}">
      <h2>${esc(species[p.a].common)} vs ${esc(species[p.b].common)}</h2>
      <p class="region">${esc(p.region)}</p>
      <div class="guide-cards">${guideCard(p.a)}${guideCard(p.b)}</div>
      <p class="tip"><strong>How to tell them apart:</strong> ${esc(p.tip)}</p>
      <p class="sources">Sources: ${p.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' · ')}</p>
    </article>`).join('');
  app.innerHTML = `
    <section>
      <div class="page-head">
        <h1>Field guide</h1>
        <p>All ${content.pairs.length} lookalike pairs in the game, with the features that tell them apart.
          Tap a photo to enlarge it. This is a study aid, not an identification guide.</p>
      </div>
      ${pairs}
    </section>`;
  const target = focusPair && document.getElementById(`pair-${focusPair}`);
  if (target) target.scrollIntoView();
  else window.scrollTo({ top: 0 });
}

function guideCard(sid) {
  const sp = species[sid];
  const photo = photosBySpecies[sid][0];
  return `
    <div class="guide-card">
      <img src="${esc(photo.file)}" alt="${esc(`${sp.common} (${sp.scientific})`)}" loading="lazy" width="${photo.w}" height="${photo.h}" data-zoom="${esc(photo.id)}">
      <div class="name">${esc(sp.common)}</div>
      <div class="sci">${esc(sp.scientific)}</div>
      ${badge(sp)}
      <p class="note">${esc(sp.note)}</p>
    </div>`;
}

function viewCredits() {
  const sections = Object.entries(photosBySpecies).map(([sid, list]) => `
    <section class="credits-species">
      <h2>${esc(species[sid].common)} <span class="sci"><em>${esc(species[sid].scientific)}</em></span></h2>
      <ul>${list.map((p) => `<li>${p.taxon !== species[sid].scientific ? `<em>${esc(p.taxon)}</em>: ` : ''}${credit(p)}</li>`).join('')}</ul>
    </section>`).join('');
  app.innerHTML = `
    <section class="prose">
      <div class="page-head">
        <h1>Photo credits</h1>
        <p>Every photo comes from a research-grade observation on <a href="https://www.inaturalist.org" target="_blank" rel="noopener">iNaturalist</a>,
          where the photographer chose a CC0, CC BY or CC BY-SA licence. Photos were resized and converted to WebP;
          no other changes were made. Thank you to everyone who shares their observations openly.</p>
      </div>
      ${sections}
    </section>`;
  window.scrollTo({ top: 0 });
}

function viewAbout() {
  app.innerHTML = `
    <section class="prose">
      <div class="page-head"><h1>About Mushroom ID</h1></div>
      <p>Mushroom ID is a daily training game for telling apart mushrooms that are easy to confuse.
        Each pair in the game is a documented lookalike: many are behind real poisoning cases.</p>
      <h2>How the daily puzzle works</h2>
      <ul>
        <li>The 20 questions are chosen from the date, so everyone gets the same set on the same day (your local date).</li>
        <li>Each question uses one pair. We name one of the two species and randomise which side it appears on.</li>
        <li>Scoring is +1 for a correct pick, −1 for a wrong one and 0 for “Don’t know”, so a guess only pays off if you know more than a coin does.</li>
        <li>A 💀 marks a mix-up between a deadly species and its lookalike.</li>
      </ul>
      <h2>Ranks</h2>
      <ul>${RANKS.map((r, i) => `<li>${r.emoji} <strong>${esc(r.title)}</strong>: ${rankRange(i)}</li>`).join('')}</ul>
      <h2>Sources</h2>
      <p>The lookalike pairs, edibility ratings and identification tips were researched from mycological societies,
        university extension services, poison-centre reports and specialist guides. Each pair’s sources are linked in the
        <a href="#/guide">field guide</a>. Photos are from iNaturalist; see <a href="#/credits">photo credits</a>.</p>
      <h2>Safety</h2>
      <p><strong>This is a game, not an identification guide.</strong> Photos can’t show smell, spore print colour,
        texture or habitat, and many dangerous species vary a lot in appearance. Never eat a wild mushroom unless an
        experienced local expert has identified it in person. If you think someone has eaten a poisonous mushroom,
        contact a poison centre or emergency services immediately, even if they feel fine.</p>
    </section>`;
  window.scrollTo({ top: 0 });
}

function rankRange(i) {
  const min = RANKS[i].min;
  const max = i === 0 ? QUESTIONS_PER_GAME : RANKS[i - 1].min - 1;
  if (min === -Infinity) return `${max} or less`;
  return min === max ? `${min}` : `${min} to ${max}`;
}

// ---------- Modals ----------

function openModal(html) {
  modalBody.innerHTML = html;
  if (!modal.open) modal.showModal();
}

function showHelp() {
  openModal(`
    <h2>How to play</h2>
    <p>Each question shows two mushrooms that are easily confused, and names one of them. Pick the one we named.</p>
    <ul>
      <li><strong>+1</strong> for a correct pick, <strong>−1</strong> for a wrong one.</li>
      <li><strong>0</strong> for “Don’t know”. Foragers live by <em>“when in doubt, throw it out”</em>.</li>
      <li>After each answer you’ll see both names, how edible (or deadly) they are, and how to tell them apart.</li>
      <li>There are 20 questions a day, the same for everyone. Your score earns a forager rank.</li>
      <li>Keyboard: <kbd>←</kbd> / <kbd>→</kbd> to pick, <kbd>↓</kbd> for don’t know, <kbd>Enter</kbd> for next.</li>
    </ul>
    <p><strong>Never eat a wild mushroom because of this game.</strong> Photos can’t show smell, spore print or habitat.</p>
    <div class="btn-row"><button class="btn btn-primary" data-action="close-modal">Got it</button></div>`);
}

function showStats() {
  const s = computeStats(load('history', {}), dateKey());
  const maxCount = Math.max(1, ...s.distribution.map((d) => d.count));
  const rows = s.distribution.map((d) => `
    <span>${d.emoji} ${esc(d.title)}</span>
    <span class="bar ${d.count ? '' : 'empty'}"><i style="width:${(d.count / maxCount) * 100}%"></i><b>${d.count}</b></span>`).join('');
  openModal(`
    <h2>Statistics</h2>
    <div class="stat-tiles">
      <div><strong>${s.played}</strong><span>Played</span></div>
      <div><strong>${s.average === null ? '–' : s.average.toFixed(1)}</strong><span>Average</span></div>
      <div><strong>${s.best ?? '–'}</strong><span>Best</span></div>
      <div><strong>${s.streak}</strong><span>Streak</span></div>
      <div><strong>${s.maxStreak}</strong><span>Max streak</span></div>
    </div>
    <h3>Ranks earned</h3>
    <div class="dist">${rows}</div>`);
}

function showLightbox(photoId) {
  const photo = photoById.get(photoId);
  if (!photo) return;
  const img = lightbox.querySelector('img');
  img.src = photo.file;
  img.alt = 'Enlarged photo';
  lightbox.hidden = false;
}

function closeLightbox() {
  lightbox.hidden = true;
}

// ---------- Sharing ----------

async function share() {
  const r = scoreGame(game.questions, game.answers, species);
  const url = location.href.split('#')[0];
  const text = shareText({ number: game.number, score: r.score, results: r.results, url });
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Result copied to clipboard');
  } catch {
    toast('Couldn’t copy. Select and copy it from the next screen.');
    openModal(`<h2>Your result</h2><pre style="white-space:pre-wrap">${esc(text)}</pre>`);
  }
}

let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// ---------- Events ----------

function onClick(e) {
  const zoom = e.target.closest('[data-zoom]');
  if (zoom) {
    e.preventDefault();
    return showLightbox(zoom.dataset.zoom);
  }
  if (!lightbox.hidden && e.target.closest('#lightbox')) return closeLightbox();
  const pick = e.target.closest('[data-pick]');
  if (pick) return answer(pick.dataset.pick);
  if (e.target === modal) return modal.close(); // backdrop click
  const action = e.target.closest('[data-action]')?.dataset.action;
  switch (action) {
    case 'start':
      game.started = true;
      persist();
      renderGame();
      return window.scrollTo({ top: 0 });
    case 'unsure': return answer('unsure');
    case 'next': return next();
    case 'share': return share();
    case 'help': return showHelp();
    case 'stats': return showStats();
    case 'close-modal': return modal.close();
    case 'close-lightbox': return closeLightbox();
    case 'practice-again':
      startPractice();
      game = practice;
      revealed = false;
      return renderGame();
    case 'reload-daily':
      e.preventDefault();
      return route();
    default:
  }
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!lightbox.hidden) {
    if (e.key === 'Escape') closeLightbox();
    return;
  }
  if (modal.open || !game || location.hash.match(/^#\/(guide|credits|about)/)) return;
  if (!revealed && game.started && game.answers.length < game.questions.length) {
    const choice = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'unsure' }[e.key];
    if (choice) {
      e.preventDefault();
      answer(choice);
    }
  } else if (revealed && e.key === 'Enter') {
    e.preventDefault(); // stop the focused Next button from also firing a click
    next();
  }
}

function formatDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

init();
