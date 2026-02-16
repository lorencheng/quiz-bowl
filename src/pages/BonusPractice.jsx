import { useState, useEffect, useCallback, useRef } from 'react'
import { getRandomBonus, checkAnswer } from '../api/qbreader'
import useTTS from '../hooks/useTTS'
import useSpeechRecognition from '../hooks/useSpeechRecognition'
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
  const [partResults, setPartResults] = useState([])
  const [answer, setAnswer] = useState('')
  const [currentWords, setCurrentWords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [totalScore, setTotalScore] = useState({ total: 0, bonuses: 0, thirties: 0 })
  const [voiceDisabled, setVoiceDisabled] = useState(false)

  const answerInputRef = useRef(null)
  const submittingRef = useRef(false)
  const tts = useTTS({ rate: settings.rate, voiceURI: settings.voiceURI })

  // Submit answer for current part (extracted so voice and keyboard can both call)
  const doSubmit = useCallback(async (answerText) => {
    if (!answerText.trim() || !bonus) return
    if (submittingRef.current) return
    submittingRef.current = true

    const expectedAnswer = bonus.answers_sanitized?.[currentPart] || bonus.answers[currentPart]
    try {
      const res = await checkAnswer(answerText.trim(), expectedAnswer)
      const correct = res.directive === 'accept'
      const points = correct ? 10 : 0

      const newResults = [...partResults, { correct, points, userAnswer: answerText.trim() }]
      setPartResults(newResults)
      setAnswer('')
      setPhase(PHASE.PART_RESULT)

      setTimeout(() => {
        if (currentPart < bonus.parts.length - 1) {
          readPart(bonus, currentPart + 1)
        } else {
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
    } finally {
      submittingRef.current = false
    }
  }, [bonus, currentPart, partResults]) // eslint-disable-line react-hooks/exhaustive-deps

  // Voice recognition callbacks
  const handleVoiceFinal = useCallback((transcript) => {
    if (phase !== PHASE.ANSWERING) return
    setAnswer(transcript)
    doSubmit(transcript)
  }, [phase, doSubmit])

  const handleVoiceInterim = useCallback((transcript) => {
    if (phase !== PHASE.ANSWERING || voiceDisabled) return
    setAnswer(transcript)
  }, [phase, voiceDisabled])

  const speech = useSpeechRecognition({
    onFinalResult: handleVoiceFinal,
    onInterimResult: handleVoiceInterim,
  })

  // Start voice recognition when answering phase begins
  useEffect(() => {
    if (phase === PHASE.ANSWERING && speech.supported && !voiceDisabled) {
      speech.start()
    }
    if (phase !== PHASE.ANSWERING) {
      speech.reset()
      setVoiceDisabled(false)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

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
    speech.reset()
    setPhase(PHASE.IDLE)
    setPartResults([])
    setAnswer('')
    setCurrentPart(0)
    setCurrentWords([])
    setVoiceDisabled(false)

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

      const leadinText = b.leadin_sanitized || b.leadin
      const words = leadinText.split(/\s+/).filter(Boolean)
      setCurrentWords(words)
      setPhase(PHASE.READING_LEADIN)
      tts.speak(words)
    } catch (err) {
      setError('Failed to fetch bonus: ' + err.message)
      setLoading(false)
    }
  }, [settings.categories, settings.difficulties, tts]) // eslint-disable-line react-hooks/exhaustive-deps

  // Submit from keyboard
  const handleSubmit = useCallback(() => {
    if (phase !== PHASE.ANSWERING || !answer.trim()) return
    speech.stop()
    doSubmit(answer)
  }, [phase, answer, doSubmit, speech])

  // Handle typing — disable voice on first keypress
  const handleAnswerKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSubmit()
      return
    }
    if (!voiceDisabled && speech.listening) {
      speech.stop()
      setVoiceDisabled(true)
    }
  }, [handleSubmit, voiceDisabled, speech])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space' && (phase === PHASE.READING_PART || phase === PHASE.READING_LEADIN)) {
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
            <div className="answer-input-wrapper">
              <input
                ref={answerInputRef}
                type="text"
                className={`answer-input ${speech.listening ? 'listening' : ''}`}
                placeholder={speech.listening ? 'Listening... (or start typing)' : 'Type your answer...'}
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={handleAnswerKeyDown}
              />
              {speech.supported && (
                <span className={`mic-status ${speech.listening ? 'active' : ''}`}>
                  {speech.listening ? '🎤' : ''}
                </span>
              )}
            </div>
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
