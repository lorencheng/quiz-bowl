# QuizBowl TTS — Implementation Plan

> A quiz bowl practice app with text-to-speech, single-player modes, and multiplayer
> via the qbreader.org API and WebSocket protocol.

---

## Overall Architecture

- **Framework**: React 19 + Vite 7, React Router DOM 7
- **API**: qbreader.org REST API (`/api/*`) + WebSocket (`wss://www.qbreader.org`)
- **TTS**: Web Speech API via custom `useTTS` hook (word-by-word with highlighting)
- **Multiplayer**: Raw WebSocket (NOT Socket.IO) — `MultiplayerClient` class
- **Styling**: Plain CSS (dark/light theme via `prefers-color-scheme`)

### File Structure
```
src/
  main.jsx              — React root
  App.jsx               — BrowserRouter + routes
  App.css               — Layout, nav cards
  index.css             — Global reset/theme
  api/
    qbreader.js         — REST API wrapper (throttled, all endpoints)
    multiplayer.js      — WebSocket client class for multiplayer rooms
  hooks/
    useTTS.js           — Word-by-word TTS hook (speak, pause, stop, highlight)
  components/
    Settings.jsx/.css   — Collapsible settings panel (voice, speed, categories, difficulty)
  pages/
    Home.jsx            — Landing page with nav cards
    TossupPractice.jsx  — Single-player tossup practice
    BonusPractice.jsx   — Single-player bonus practice
    Practice.css        — Shared CSS for both practice pages
    Multiplayer.jsx     — Multiplayer lobby + in-room gameplay
    Multiplayer.css     — Multiplayer-specific styles
```

---

## Step 1: Vite + React Infrastructure ✅ COMPLETE

**What was done:**
- Scaffolded Vite + React project
- Installed dependencies: react, react-dom, react-router-dom, axios, socket.io-client
- Set up ESLint config
- Created basic routing in `App.jsx` (Home, TossupPractice, BonusPractice, Multiplayer)
- Created `index.css` with dark/light theme support
- Created `App.css` with layout and nav card styles

---

## Step 2: QBReader API Integration ✅ COMPLETE

**What was done:**

### REST API (`src/api/qbreader.js`)
- Rate-limited HTTP client (50ms between requests = 20 req/sec)
- Endpoints implemented:
  - `getRandomTossup(opts)` — fetch random tossups with category/difficulty/year filters
  - `getRandomBonus(opts)` — fetch random bonuses with same filters
  - `checkAnswer(givenAnswer, expectedAnswer)` — returns `{directive, directedPrompt}`
    - directive: `"accept"`, `"reject"`, or `"prompt"`
  - `getSetList()` — list all available question sets
  - `getNumPackets(setName)` — packet count for a set
  - `getPacket(setName, packetNumber)` — full packet (tossups + bonuses)
  - `queryQuestions(opts)` — text search across questions
- Exported constants: `CATEGORIES` (12 categories), `DIFFICULTIES` (0-10 scale)

### WebSocket Client (`src/api/multiplayer.js`)
- `MultiplayerClient` class with raw WebSocket (NOT socket.io)
- Connects to `wss://www.qbreader.org/play/mp/room/{roomName}`
- Ping keepalive every 30s
- Event-based listener system with wildcard support
- Convenience methods: `buzz()`, `next()`, `pause()`, `chat()`, `giveAnswer()`, `giveAnswerLiveUpdate()`, `startBonusAnswer()`

### TTS Hook (`src/hooks/useTTS.js`)
- Word-by-word speech with highlighting via `onboundary` events
- Chunked speaking (sentence boundaries or 15-word groups) for natural flow
- Controls: `speak(words)`, `pause()`, `resume()`, `stop()`, `reset()`
- State: `speaking`, `paused`, `wordIndex`, `done`, `voices`
- Voice selection (prefers English, supports user-selected voice URI)

### Settings Component (`src/components/Settings.jsx`)
- Collapsible `<details>` panel
- Voice picker (English voices only)
- Speed slider (0.5x – 2x)
- Category chips (toggle selection)
- Difficulty chips (toggle selection)

---

## Step 3: Single-Player Mode ✅ COMPLETE

**What was done:**

