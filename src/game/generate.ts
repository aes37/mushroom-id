import { PAIRS, type Pair } from '../data/pairs'
import { photosFor } from '../data/photos'
import { hashString, mulberry32 } from './rng'

export const QUESTIONS_PER_GAME = 20

export interface Side {
  species: string
  /** Index into the species' photo list. */
  photo: number
}

export interface Question {
  pairId: string
  /** Species id the player is asked to find. */
  target: string
  other: string
  left: Side
  right: Side
}

function playablePairs(): Pair[] {
  return PAIRS.filter((p) => photosFor(p.a).length > 0 && photosFor(p.b).length > 0)
}

/**
 * Pick up to 20 pairs. Pairs are never repeated within a game, and species are
 * not repeated either unless the pool is too small to avoid it.
 */
export function generateQuestions(seed: string, count = QUESTIONS_PER_GAME): Question[] {
  const rng = mulberry32(hashString(seed))
  const pool = rng.shuffle(playablePairs())
  const chosen: Pair[] = []
  const used = new Set<string>()
  for (const p of pool) {
    if (chosen.length >= count) break
    if (used.has(p.a) || used.has(p.b)) continue
    chosen.push(p)
    used.add(p.a)
    used.add(p.b)
  }
  for (const p of pool) {
    if (chosen.length >= count) break
    if (!chosen.includes(p)) chosen.push(p)
  }
  return chosen.map((p) => {
    const askA = rng.next() < 0.5
    const target = askA ? p.a : p.b
    const other = askA ? p.b : p.a
    const targetSide: Side = { species: target, photo: rng.int(photosFor(target).length) }
    const otherSide: Side = { species: other, photo: rng.int(photosFor(other).length) }
    const targetLeft = rng.next() < 0.5
    return {
      pairId: p.id,
      target,
      other,
      left: targetLeft ? targetSide : otherSide,
      right: targetLeft ? otherSide : targetSide,
    }
  })
}

export function dailySeed(day: number): string {
  return `daily-${day}`
}

export function practiceSeed(): string {
  return `practice-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}
