import { useState, useEffect, useCallback, useRef } from 'react'
import { getRandomBonus, checkAnswer } from '../api/qbreader'
import useTTS from '../hooks/useTTS'
import Settings from '../components/Settings'
import '../components/Settings.css'
import './Practice.css'

const PHASE = {
  IDLE: 'idle',
  READING_LEADIN: 'reading_leadin',
  READING_PART: 'reading_part',
  ANSWERING: 'answering',
  PART_RESULT: 'part_result',
  DONE: 'done',
}

export default function BonusPractice() {
  const [settings, setSettings] = useState({
    rate: 1,
    voiceURI: undefined,
    categories: [],
    difficulties: [],
  })
  const [bonus, setBonus] = useState(null)
  const [phase, setPhase] = useState(PHASE.IDLE)
  const [currentPart, setCurrentPart] = useState(0)
  const [partResults, setPartResults] = useState([]) // { correct: bool, points: number }
  const [answer, setAnswer] = useState('')
  const [currentWords, setCurrentWords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [totalScore, setTotalScore] = useState({ total: 0, bonuses: 0, thirties: 0 })

  const answerInputRef = useRef(null)
  const tts = useTTS({ rate: settings.rate, voiceURI: settings.voiceURI })

  // Start reading a part
  const readPart = useCallback((b, partIndex) => {
    const text = b.parts_sanitized?.[partIndex] || b.parts[partIndex]
    const words = text.split(/\s+/).filter(Boolean)
    setCurrentWords(words)
    setCurrentPart(partIndex)
    setPhase(PHASE.READING_PART)
    tts.speak(words)
  }, [tts])

  // When TTS finishes reading a part, transition to answering
  useEffect(() => {
    if (tts.done && (phase === PHASE.READING_PART || phase === PHASE.READING_LEADIN)) {
      if (phase === PHASE.READING_LEADIN) {
        // After leadin, read part 0
        readPart(bonus, 0)
      } else {
        setPhase(PHASE.ANSWERING)
        setTimeout(() => answerInputRef.current?.focus(), 50)
      }
    }
  }, [tts.done, phase, bonus, readPart])

  // Fetch a new bonus
  const fetchBonus = useCallback(async () => {
    setLoading(true)
    setError(null)
    tts.reset()
    setPhase(PHASE.IDLE)
    setPartResults([])
    setAnswer('')
    setCurrentPart(0)
    setCurrentWords([])

    try {
      const opts = {}
      if (settings.categories.length > 0) opts.categories = settings.categories
      if (settings.difficulties.length > 0) opts.difficulties = settings.difficulties
      const bonuses = await getRandomBonus(opts)
      if (!bonuses || bonuses.length === 0) {
        setError('No bonuses found. Try different filters.')
        setLoading(false)
        return
      }
      const b = bonuses[0]
      setBonus(b)
      setLoading(false)

      // Read leadin first
      const leadinText = b.leadin_sanitized || b.leadin
      const words = leadinText.split(/\s+/).filter(Boolean)
      setCurrentWords(words)
      setPhase(PHASE.READING_LEADIN)
      tts.speak(words)
    } catch (err) {
      setError('Failed to fetch bonus: ' + err.message)
      setLoading(false)
    }
  }, [settings.categories, settings.difficulties, tts])

  // Submit answer for current part
  const handleSubmit = useCallback(async () => {
    if (phase !== PHASE.ANSWERING || !answer.trim()) return

    const expectedAnswer = bonus.answers_sanitized?.[currentPart] || bonus.answers[currentPart]
    try {
      const res = await checkAnswer(answer.trim(), expectedAnswer)
      const correct = res.directive === 'accept'
      const points = correct ? 10 : 0

      const newResults = [...partResults, { correct, points, userAnswer: answer.trim() }]
      setPartResults(newResults)
      setAnswer('')
      setPhase(PHASE.PART_RESULT)

      // After a short delay, either move to next part or finish
      setTimeout(() => {
        if (currentPart < bonus.parts.length - 1) {
          readPart(bonus, currentPart + 1)
        } else {
          // All parts done
          const bonusTotal = newResults.reduce((sum, r) => sum + r.points, 0)
          setTotalScore(prev => ({
            total: prev.total + bonusTotal,
            bonuses: prev.bonuses + 1,
            thirties: prev.thirties + (bonusTotal === 30 ? 1 : 0),
          }))
          setPhase(PHASE.DONE)
        }
      }, 1500)
    } catch (err) {
      setError('Failed to check answer: ' + err.message)
    }
  }, [phase, answer, bonus, currentPart, partResults, readPart])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space' && (phase === PHASE.READING_PART || phase === PHASE.READING_LEADIN)) {
        // Skip TTS and go to answering (for reading_part) or first part (for leadin)
        e.preventDefault()
        tts.stop()
      } else if (e.code === 'KeyN' && phase === PHASE.DONE) {
        e.preventDefault()
        fetchBonus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, tts, fetchBonus])

  const bonusTotal = partResults.reduce((sum, r) => sum + r.points, 0)

  return (
    <div className="practice-page">
      <h1>Bonus Practice</h1>

      <Settings settings={settings} onChange={setSettings} voices={tts.voices} />

      <div className="scoreboard">
        <span>Total: <strong>{totalScore.total}</strong></span>
        <span>Bonuses: {totalScore.bonuses}</span>
        <span>30s: {totalScore.thirties}</span>
        {totalScore.bonuses > 0 && (
          <span>PPB: {(totalScore.total / totalScore.bonuses).toFixed(1)}</span>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {bonus && (
        <div className="question-area">
          <div className="question-meta">
            <span className="meta-tag">{bonus.category}</span>
            {bonus.subcategory && <span className="meta-tag">{bonus.subcategory}</span>}
            <span className="meta-tag">Diff: {bonus.difficulty}</span>
            {bonus.set && <span className="meta-tag">{bonus.set.name}</span>}
          </div>

          {/* Leadin */}
          <div className="leadin-text">
            {phase === PHASE.READING_LEADIN
              ? currentWords.map((word, i) => (
                  <span key={i} className={`word ${i === tts.wordIndex ? 'highlight' : ''}`}>
                    {(tts.done || i <= tts.wordIndex) ? word + ' ' : ''}
                  </span>
                ))
              : (bonus.leadin_sanitized || bonus.leadin)
            }
          </div>

          {/* Parts */}
          {bonus.parts.map((part, idx) => {
            const partText = bonus.parts_sanitized?.[idx] || part
            const isActive = idx === currentPart && (phase === PHASE.READING_PART || phase === PHASE.ANSWERING || phase === PHASE.PART_RESULT)
            const isDone = idx < partResults.length
            const isFuture = idx > currentPart || (idx === currentPart && phase === PHASE.READING_LEADIN)

            return (
              <div key={idx} className={`bonus-part ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                <div className="bonus-part-header">Part {idx + 1} (10 pts)</div>

                {isFuture ? (
                  <div className="question-text" style={{ minHeight: 40, color: '#aaa' }}>...</div>
                ) : (
                  <div className="question-text">
                    {isActive && phase === PHASE.READING_PART
                      ? currentWords.map((word, i) => (
                          <span key={i} className={`word ${i === tts.wordIndex ? 'highlight' : ''}`}>
                            {(tts.done || i <= tts.wordIndex) ? word + ' ' : ''}
                          </span>
                        ))
                      : partText
                    }
                    {isActive && phase === PHASE.READING_PART && <span className="cursor-blink">|</span>}
                  </div>
                )}

                {isDone && (
                  <div className={`bonus-part-result ${partResults[idx].correct ? 'correct' : 'incorrect'}`}>
                    {partResults[idx].correct ? 'Correct!' : 'Incorrect.'} Your answer: {partResults[idx].userAnswer}
                    <br />
                    <strong>Answer:</strong>{' '}
                    <span dangerouslySetInnerHTML={{ __html: bonus.answers[idx] }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="controls">
        {phase === PHASE.IDLE && (
          <button className="btn primary" onClick={fetchBonus} disabled={loading}>
            {loading ? 'Loading...' : 'Start'}
          </button>
        )}

        {phase === PHASE.ANSWERING && (
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

        {phase === PHASE.DONE && (
          <div className="result-area">
            <div className={`bonus-score-summary ${bonusTotal === 30 ? 'correct' : bonusTotal === 0 ? 'incorrect' : ''}`}>
              Bonus Score: {bonusTotal}/30
            </div>
            <button className="btn primary" onClick={fetchBonus}>
              Next Bonus (N)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
