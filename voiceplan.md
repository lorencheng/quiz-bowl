&nbsp;Plan: Voice Answer Input (Default, Auto-Submit on Silence)



&nbsp;Context



&nbsp;Users currently type answers after buzzing. We want voice input as the default answer method across all three modes

&nbsp;(tossup practice, bonus practice, multiplayer). Recognition starts automatically when the answer phase begins. The

&nbsp;answer auto-submits when the user pauses speaking. Typing is still available as a fallback — any keypress in the input

&nbsp; disables voice recognition for that answer.



&nbsp;Approach: Web Speech Recognition API + useSpeechRecognition Hook



&nbsp;1. Create src/hooks/useSpeechRecognition.js (NEW)



&nbsp;- Wraps webkitSpeechRecognition / SpeechRecognition API

&nbsp;- Exposes: { start(), stop(), transcript, listening, supported, reset() }

&nbsp;- Config: continuous: false, interimResults: true, lang: 'en-US'

&nbsp;- onresult updates transcript with best result (interim → final)

&nbsp;- Auto-submits: when a final result is received (browser fires this after a natural pause in speech), call an

&nbsp;onFinalResult(transcript) callback passed to the hook

&nbsp;- reset() clears transcript and stops listening

&nbsp;- Returns supported: false if browser lacks the API (Firefox, older browsers)



&nbsp;2. Integrate into all three pages



&nbsp;Common pattern for TossupPractice.jsx, BonusPractice.jsx, Multiplayer.jsx:

&nbsp;- Import useSpeechRecognition hook

&nbsp;- When answer phase begins (BUZZING / ANSWERING / buzzed player):

&nbsp;  - Automatically call start() if supported

&nbsp;  - Show interim transcript in the answer input as it updates

&nbsp;  - Show a listening indicator (mic icon / pulsing border)

&nbsp;- Auto-submit on pause: when onFinalResult fires, submit the answer (call handleSubmit / handleSubmitAnswer)

&nbsp;- Typing fallback: on any onKeyDown in the answer input, call stop() to disable voice and let the user type normally.

&nbsp;Do NOT restart voice after this — user has opted into typing for this question.

&nbsp;- On phase change (next question / next part), reset everything so voice is default again



&nbsp;3. Update answer input UI



&nbsp;- Placeholder: "Listening... (or start typing)" when voice is active; "Type your answer..." when voice is

&nbsp;off/unsupported

&nbsp;- Add a small mic status indicator next to the input (listening / off)

&nbsp;- Add .answer-input.listening CSS for visual feedback (pulsing border)



&nbsp;4. CSS changes



&nbsp;- Practice.css: .mic-status indicator styles, .answer-input.listening pulsing border animation

&nbsp;- Multiplayer.css: same styles



&nbsp;5. Multiplayer-specific



&nbsp;- While voice is active and interim results come in, send giveAnswerLiveUpdate(transcript) so other players see the

&nbsp;answer forming

&nbsp;- On final result, call giveAnswer(transcript) as normal



&nbsp;Files to modify



&nbsp;- src/hooks/useSpeechRecognition.js — NEW

&nbsp;- src/pages/TossupPractice.jsx — auto-start voice on buzz, auto-submit on pause, typing fallback

&nbsp;- src/pages/BonusPractice.jsx — auto-start voice on answering phase, same pattern

&nbsp;- src/pages/Multiplayer.jsx — auto-start voice on buzz, live updates from interim results

&nbsp;- src/pages/Practice.css — listening indicator + pulsing border

&nbsp;- src/pages/Multiplayer.css — same styles



&nbsp;Flow summary



&nbsp;Buzz/Answer phase starts

&nbsp;  → Voice recognition starts automatically

&nbsp;  → User speaks → interim transcript shown in input

&nbsp;  → User pauses → final result → auto-submit answer



&nbsp;  OR



&nbsp;  → User presses any key in input → voice stops

&nbsp;  → User types answer → submits with Enter as before



&nbsp;Edge cases



&nbsp;- Browser doesn't support SpeechRecognition → voice features hidden, typing-only (no degradation)

&nbsp;- User doesn't speak and just starts typing → voice stops on first keypress, normal typing flow

&nbsp;- Recognition returns empty/no result → don't auto-submit, let user type

&nbsp;- Microphone permission denied → treat as unsupported, fall back to typing



&nbsp;Verification



&nbsp;1. npm run dev, open in Chrome/Edge

&nbsp;2. Tossup: buzz → verify mic starts automatically → speak answer → pause → answer auto-submits

&nbsp;3. Bonus: after part is read → same flow

&nbsp;4. Multiplayer: buzz → same flow, verify live updates sent

&nbsp;5. Test typing fallback: buzz → press a key → verify mic stops, type and Enter works

&nbsp;6. Test Firefox → verify no voice UI, typing works normally

