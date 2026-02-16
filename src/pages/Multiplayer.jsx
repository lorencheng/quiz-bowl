import { useState, useEffect, useCallback, useRef } from 'react'
import MultiplayerClient from '../api/multiplayer'
import useTTS from '../hooks/useTTS'
import useSpeechRecognition from '../hooks/useSpeechRecognition'
import './Multiplayer.css'

const VIEW = {
  LOBBY: 'lobby',
  ROOM: 'room',
}

export default function Multiplayer() {
  const [view, setView] = useState(VIEW.LOBBY)
  const [rooms, setRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [username, setUsername] = useState(() => localStorage.getItem('qb_username') || '')
  const [joinRoomName, setJoinRoomName] = useState('')
  const [error, setError] = useState(null)

  // Room state
  const [connected, setConnected] = useState(false)
  const [roomState, setRoomState] = useState(null)
  const [players, setPlayers] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [questionWords, setQuestionWords] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [questionType, setQuestionType] = useState(null) // 'tossup' or 'bonus'
  const [buzzedPlayer, setBuzzedPlayer] = useState(null)
  const [canBuzz, setCanBuzz] = useState(false)
  const [answerResult, setAnswerResult] = useState(null)
  const [answer, setAnswer] = useState('')
  const [bonusPart, setBonusPart] = useState(0)
  const [bonusLeadin, setBonusLeadin] = useState('')
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [ttsRate, setTtsRate] = useState(1)

  const clientRef = useRef(null)
  const answerInputRef = useRef(null)
  const chatInputRef = useRef(null)
  const [chatInput, setChatInput] = useState('')
  const [voiceDisabled, setVoiceDisabled] = useState(false)
  const submittingRef = useRef(false)

  const tts = useTTS({ rate: ttsRate })

  // Submit answer (extracted so voice and keyboard can both call it)
  const doSubmitAnswer = useCallback((answerText) => {
    if (!answerText.trim()) return
    if (submittingRef.current) return
    submittingRef.current = true
    clientRef.current?.giveAnswer(answerText.trim())
    setAnswer('')
    submittingRef.current = false
  }, [])

  // Voice recognition callbacks
  const handleVoiceFinal = useCallback((transcript) => {
    if (!buzzedPlayer || buzzedPlayer.userId !== clientRef.current?.userId) return
    setAnswer(transcript)
    doSubmitAnswer(transcript)
  }, [buzzedPlayer, doSubmitAnswer])

  const handleVoiceInterim = useCallback((transcript) => {
    if (!buzzedPlayer || buzzedPlayer.userId !== clientRef.current?.userId || voiceDisabled) return
    setAnswer(transcript)
    clientRef.current?.giveAnswerLiveUpdate(transcript)
  }, [buzzedPlayer, voiceDisabled])

  const speech = useSpeechRecognition({
    onFinalResult: handleVoiceFinal,
    onInterimResult: handleVoiceInterim,
  })

  // Start voice recognition when this player buzzes
  useEffect(() => {
    const isBuzzed = buzzedPlayer && buzzedPlayer.userId === clientRef.current?.userId
    if (isBuzzed && speech.supported && !voiceDisabled) {
      speech.start()
    }
    if (!isBuzzed) {
      speech.reset()
      setVoiceDisabled(false)
    }
  }, [buzzedPlayer]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch room list
  const fetchRooms = useCallback(async () => {
    setRoomsLoading(true)
    try {
      const res = await fetch('https://www.qbreader.org/api/multiplayer/room-list')
      const data = await res.json()
      setRooms(data || [])
    } catch (err) {
      setError('Failed to fetch rooms: ' + err.message)
    }
    setRoomsLoading(false)
  }, [])

  useEffect(() => {
    if (view === VIEW.LOBBY) fetchRooms()
  }, [view, fetchRooms])

  // Join a room
  const joinRoom = useCallback((roomName) => {
    if (!username.trim()) {
      setError('Please enter a username')
      return
    }
    localStorage.setItem('qb_username', username)
    setError(null)

    const client = new MultiplayerClient()
    clientRef.current = client

    // Connection events
    client.on('_connected', () => {
      setConnected(true)
      setView(VIEW.ROOM)
    })

    client.on('_disconnected', ({ reason }) => {
      setConnected(false)
      setView(VIEW.LOBBY)
      if (reason) setError('Disconnected: ' + reason)
    })

    client.on('_error', () => {
      setError('WebSocket connection error')
    })

    // Initial room state
    client.on('connection-acknowledged', (msg) => {
      setRoomState(msg)
      setPlayers(msg.players || [])
      setCanBuzz(msg.canBuzz || false)
      if (msg.currentQuestionType) setQuestionType(msg.currentQuestionType)
    })

    client.on('connection-acknowledged-question', (msg) => {
      if (msg.question) setCurrentQuestion(msg.question)
      if (msg.currentQuestionType) setQuestionType(msg.currentQuestionType)
    })

    // Player events
    client.on('join', (msg) => {
      setPlayers(prev => {
        if (prev.find(p => p.odId === msg.userId)) return prev
        return [...prev, { odId: msg.userId, odUsername: msg.username, ...msg.user }]
      })
      setChatMessages(prev => [...prev, { system: true, text: `${msg.username} joined` }])
    })

    client.on('leave', (msg) => {
      setPlayers(prev => prev.filter(p => p.odId !== msg.userId))
      setChatMessages(prev => [...prev, { system: true, text: `${msg.username} left` }])
    })

    // Tossup events
    client.on('start-next-tossup', (msg) => {
      setCurrentQuestion(msg.tossup)
      setQuestionType('tossup')
      setQuestionWords([])
      setBuzzedPlayer(null)
      setAnswerResult(null)
      setCanBuzz(true)
      setAnswer('')
    })

    client.on('update-question', (msg) => {
      setQuestionWords(prev => {
        const next = [...prev, msg.word]
        // TTS: speak the new word
        if (ttsEnabled && msg.word) {
          const utt = new SpeechSynthesisUtterance(msg.word)
          utt.rate = ttsRate
          window.speechSynthesis.speak(utt)
        }
        return next
      })
    })

    client.on('buzz', (msg) => {
      setBuzzedPlayer(msg)
      if (msg.userId === client.userId) {
        setCanBuzz(false)
        setTimeout(() => answerInputRef.current?.focus(), 50)
      }
    })

    client.on('give-tossup-answer', (msg) => {
      setAnswerResult(msg)
      setBuzzedPlayer(null)
      if (msg.directive === 'reject') {
        // Others can still buzz
        if (msg.userId === client.userId) setCanBuzz(false)
      }
      // Update player scores
      setPlayers(prev => prev.map(p =>
        p.odId === msg.userId ? { ...p, score: msg.score } : p
      ))
    })

    client.on('reveal-tossup-answer', (msg) => {
      setCanBuzz(false)
      setBuzzedPlayer(null)
      if (msg.answer) {
        setAnswerResult(prev => ({ ...prev, revealedAnswer: msg.answer }))
      }
    })

    client.on('end-current-tossup', () => {
      setCanBuzz(false)
      setBuzzedPlayer(null)
    })

    // Bonus events
    client.on('start-next-bonus', (msg) => {
      setCurrentQuestion(msg.bonus)
      setQuestionType('bonus')
      setBonusPart(0)
      setBonusLeadin('')
      setQuestionWords([])
      setAnswerResult(null)
      setAnswer('')
    })

    client.on('reveal-leadin', (msg) => {
      setBonusLeadin(msg.leadin)
      if (ttsEnabled && msg.leadin) {
        const utt = new SpeechSynthesisUtterance(msg.leadin)
        utt.rate = ttsRate
        window.speechSynthesis.speak(utt)
      }
    })

    client.on('reveal-next-part', (msg) => {
      setBonusPart(msg.currentPartNumber)
      if (ttsEnabled && msg.part) {
        const utt = new SpeechSynthesisUtterance(msg.part)
        utt.rate = ttsRate
        window.speechSynthesis.speak(utt)
      }
    })

    client.on('give-bonus-answer', (msg) => {
      setAnswerResult(msg)
    })

    client.on('end-current-bonus', () => {
      setAnswerResult(null)
    })

    // Chat
    client.on('chat', (msg) => {
      setChatMessages(prev => [...prev, {
        username: msg.username,
        text: msg.message,
        userId: msg.userId,
      }])
    })

    // Pause
    client.on('pause', (msg) => {
      if (msg.paused) {
        window.speechSynthesis.pause()
      } else {
        window.speechSynthesis.resume()
      }
    })

    // Error
    client.on('error', (msg) => {
      setError(msg.message)
    })

    client.on('enforcing-removal', (msg) => {
      setError(`You were ${msg.removalType === 'ban' ? 'banned' : 'kicked'} from the room.`)
      setView(VIEW.LOBBY)
    })

    client.connect(roomName, username.trim())
  }, [username, ttsEnabled, ttsRate])

  // Disconnect
  const leaveRoom = useCallback(() => {
    window.speechSynthesis.cancel()
    clientRef.current?.disconnect()
    clientRef.current = null
    setConnected(false)
    setView(VIEW.LOBBY)
    setQuestionWords([])
    setChatMessages([])
    setPlayers([])
    setCurrentQuestion(null)
    setRoomState(null)
  }, [])

  // Buzz
  const handleBuzz = useCallback(() => {
    if (!canBuzz) return
    clientRef.current?.buzz()
  }, [canBuzz])

  // Submit answer from keyboard
  const handleSubmitAnswer = useCallback(() => {
    if (!answer.trim()) return
    speech.stop()
    doSubmitAnswer(answer)
  }, [answer, doSubmitAnswer, speech])

  // Handle typing — disable voice on first keypress
  const handleAnswerKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSubmitAnswer()
      return
    }
    if (!voiceDisabled && speech.listening) {
      speech.stop()
      setVoiceDisabled(true)
    }
  }, [handleSubmitAnswer, voiceDisabled, speech])

  // Send chat
  const handleSendChat = useCallback(() => {
    if (!chatInput.trim()) return
    clientRef.current?.chat(chatInput.trim())
    setChatInput('')
  }, [chatInput])

  // Request next question
  const handleNext = useCallback(() => {
    clientRef.current?.next()
  }, [])

  // Keyboard: space to buzz
  useEffect(() => {
    const handler = (e) => {
      if (view !== VIEW.ROOM) return
      // Don't capture if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.code === 'Space' && canBuzz) {
        e.preventDefault()
        handleBuzz()
      } else if (e.code === 'KeyN' && !buzzedPlayer) {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, canBuzz, handleBuzz, buzzedPlayer, handleNext])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
      clientRef.current?.disconnect()
    }
  }, [])

  // ---- RENDER ----

  if (view === VIEW.LOBBY) {
    return (
      <div className="multiplayer-page">
        <h1>Multiplayer</h1>

        {error && <div className="error-msg">{error}</div>}

        <div className="join-section">
          <div className="join-form">
            <input
              type="text"
              className="input"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
            <input
              type="text"
              className="input"
              placeholder="Room name"
              value={joinRoomName}
              onChange={e => setJoinRoomName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && joinRoomName) joinRoom(joinRoomName) }}
            />
            <button
              className="btn primary"
              onClick={() => joinRoom(joinRoomName)}
              disabled={!joinRoomName.trim()}
            >
              Join / Create Room
            </button>
          </div>
        </div>

        <div className="rooms-section">
          <div className="rooms-header">
            <h2>Public Rooms</h2>
            <button className="btn" onClick={fetchRooms} disabled={roomsLoading}>
              {roomsLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {rooms.length === 0 && !roomsLoading && (
            <p className="no-rooms">No public rooms available. Create one above!</p>
          )}

          <div className="room-list">
            {rooms.map((room, i) => (
              <div key={i} className="room-card" onClick={() => {
                setJoinRoomName(room.name || room.roomName || '')
                joinRoom(room.name || room.roomName || '')
              }}>
                <div className="room-name">{room.name || room.roomName}</div>
                <div className="room-info">
                  <span>{room.playerCount ?? room.players?.length ?? '?'} players</span>
                  {room.setName && <span>{room.setName}</span>}
                  {room.mode && <span>{room.mode}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ROOM VIEW
  return (
    <div className="multiplayer-page room-view">
      <div className="room-header">
        <h2>{clientRef.current?.roomName}</h2>
        <div className="room-controls">
          <label className="tts-toggle">
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={e => setTtsEnabled(e.target.checked)}
            />
            TTS
          </label>
          <label className="tts-speed">
            Speed: {ttsRate.toFixed(1)}x
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={ttsRate}
              onChange={e => setTtsRate(parseFloat(e.target.value))}
            />
          </label>
          <button className="btn" onClick={leaveRoom}>Leave</button>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="room-layout">
        {/* Main game area */}
        <div className="game-area">
          {/* Question display */}
          <div className="mp-question-area">
            {questionType && (
              <div className="mp-question-type">
                {questionType === 'tossup' ? 'Tossup' : 'Bonus'}
              </div>
            )}

            {questionType === 'bonus' && bonusLeadin && (
              <div className="mp-leadin">{bonusLeadin}</div>
            )}

            <div className="mp-question-text">
              {questionWords.map((word, i) => (
                <span key={i} className="word">{word} </span>
              ))}
              {questionWords.length > 0 && canBuzz && <span className="cursor-blink">|</span>}
            </div>
          </div>

          {/* Answer result */}
          {answerResult && answerResult.directive && (
            <div className={`mp-answer-result ${answerResult.directive === 'accept' ? 'correct' : 'incorrect'}`}>
              <strong>{answerResult.username}:</strong> {answerResult.givenAnswer}
              {' — '}
              {answerResult.directive === 'accept' ? 'Correct!' : 'Incorrect'}
              {answerResult.revealedAnswer && (
                <div><strong>Answer:</strong> <span dangerouslySetInnerHTML={{ __html: answerResult.revealedAnswer }} /></div>
              )}
            </div>
          )}

          {/* Buzzed player indicator */}
          {buzzedPlayer && (
            <div className="mp-buzzed">
              {buzzedPlayer.username} buzzed in!
            </div>
          )}

          {/* Controls */}
          <div className="mp-controls">
            {canBuzz && !buzzedPlayer && (
              <button className="btn buzz" onClick={handleBuzz}>Buzz! (Space)</button>
            )}

            {buzzedPlayer && buzzedPlayer.userId === clientRef.current?.userId && (
              <div className="answer-area">
                <div className="answer-input-wrapper">
                  <input
                    ref={answerInputRef}
                    type="text"
                    className={`answer-input ${speech.listening ? 'listening' : ''}`}
                    placeholder={speech.listening ? 'Listening... (or start typing)' : 'Type your answer...'}
                    value={answer}
                    onChange={e => {
                      setAnswer(e.target.value)
                      clientRef.current?.giveAnswerLiveUpdate(e.target.value)
                    }}
                    onKeyDown={handleAnswerKeyDown}
                  />
                  {speech.supported && (
                    <span className={`mic-status ${speech.listening ? 'active' : ''}`}>
                      {speech.listening ? '🎤' : ''}
                    </span>
                  )}
                </div>
                <button className="btn primary" onClick={handleSubmitAnswer}>Submit</button>
              </div>
            )}

            <button className="btn" onClick={handleNext}>Next (N)</button>
          </div>
        </div>

        {/* Sidebar: Players + Chat */}
        <div className="sidebar">
          {/* Players */}
          <div className="players-panel">
            <h3>Players ({players.length})</h3>
            <div className="player-list">
              {players
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map((p, i) => (
                  <div key={p.odId || i} className={`player-row ${p.odId === clientRef.current?.userId ? 'self' : ''}`}>
                    <span className="player-name">{p.odUsername || p.username || 'Unknown'}</span>
                    <span className="player-score">{p.score || 0}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Chat */}
          <div className="chat-panel">
            <h3>Chat</h3>
            <div className="chat-messages">
              {chatMessages.slice(-50).map((msg, i) => (
                <div key={i} className={`chat-msg ${msg.system ? 'system' : ''}`}>
                  {msg.system
                    ? <em>{msg.text}</em>
                    : <><strong>{msg.username}:</strong> {msg.text}</>
                  }
                </div>
              ))}
            </div>
            <div className="chat-input-area">
              <input
                ref={chatInputRef}
                type="text"
                className="input"
                placeholder="Chat..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendChat() }}
              />
              <button className="btn" onClick={handleSendChat}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
