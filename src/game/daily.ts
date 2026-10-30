/** Puzzle #1 is 30 October 2026, in the player's local time zone (like Wordle). */
const EPOCH = new Date(2026, 9, 30)

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function dayNumber(now: Date = new Date()): number {
  const ms = startOfLocalDay(now).getTime() - startOfLocalDay(EPOCH).getTime()
  return Math.round(ms / 86_400_000) + 1
}

export function msUntilNextPuzzle(now: Date = new Date()): number {
  const next = startOfLocalDay(now)
  next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export function formatDate(now: Date = new Date()): string {
  return now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
