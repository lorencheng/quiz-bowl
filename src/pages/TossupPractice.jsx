import { useState, useEffect, useCallback, useRef } from 'react'
import { getRandomTossup, checkAnswer } from '../api/qbreader'
import useTTS from '../hooks/useTTS'
import Settings from '../components/Settings'
import '../components/Settings.css'
import './Practice.css'

const PHASE = {
  IDLE: 'idle',
  READING: 'reading',
  BUZZING: 'buzzing',
  RESULT: 'result',
}

export default function TossupPractice() {
  const [settings, setSettings] = useState({
    rate: 1,
    voiceURI: undefined,
    categories: [],
    difficulties: [],
  })
  const [tossup, setTossup] = useState(null)
  const [words, setWords] = useState([])
  const [phase, setPhase] = useState(PHASE.IDLE)
  const [buzzIndex, setBuzzIndex] = useState(-1)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [score, setScore] = useState({ correct: 0, neg: 0, total: 0, questions: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const answerInputRef = useRef(null)

  const tts = useTTS({ rate: settings.rate, voiceURI: settings.voiceURI })

  // Fetch a new tossup
  const fetchTossup = useCallback(async () => {
    setLoading(true)
    setError(null)
    tts.reset()
    setPhase(PHASE.IDLE)
    setResult(null)
    setAnswer('')
    setBuzzIndex(-1)

    try {
      const opts = {}
      if (settings.categories.length > 0) opts.categories = settings.categories
      if (settings.difficulties.length > 0) opts.difficulties = settings.difficulties
      const tossups = await getRandomTossup(opts)
      if (!tossups || tossups.length === 0) {
        setError('No tossups found. Try different filters.')
        setLoading(false)
        return
      }
      const t = tossups[0]
      setTossup(t)
      // Use sanitized text for TTS, split into words
      const text = t.question_sanitized || t.question
      const w = text.split(/\s+/).filter(Boolean)
      setWords(w)
      setPhase(PHASE.READING)
      setLoading(false)
      // Start reading
      tts.speak(w)
    } catch (err) {
      setError('Failed to fetch tossup: ' + err.message)
      setLoading(false)
    }
  }, [settings.categories, settings.difficulties, tts])

  // Buzz handler
  const handleBuzz = useCallback(() => {
    if (phase !== PHASE.READING) return
    const stoppedAt = tts.stop()
    setBuzzIndex(stoppedAt)
    setPhase(PHASE.BUZZING)
    // Focus the answer input after a short delay
    setTimeout(() => answerInputRef.current?.focus(), 50)
  }, [phase, tts])

  // Submit answer
  const handleSubmit = useCallback(async () => {
    if (phase !== PHASE.BUZZING || !answer.trim()) return
    const expectedAnswer = tossup.answer_sanitized || tossup.answer
    try {
      const res = await checkAnswer(answer.trim(), expectedAnswer)
      const directive = res.directive // "accept", "reject", or "prompt"

      // Determine if power (buzzed before the power mark "(*)")
      const questionText = tossup.question || ''
      const powerMarkPos = questionText.indexOf('(*)')
      const wordsBefore = powerMarkPos >= 0
        ? questionText.substring(0, powerMarkPos).split(/\s+/).filter(Boolean).length
        : -1

      let points = 0
      if (directive === 'accept') {
        if (wordsBefore > 0 && buzzIndex < wordsBefore) {
          points = 15
        } else {
          points = 10
        }
      } else if (directive === 'reject') {
        points = -5
      }
      // "prompt" means partial answer - treat as prompt for more info
      // For simplicity we'll treat prompt like accept with 10 pts

      if (directive === 'prompt') {
        points = 0 // no points yet, but show the prompt
      }

      setResult({
        directive,
        directedPrompt: res.directedPrompt,
        points,
        isPower: points === 15,
      })

      if (directive !== 'prompt') {
        setScore(prev => ({
          correct: prev.correct + (points > 0 ? 1 : 0),
          neg: prev.neg + (points < 0 ? 1 : 0),
          total: prev.total + points,
          questions: prev.questions + 1,
        }))
        setPhase(PHASE.RESULT)
      }
    } catch (err) {
      setError('Failed to check answer: ' + err.message)
    }
  }, [phase, answer, tossup, buzzIndex])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space' && phase === PHASE.READING) {
        e.preventDefault()
        handleBuzz()
      } else if (e.code === 'Enter' && phase === PHASE.BUZZING) {
        e.preventDefault()
        handleSubmit()
      } else if (e.code === 'KeyN' && phase === PHASE.RESULT) {
        e.preventDefault()
        fetchTossup()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, handleBuzz, handleSubmit, fetchTossup])

  return (
    <div className="practice-page">
      <h1>Tossup Practice</h1>

      <Settings settings={settings} onChange={setSettings} voices={tts.voices} />

      {/* Score display */}
      <div className="scoreboard">
        <span>Score: <strong>{score.total}</strong></span>
        <span>Correct: {score.correct}</span>
        <span>Negs: {score.neg}</span>
        <span>Questions: {score.questions}</span>
      </div>

      {/* Error */}
      {error && <div className="error-msg">{error}</div>}

      {/* Question area */}
      {tossup && (
        <div className="question-area">
          <div className="question-meta">
            <span className="meta-tag">{tossup.category}</span>
            {tossup.subcategory && <span className="meta-tag">{tossup.subcategory}</span>}
            <span className="meta-tag">Diff: {tossup.difficulty}</span>
            {tossup.set && <span className="meta-tag">{tossup.set.name}</span>}
          </div>

          <div className="question-text">
            {words.map((word, i) => {
              // Only show words up to current TTS position (or all if buzzed/done)
              const visible = phase === PHASE.RESULT || i <= (phase === PHASE.BUZZING ? buzzIndex : tts.wordIndex)
              if (!visible) return null
              return (
                <span
                  key={i}
                  className={`word ${i === tts.wordIndex && phase === PHASE.READING ? 'highlight' : ''}`}
                >
                  {word}{' '}
                </span>
              )
            })}
            {phase === PHASE.READING && <span className="cursor-blink">|</span>}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="controls">
        {phase === PHASE.IDLE && (
          <button className="btn primary" onClick={fetchTossup} disabled={loading}>
            {loading ? 'Loading...' : 'Start'}
          </button>
        )}

        {phase === PHASE.READING && (
          <div className="buzz-area">
            <button className="btn buzz" onClick={handleBuzz}>
              Buzz! (Space)
            </button>
            {tts.paused ? (
              <button className="btn" onClick={tts.resume}>Resume</button>
            ) : (
              <button className="btn" onClick={tts.pause}>Pause</button>
            )}
          </div>
        )}

        {phase === PHASE.BUZZING && (
          <div className="answer-area">
            <input
              ref={answerInputRef}
              type="text"
              className="answer-input"
              placeholder="Type your answer..."
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
            />
            <button className="btn primary" onClick={handleSubmit}>
              Submit (Enter)
            </button>
          </div>
        )}

        {phase === PHASE.RESULT && (
          <div className="result-area">
            <div className={`result-banner ${result?.points > 0 ? 'correct' : result?.points < 0 ? 'incorrect' : 'neutral'}`}>
              {result?.points > 0
                ? `Correct! ${result.isPower ? '(POWER!) ' : ''}+${result.points}`
                : result?.points < 0
                  ? `Incorrect. ${result.points}`
                  : 'No points'}
            </div>
            <div className="answer-display">
              <strong>Answer:</strong>{' '}
              <span dangerouslySetInnerHTML={{ __html: tossup.answer }} />
            </div>
            <button className="btn primary" onClick={fetchTossup}>
              Next (N)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