### Tossup Practice (`src/pages/TossupPractice.jsx`)
- **Phase state machine**: IDLE → READING → BUZZING → RESULT
- **Flow**:
  1. Click "Start" → fetches random tossup via API → TTS reads question word-by-word
  2. Words appear on screen as TTS reads them (highlight on current word)
  3. Press Space or click "Buzz!" → TTS stops, answer input appears
  4. Type answer + Enter → calls `checkAnswer` API
  5. Scoring: 15pts (power — buzzed before `(*)` mark), 10pts (correct), -5pts (neg)
  6. Shows result banner + correct answer, press N for next question
- **Keyboard shortcuts**: Space=buzz, Enter=submit, N=next
- **Scoreboard**: running total, correct count, neg count, questions played
- **Settings integration**: category/difficulty filters, voice, speed

### Bonus Practice (`src/pages/BonusPractice.jsx`)
- **Phase state machine**: IDLE → READING_LEADIN → READING_PART → ANSWERING → PART_RESULT → DONE
- **Flow**:
  1. Click "Start" → fetches random bonus → TTS reads leadin
  2. After leadin finishes → TTS reads part 1
  3. After part finishes → answer input appears
  4. Submit answer → shows result → auto-advances to next part after 1.5s delay
  5. After all 3 parts → shows bonus score (X/30)
- **Keyboard shortcuts**: Space=skip TTS, N=next bonus
- **Scoreboard**: total points, bonuses played, 30-count, PPB (points per bonus)
- **Settings integration**: same as tossup

---

## Step 4: Multiplayer Mode ✅ COMPLETE

**What was done:**

### Multiplayer Page (`src/pages/Multiplayer.jsx`)
- **Two views**: LOBBY and ROOM

#### Lobby View
- Username input (persisted in localStorage as `qb_username`)
- Room name input + "Join / Create Room" button
- Public rooms list fetched from `GET /api/multiplayer/room-list`
- Click a room card to join it

#### Room View
- **Game area**: Shows question type (tossup/bonus), question text (word-by-word from server), buzz button, answer input
- **TTS integration**: Each word from `update-question` events is spoken via SpeechSynthesisUtterance (toggle on/off, speed control)
- **Buzz flow**: Space to buzz → answer input appears → type + Enter → server validates
- **Bonus flow**: Leadin revealed → parts revealed one by one → team answers
- **Sidebar**:
  - Players panel (sorted by score, highlights self)
  - Chat panel (system messages for join/leave, user chat messages)
- **Server events handled**:
  - `connection-acknowledged`, `connection-acknowledged-question`
  - `join`, `leave`
  - `start-next-tossup`, `update-question`, `buzz`, `give-tossup-answer`, `reveal-tossup-answer`, `end-current-tossup`
  - `start-next-bonus`, `reveal-leadin`, `reveal-next-part`, `give-bonus-answer`, `end-current-bonus`
  - `chat`, `pause`, `error`, `enforcing-removal`
- **Keyboard shortcuts**: Space=buzz (when not in input), N=next (when not in input)
- **Cleanup**: Disconnects WebSocket + cancels TTS on unmount

---

## Step 5: Private Rooms — NOT YET IMPLEMENTED

### Goal
Allow users to create and manage private multiplayer rooms with password protection and host controls.

### Planned Features

#### 5a. Room Creation Form
- Add a "Create Room" section to the lobby (separate from "Join Room")
- Fields:
  - Room name (required)
  - Password (optional — if set, room is private)
  - Question set selector (dropdown from `getSetList()` API)
  - Packet number selector (populated via `getNumPackets()` after set is chosen)
  - Category filters
  - Difficulty filters
  - Reading speed setting
- On create, connect to the room with the configured settings
- **Note**: Need to investigate qbreader WebSocket protocol for room creation/settings messages. The current `MultiplayerClient.connect()` joins an existing room or creates one by name — need to verify if settings are sent during connection or via subsequent messages.

#### 5b. Password-Protected Rooms
- When joining a room that requires a password, show a password prompt
- Send password as part of the WebSocket connection params
- Handle `password-required` and `password-incorrect` error events from server
- **Needs investigation**: Check qbreader protocol for how password auth works in WebSocket handshake

#### 5c. Host Controls (In-Room)
- If the user is the host (first player / room creator), show additional controls:
  - Start/stop reading
  - Skip question
  - Kick/ban players
  - Change room settings (categories, difficulty, set, etc.)
  - Toggle public/private visibility
