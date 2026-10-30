import { PAIRS } from '../data/pairs'
import { SPECIES_BY_ID, type Edibility } from '../data/species'
import type { Question } from './generate'

export type Choice = 'left' | 'right' | 'pass'
export type Outcome = 'correct' | 'wrong' | 'pass'

const PAIR_BY_ID = Object.fromEntries(PAIRS.map((p) => [p.id, p]))

export function outcomeOf(q: Question, choice: Choice): Outcome {
  if (choice === 'pass') return 'pass'
  const picked = choice === 'left' ? q.left.species : q.right.species
  return picked === q.target ? 'correct' : 'wrong'
}

/** The worst edibility in a pair: what a confusion could cost you. */
export function pairDanger(pairId: string): 'deadly' | 'toxic' | 'none' {
  const p = PAIR_BY_ID[pairId]
  const eds: Edibility[] = [SPECIES_BY_ID[p.a].edibility, SPECIES_BY_ID[p.b].edibility]
  if (eds.includes('deadly')) return 'deadly'
  if (eds.includes('toxic')) return 'toxic'
  return 'none'
}

export interface Summary {
  total: number
  correct: number
  wrong: number
  passed: number
  deadlyMistakes: number
  toxicMistakes: number
  outcomes: Outcome[]
  dangers: ('deadly' | 'toxic' | 'none')[]
}

export function summarize(questions: Question[], choices: Choice[]): Summary {
  const outcomes = questions.map((q, i) => outcomeOf(q, choices[i] ?? 'pass'))
  const dangers = questions.map((q) => pairDanger(q.pairId))
  let deadlyMistakes = 0
  let toxicMistakes = 0
  outcomes.forEach((o, i) => {
    if (o !== 'wrong') return
    if (dangers[i] === 'deadly') deadlyMistakes++
    else if (dangers[i] === 'toxic') toxicMistakes++
  })
  return {
    total: questions.length,
    correct: outcomes.filter((o) => o === 'correct').length,
    wrong: outcomes.filter((o) => o === 'wrong').length,
    passed: outcomes.filter((o) => o === 'pass').length,
    deadlyMistakes,
    toxicMistakes,
    outcomes,
    dangers,
  }
}

export interface Rank {
  title: string
  emoji: string
  blurb: string
}

/** Mushroom-flavoured ranks, by number correct out of 20. */
export function rankFor(correct: number, total = 20): Rank {
  const pct = total > 0 ? correct / total : 0
  if (pct >= 1) return { title: 'Mycologist', emoji: '🔬', blurb: 'Flawless. The fungi have nothing left to hide from you.' }
  if (pct >= 0.9) return { title: 'Master Forager', emoji: '🧺', blurb: 'Your basket is safe, and so is your dinner.' }
  if (pct >= 0.75) return { title: 'Seasoned Forager', emoji: '🍄', blurb: 'You know your way around the woods. Keep checking the base of the stem.' }
  if (pct >= 0.6) return { title: 'Weekend Forager', emoji: '🥾', blurb: 'Solid instincts. Take a spore print before you take a bite.' }
  if (pct >= 0.45) return { title: 'Curious Beginner', emoji: '🔍', blurb: 'The shapes are starting to make sense. Keep looking closer.' }
  if (pct >= 0.3) return { title: 'Toadstool Tourist', emoji: '🧭', blurb: 'Lovely walk. Please do not bring anything home for dinner.' }
  if (pct >= 0.15) return { title: 'Lost in the Woods', emoji: '🌲', blurb: 'Everything looks the same out there, and that is the problem.' }
  return { title: 'Spore', emoji: '🫧', blurb: 'Everyone starts as a spore. Come back tomorrow and germinate.' }
}

export function emojiGrid(summary: Summary, perRow = 10): string {
  const cells = summary.outcomes.map((o, i) => {
    if (o === 'correct') return '🟩'
    if (o === 'pass') return '⬜'
    return summary.dangers[i] === 'deadly' ? '☠️' : '🟥'
  })
  const rows: string[] = []
  for (let i = 0; i < cells.length; i += perRow) rows.push(cells.slice(i, i + perRow).join(''))
  return rows.join('\n')
}

export function shareText(day: number, summary: Summary, url: string): string {
  const rank = rankFor(summary.correct, summary.total)
  const head = `Mushroom Lookalikes #${day} · ${summary.correct}/${summary.total} · ${rank.title}`
  const extras: string[] = []
  if (summary.deadlyMistakes > 0) extras.push(`☠️ ${summary.deadlyMistakes} deadly mix-up${summary.deadlyMistakes === 1 ? '' : 's'}`)
  if (summary.passed > 0) extras.push(`⬜ ${summary.passed} passed`)
  return [head, extras.join(' · '), emojiGrid(summary), url].filter(Boolean).join('\n')
}
