import { useCallback, useEffect, useMemo, useState } from 'react'
import { About } from './components/About'
import { Credits } from './components/Credits'
import { Home } from './components/Home'
import { Quiz } from './components/Quiz'
import { Result } from './components/Result'
import { dayNumber } from './game/daily'
import { dailySeed, generateQuestions, practiceSeed, type Question } from './game/generate'
import type { Choice } from './game/score'
import { loadDaily, loadStats, recordDailyResult, saveDaily, type DailyProgress, type Stats } from './game/storage'

type Route = 'home' | 'daily' | 'practice' | 'credits' | 'about'

function routeFromHash(): Route {
  const h = location.hash.replace(/^#\/?/, '')
  if (h === 'daily' || h === 'practice' || h === 'credits' || h === 'about') return h
  return 'home'
}

function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(routeFromHash)
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = useCallback((r: Route) => {
    location.hash = r === 'home' ? '/' : `/${r}`
    window.scrollTo({ top: 0 })
  }, [])
  return [route, go]
}

export default function App() {
  const [route, go] = useHashRoute()
  const day = useMemo(() => dayNumber(), [])
  const dailyQuestions = useMemo(() => generateQuestions(dailySeed(day)), [day])
  const [progress, setProgress] = useState<DailyProgress>(() => loadDaily(day) ?? { day, choices: [], finished: false })
  const [stats, setStats] = useState<Stats>(loadStats)
  const [practice, setPractice] = useState<{ questions: Question[]; choices: Choice[]; finished: boolean } | null>(null)

  const onDailyChoice = (index: number, choice: Choice) => {
    const choices = progress.choices.slice()
    choices[index] = choice
    const next = { ...progress, choices }
    setProgress(next)
    saveDaily(next)
  }

  const onDailyFinish = () => {
    const next = { ...progress, finished: true }
    setProgress(next)
    saveDaily(next)
    const correct = dailyQuestions.filter((q, i) => {
      const c = next.choices[i]
      return c && c !== 'pass' && q[c].species === q.target
    }).length
    setStats(recordDailyResult(day, correct, dailyQuestions.length))
    window.scrollTo({ top: 0 })
  }

  const startPractice = () => {
    setPractice({ questions: generateQuestions(practiceSeed()), choices: [], finished: false })
    go('practice')
  }

  const noPhotos = dailyQuestions.length === 0

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand" onClick={() => go('home')}>
          <span aria-hidden="true">🍄</span> Mushroom Lookalikes
        </a>
        <nav>
          <a href="#/about">About</a>
          <a href="#/credits">Photo credits</a>
        </nav>
      </header>

      <main>
        {noPhotos && (
          <p className="notice">No photos are bundled yet. Run the photo pipeline in <code>scripts/</code> to populate <code>public/photos</code>.</p>
        )}
        {route === 'home' && <Home day={day} progress={progress} stats={stats} onDaily={() => go('daily')} onPractice={startPractice} />}
        {route === 'daily' &&
          (noPhotos ? null : progress.finished ? (
            <Result day={day} questions={dailyQuestions} choices={progress.choices} stats={stats} onPractice={startPractice} onHome={() => go('home')} />
          ) : (
            <Quiz
              key={`daily-${day}`}
              title={`Daily #${day}`}
              questions={dailyQuestions}
              initialChoices={progress.choices}
              onChoice={onDailyChoice}
              onFinish={onDailyFinish}
              onQuit={() => go('home')}
            />
          ))}
        {route === 'practice' &&
          (practice === null ? (
            <div className="actions actions-col">
              <button type="button" className="btn btn-primary btn-big" onClick={startPractice}>
                Start a practice round
              </button>
            </div>
          ) : practice.finished ? (
            <Result day={null} questions={practice.questions} choices={practice.choices} stats={null} onPractice={startPractice} onHome={() => go('home')} />
          ) : (
            <Quiz
              key={practice.questions[0]?.pairId + practice.questions.length}
              title="Practice"
              questions={practice.questions}
              initialChoices={practice.choices}
              onChoice={(i, c) =>
                setPractice((p) => {
                  if (!p) return p
                  const choices = p.choices.slice()
                  choices[i] = c
                  return { ...p, choices }
                })
              }
              onFinish={() => {
                setPractice((p) => (p ? { ...p, finished: true } : p))
                window.scrollTo({ top: 0 })
              }}
              onQuit={() => go('home')}
            />
          ))}
        {route === 'credits' && <Credits />}
        {route === 'about' && <About />}
      </main>

      <footer className="footer">
        <span>Photos: iNaturalist community, CC licences (see credits).</span>
        <span>A game, not a field guide. Never eat on the strength of an app.</span>
      </footer>
    </div>
  )
}