- Send appropriate WebSocket messages for each action
- **Needs investigation**: Determine the full set of host-only WebSocket message types

#### 5d. Room Settings Panel
- In-room settings panel (accessible to host only)
- Change question source (random vs. specific set/packet)
- Adjust reading speed on the fly
- Toggle bonus/tossup only modes

### Technical Notes
- The qbreader multiplayer protocol is not fully documented publicly
- Will need to reverse-engineer or test against the live server to discover:
  - Room creation parameters (password, settings, visibility)
  - Host privilege messages (kick, ban, settings changes)
  - Password authentication flow
- The existing `MultiplayerClient` class may need new convenience methods for host actions
- Consider adding a `useMultiplayer` hook to encapsulate the client + React state management (the current `Multiplayer.jsx` is 520 lines and could benefit from extraction)

---

## Step 3b: Voice Answer Input ✅ COMPLETE

**What was done:**

### Speech Recognition Hook (`src/hooks/useSpeechRecognition.js`) — NEW
- Wraps `SpeechRecognition` / `webkitSpeechRecognition` Web API
- `start()`, `stop()`, `reset()`, `listening`, `transcript`, `supported`
- Callbacks: `onFinalResult(transcript)` fires when user pauses speaking (auto-submit), `onInterimResult(transcript)` fires with interim text (live preview)
- `continuous: false`, `interimResults: true`, `lang: 'en-US'`
- Graceful error handling: `no-speech`, `aborted`, `not-allowed` (mic denied)
- Returns `supported: false` if browser lacks the API (Firefox, older browsers)

### Integration Pattern (all three modes)
- **Voice is default**: recognition starts automatically when answer phase begins
- **Auto-submit on pause**: `onFinalResult` callback submits the answer
- **Typing fallback**: any non-Enter keypress in the input calls `stop()` and sets `voiceDisabled = true`
- **Reset per question**: on phase change, voice resets and `voiceDisabled` clears
- **Visual feedback**: `.answer-input.listening` pulsing border, mic icon indicator

### TossupPractice.jsx
- Voice starts on BUZZING phase
- `doSubmit(answerText)` extracted for shared voice/keyboard use
- `submittingRef` prevents double-submit

### BonusPractice.jsx
- Voice starts on ANSWERING phase (after TTS finishes reading part)
- Same pattern as tossup

### Multiplayer.jsx
- Voice starts when `buzzedPlayer.userId === clientRef.current.userId`
- Interim results send `giveAnswerLiveUpdate()` so other players see answer forming
- Final result calls `giveAnswer()` via `doSubmitAnswer()`

### CSS
- `Practice.css` + `Multiplayer.css`: `.answer-input-wrapper`, `.answer-input.listening` (pulsing border animation), `.mic-status` (positioned absolute, pulsing opacity)

---

## Known Issues / Tech Debt

1. **socket.io-client is installed but unused** — The multiplayer client uses raw WebSocket. Consider removing the socket.io-client dependency.
2. **Dark mode CSS incomplete** — The `Practice.css` uses hardcoded light-mode colors (e.g., `background: #f5f5f5`, `color: #555`). The `index.css` has a `prefers-color-scheme` media query but component styles don't adapt.
3. **No error recovery in multiplayer** — If the WebSocket disconnects unexpectedly, there's no auto-reconnect logic.
4. **TTS in multiplayer is per-word utterance** — Each word from `update-question` creates a new `SpeechSynthesisUtterance`, which can sound choppy. The single-player modes use the smarter chunked `useTTS` hook instead.
5. ~~**No git commits yet** — All files are untracked. Should make an initial commit.~~ ✅ Fixed — initial commit made.
6. **`index.html` title** says "quizbowl-temp" — should be updated.

---

## Session Log

- **Session 1** (pre-crash): Steps 1–4 implemented. All files written but no git commits made.
- **Session 2** (2026-02-15): Laptop crashed. Reviewed all existing code. Created this implementation plan. Steps 1–4 confirmed complete. Step 5 not yet started. Initial git commit made. TTS bugs fixed (power scoring, Android word display). Complete TTS redesign: two-strategy approach (desktop single utterance + onboundary, Android punctuation-based chunks). Voice answer input implemented across all three modes (Step 3b).
- **Session 3** (2026-02-16): Continued voice input implementation. Completed Multiplayer.jsx integration and CSS styles.
