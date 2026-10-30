import { formatDate } from '../game/daily'
import type { DailyProgress, Stats } from '../game/storage'

interface Props {
  day: number
  progress: DailyProgress | null
  stats: Stats
  onDaily: () => void
  onPractice: () => void
}

export function Home({ day, progress, stats, onDaily, onPractice }: Props) {
  const dailyLabel = progress?.finished
    ? "See today's result"
    : progress && progress.choices.length > 0
      ? `Continue today's puzzle (${progress.choices.length}/20)`
      : "Play today's puzzle"
  return (
    <section className="home">
      <p className="eyebrow">
        Daily puzzle #{day} · {formatDate()}
      </p>
      <h2>Can you tell the dinner from the deathtrap?</h2>
      <p className="lede">
        Twenty pairs of look-alike mushrooms. One of each pair is named; tap the photo that shows it. Not sure? Say so. In the woods,
        "I don't know" is the answer that keeps you alive.
      </p>
      <div className="actions actions-col">
        <button type="button" className="btn btn-primary btn-big" onClick={onDaily}>
          {dailyLabel}
        </button>
        <button type="button" className="btn btn-big" onClick={onPractice}>
          Practice round (random pairs)
        </button>
      </div>
      {stats.played > 0 && (
        <div className="stats">
          <div>
            <strong>{stats.played}</strong>
            <span>played</span>
          </div>
          <div>
            <strong>{Math.round((stats.totalCorrect / (stats.played * 20)) * 100)}%</strong>
            <span>accuracy</span>
          </div>
          <div>
            <strong>{stats.streak}</strong>
            <span>streak</span>
          </div>
          <div>
            <strong>{stats.maxStreak}</strong>
            <span>best streak</span>
          </div>
        </div>
      )}
      <div className="home-notes">
        <h3>How it works</h3>
        <ul>
          <li>Everyone gets the same 20 pairs each day. A new puzzle arrives at midnight, your local time.</li>
          <li>Pairs are real-world confusions: deadly species next to the edibles they are mistaken for, and classic doubles like morels and false morels.</li>
          <li>Every answer comes with a field tip on how to tell the two apart. Your score and a mushroom-themed rank wait at the end.</li>
          <li>Wrong answers on deadly pairs get a ☠️ in your share grid. Passing costs a point but never a skull.</li>
        </ul>
        <p className="disclaimer">
          <strong>This is a game, not a field guide.</strong> Photos are community-identified iNaturalist observations and can occasionally be
          wrong. Never eat a wild mushroom on the strength of this app, a photo, or a single feature.
        </p>
      </div>
    </section>
  )
}
