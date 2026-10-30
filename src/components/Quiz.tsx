import { useCallback, useEffect, useMemo, useState } from 'react'
import { PAIRS } from '../data/pairs'
import { photoUrl, photosFor } from '../data/photos'
import { SPECIES_BY_ID } from '../data/species'
import type { Question } from '../game/generate'
import { outcomeOf, type Choice } from '../game/score'
import { Badge } from './Badge'
import { Lightbox } from './Lightbox'
import { PhotoCard, type CardState } from './PhotoCard'

const PAIR_BY_ID = Object.fromEntries(PAIRS.map((p) => [p.id, p]))

interface Props {
  title: string
  questions: Question[]
  initialChoices: Choice[]
  onChoice: (index: number, choice: Choice) => void
  onFinish: () => void
  onQuit: () => void
}

export function Quiz({ title, questions, initialChoices, onChoice, onFinish, onQuit }: Props) {
  const [choices, setChoices] = useState<Choice[]>(initialChoices)
  // Resume at the first unanswered question.
  const [index, setIndex] = useState(() => Math.min(initialChoices.length, questions.length - 1))
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null)

  const q = questions[index]
  const choice = choices[index]
  const revealed = choice !== undefined
  const pair = PAIR_BY_ID[q.pairId]
  const target = SPECIES_BY_ID[q.target]
  const other = SPECIES_BY_ID[q.other]
  const isLast = index === questions.length - 1

  // Preload the next question's photos so the reveal-to-next transition is instant.
  useEffect(() => {
    const next = questions[index + 1]
    if (!next) return
    for (const side of [next.left, next.right]) {
      const img = new Image()
      img.src = photoUrl(photosFor(side.species)[side.photo])
    }
  }, [index, questions])

  const answer = useCallback(
    (c: Choice) => {
      if (revealed) return
      const next = choices.slice()
      next[index] = c
      setChoices(next)
      onChoice(index, c)
    },
    [choices, index, onChoice, revealed],
  )

  const advance = useCallback(() => {
    if (!revealed) return
    if (isLast) onFinish()
    else setIndex(index + 1)
  }, [index, isLast, onFinish, revealed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (zoom) return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') answer('left')
      else if (e.key === 'ArrowRight' || e.key === 'b' || e.key === 'B') answer('right')
      else if (e.key === '?' || e.key === 'p' || e.key === 'P') answer('pass')
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, answer, zoom])

  const outcome = revealed ? outcomeOf(q, choice) : null
  const stateFor = (sideKey: 'left' | 'right'): CardState => {
    if (!revealed) return 'idle'
    const isTarget = q[sideKey].species === q.target
    if (isTarget) return 'correct'
    if (choice === sideKey) return 'wrong'
    return 'neutral'
  }

  const feedbackHeadline = useMemo(() => {
    if (outcome === 'correct') return { text: 'Correct', cls: 'ok' }
    if (outcome === 'pass') return { text: "Passed. Not knowing is the forager's safest answer.", cls: 'muted' }
    return { text: `Not quite. That was the ${other.common}.`, cls: 'bad' }
  }, [other.common, outcome])

  return (
    <section className="quiz">
      <header className="quiz-head">
        <button type="button" className="link" onClick={onQuit}>
          ← Home
        </button>
        <div className="quiz-title">{title}</div>
        <div className="quiz-count">
          {index + 1} / {questions.length}
        </div>
      </header>
      <div className="progress" aria-hidden="true">
        <div style={{ width: `${((index + (revealed ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <h2 className="prompt">
        Which one is the <span className="prompt-name">{target.common}</span>?
        <span className="prompt-sci">
          <em>{target.scientific}</em> <Badge edibility={target.edibility} />
        </span>
      </h2>

      <div className="cards">
        <PhotoCard
          side={q.left}
          letter="A"
          revealed={revealed}
          state={stateFor('left')}
          pickedByYou={choice === 'left'}
          onPick={() => answer('left')}
          onZoom={(src, alt) => setZoom({ src, alt })}
        />
        <PhotoCard
          side={q.right}
          letter="B"
          revealed={revealed}
          state={stateFor('right')}
          pickedByYou={choice === 'right'}
          onPick={() => answer('right')}
          onZoom={(src, alt) => setZoom({ src, alt })}
        />
      </div>

      {!revealed ? (
        <div className="actions">
          <button type="button" className="btn btn-pass" onClick={() => answer('pass')}>
            I don't know
          </button>
          <p className="hint">Tap a photo to answer. Keyboard: ← A, → B, P to pass.</p>
        </div>
      ) : (
        <div className="feedback">
          <p className={`feedback-head feedback-${feedbackHeadline.cls}`}>{feedbackHeadline.text}</p>
          <div className="tip">
            <div className="tip-label">How to tell them apart</div>
            <p>{pair.tip}</p>
          </div>
          <div className="notes">
            <p>
              <strong>{target.common}:</strong> {target.note}
            </p>
            <p>
              <strong>{other.common}:</strong> {other.note}
            </p>
          </div>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={advance} autoFocus>
              {isLast ? 'See your score' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {zoom && <Lightbox src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />}
    </section>
  )
}
