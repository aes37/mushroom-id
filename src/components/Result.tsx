import { useEffect, useState } from 'react'
import { photoUrl, photosFor } from '../data/photos'
import { SPECIES_BY_ID } from '../data/species'
import { formatCountdown, msUntilNextPuzzle } from '../game/daily'
import type { Question } from '../game/generate'
import { emojiGrid, rankFor, shareText, summarize, type Choice } from '../game/score'
import type { Stats } from '../game/storage'
import { Badge } from './Badge'

interface Props {
  day: number | null
  questions: Question[]
  choices: Choice[]
  stats: Stats | null
  onPractice: () => void
  onHome: () => void
}

function useCountdown() {
  const [ms, setMs] = useState(msUntilNextPuzzle())
  useEffect(() => {
    const t = setInterval(() => setMs(msUntilNextPuzzle()), 1000)
    return () => clearInterval(t)
  }, [])
  return ms
}

export function Result({ day, questions, choices, stats, onPractice, onHome }: Props) {
  const summary = summarize(questions, choices)
  const rank = rankFor(summary.correct, summary.total)
  const countdown = useCountdown()
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  const share = async () => {
    const url = `${location.origin}${location.pathname}`
    const text = shareText(day ?? 0, summary, day ? url : '')
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied('idle'), 2500)
  }

  return (
    <section className="result">
      <p className="eyebrow">{day ? `Daily puzzle #${day}` : 'Practice round'}</p>
      <h2 className="score">
        {summary.correct} / {summary.total}
      </h2>
      <p className="rank">
        <span className="rank-emoji" aria-hidden="true">
          {rank.emoji}
        </span>{' '}
        {rank.title}
      </p>
      <p className="rank-blurb">{rank.blurb}</p>

      <pre className="emoji-grid" aria-label="Result grid">
        {emojiGrid(summary)}
      </pre>

      <div className="toxicology">
        <h3>Toxicology report</h3>
        {summary.deadlyMistakes > 0 && (
          <p className="tox tox-deadly">
            ☠️ {summary.deadlyMistakes} deadly mix-up{summary.deadlyMistakes === 1 ? '' : 's'}. In the field, that is the mistake that kills.
          </p>
        )}
        {summary.toxicMistakes > 0 && (
          <p className="tox tox-toxic">
            🤢 {summary.toxicMistakes} poisonous mix-up{summary.toxicMistakes === 1 ? '' : 's'}. A night you would rather forget.
          </p>
        )}
        {summary.deadlyMistakes === 0 && summary.toxicMistakes === 0 && (
          <p className="tox tox-ok">
            🧺 Nothing dangerous confused{summary.passed > 0 ? `, and you passed on ${summary.passed} rather than guess` : ''}. That is exactly how foraging should work.
          </p>
        )}
      </div>

      <div className="actions">
        {day && (
          <button type="button" className="btn btn-primary" onClick={share}>
            {copied === 'done' ? 'Copied!' : copied === 'failed' ? 'Could not copy' : 'Share result'}
          </button>
        )}
        <button type="button" className="btn" onClick={onPractice}>
          Practice round
        </button>
        <button type="button" className="btn btn-ghost" onClick={onHome}>
          Home
        </button>
      </div>

      {day && <p className="countdown">Next puzzle in {formatCountdown(countdown)}</p>}

      {stats && day && (
        <div className="stats">
          <div>
            <strong>{stats.played}</strong>
            <span>played</span>
          </div>
          <div>
            <strong>{stats.played ? Math.round((stats.totalCorrect / (stats.played * 20)) * 100) : 0}%</strong>
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

      <h3 className="review-title">Review</h3>
      <ol className="review">
        {questions.map((q, i) => {
          const t = SPECIES_BY_ID[q.target]
          const o = SPECIES_BY_ID[q.other]
          const outcome = summary.outcomes[i]
          const targetSide = q.left.species === q.target ? q.left : q.right
          const otherSide = q.left.species === q.target ? q.right : q.left
          return (
            <li key={i} className={`review-item review-${outcome}`}>
              <img src={photoUrl(photosFor(targetSide.species)[targetSide.photo])} alt={t.common} loading="lazy" />
              <img src={photoUrl(photosFor(otherSide.species)[otherSide.photo])} alt={o.common} loading="lazy" className="review-other" />
              <div>
                <div className="review-outcome">
                  {outcome === 'correct' ? '✅' : outcome === 'pass' ? '⬜' : summary.dangers[i] === 'deadly' ? '☠️' : '❌'}{' '}
                  <strong>{t.common}</strong> <Badge edibility={t.edibility} />
                </div>
                <div className="review-sub">
                  vs {o.common} <Badge edibility={o.edibility} />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
