# QuizBowl TTS App

## Project Overview
A quiz bowl practice app with text-to-speech, single-player modes, and multiplayer via the qbreader.org API and WebSocket protocol.

## Tech Stack
- React 19 + Vite 7, React Router DOM 7
- REST API: qbreader.org (`/api/*`)
- WebSocket: `wss://www.qbreader.org` (raw WebSocket, NOT Socket.IO)
- TTS: Web Speech Synthesis API via custom `useTTS` hook
- Voice input: Web Speech Recognition API via custom `useSpeechRecognition` hook
- Styling: Plain CSS (dark/light theme via `prefers-color-scheme`)
- Dev server: Vite with `@vitejs/plugin-basic-ssl` for HTTPS (required for Android speech APIs)

## File Structure
```
src/
  main.jsx              — React root
  App.jsx               — BrowserRouter + routes
  App.css               — Layout, nav cards
  index.css             — Global reset/theme
  api/
    qbreader.js         — REST API wrapper (throttled 20 req/sec)
    multiplayer.js      — WebSocket client class for multiplayer rooms
  hooks/
    useTTS.js           — Word-by-word TTS (two strategies: desktop vs Android)
    useSpeechRecognition.js — Speech-to-text for voice answer input
  components/
    Settings.jsx/.css   — Collapsible settings panel
  pages/
    Home.jsx            — Landing page with nav cards
    TossupPractice.jsx  — Single-player tossup practice
    BonusPractice.jsx   — Single-player bonus practice
    Practice.css        — Shared CSS for both practice pages
    Multiplayer.jsx     — Multiplayer lobby + in-room gameplay
    Multiplayer.css     — Multiplayer-specific styles
```

## Implementation Status
- **Step 1** (Vite + React infra): COMPLETE
- **Step 2** (QBReader API integration): COMPLETE
- **Step 3** (Single-player tossup + bonus): COMPLETE
- **Step 3b** (Voice answer input): COMPLETE
- **Step 4** (Multiplayer): COMPLETE
- **Step 5** (Private rooms): NOT STARTED — user said "DON'T start on Step 5"

See `implementation_plan.md` for full details on each step.

## Critical Platform Constraints

### TTS (useTTS.js)
- `onboundary` does NOT fire on Android Chrome — fundamental limitation
- Two-strategy approach: desktop uses single utterance + `onboundary` for word-by-word display; Android uses punctuation-based chunks chained sequentially via `onend`
- All `setWordIndex` calls use `Math.max(prev, newIndex)` to prevent backward jumps (flashing)
- Android chunks are chained with 150ms gaps (not pre-queued) for natural pacing
- Platform detection: `const IS_ANDROID = /android/i.test(navigator.userAgent)`

### Speech Recognition (useSpeechRecognition.js)
- Requires HTTPS — desktop Chrome exempts localhost, Android does NOT
- Vite dev server configured with `@vitejs/plugin-basic-ssl` + `host: true` for Android testing
- Android requires `SpeechRecognition.start()` in a user gesture context (tap/click)
- Pages have a tappable mic button (`<button class="mic-btn">`) as reliable fallback
- Voice is auto-attempted in buzz handlers; mic button covers cases where auto-start fails

### Power Scoring (TossupPractice)
- `question_sanitized` from API strips `(*)` marker — must use raw `question` for power detection
- `powerIndex` computed from raw question; compared against `buzzIndex` from sanitized text
- Display words keep `(*)`; TTS words have it stripped

## Testing
- After modifying any source file in `src/`, run `npm test` before reporting the change as complete
- If tests fail, fix the issue before moving on
- When modifying scoring/TTS/answer logic, update corresponding tests in `src/utils/__tests__/`
- `npm test` — run all tests once
- `npm run test:watch` — run tests in watch mode during development

## Dev Commands
- `npm run dev` — starts HTTPS dev server (accessible on local network for Android testing)
- `npm run build` — production build
- `npm test` — run test suite (Vitest)
- Access from Android: `https://<local-ip>:5173/` (accept self-signed cert warning)

## Recent Changes (all committed)
- Fixed Android TTS speed (chained chunks instead of pre-queued)
- Added user's spoken answer display in tossup results
- Mic button for reliable voice activation on Android
- HTTPS dev server for Android speech API support
