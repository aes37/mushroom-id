import type { Choice } from './score'

const PREFIX = 'mushroom-lookalikes:v1:'

export interface DailyProgress {
  day: number
  choices: Choice[]
  finished: boolean
}

export interface Stats {
  played: number
  totalCorrect: number
  streak: number
  maxStreak: number
  lastDay: number | null
  /** Index = number correct. */
  distribution: number[]
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* private mode or storage full: the game still works, it just won't remember */
  }
}

export function loadDaily(day: number): DailyProgress | null {
  const p = read<DailyProgress>(`daily:${day}`)
  return p && p.day === day ? p : null
}

export function saveDaily(p: DailyProgress) {
  write(`daily:${p.day}`, p)
}

export function emptyStats(): Stats {
  return { played: 0, totalCorrect: 0, streak: 0, maxStreak: 0, lastDay: null, distribution: Array(21).fill(0) }
}

export function loadStats(): Stats {
  return read<Stats>('stats') ?? emptyStats()
}

/** Record a finished daily game. Safe to call once per day; repeats are ignored. */
export function recordDailyResult(day: number, correct: number, total: number): Stats {
  const s = loadStats()
  if (s.lastDay === day) return s
  s.played += 1
  s.totalCorrect += correct
  s.streak = s.lastDay === day - 1 ? s.streak + 1 : 1
  s.maxStreak = Math.max(s.maxStreak, s.streak)
  s.lastDay = day
  const bucket = Math.round((correct / Math.max(1, total)) * 20)
  s.distribution[bucket] = (s.distribution[bucket] ?? 0) + 1
  write('stats', s)
  return s
}
