import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Custom hook for speech-to-text using the Web Speech Recognition API.
 *
 * Voice input is the default answer method. It starts automatically when
 * activated, shows interim results as the user speaks, and calls
 * onFinalResult when the user pauses (browser delivers a final transcript).
 *
 * If the user starts typing, the caller should call stop() to disable voice.
 *
 * @param {Object} opts
 * @param {Function} [opts.onFinalResult] - Called with the final transcript string
 *   when the user pauses speaking. The caller should use this to auto-submit.
 * @param {Function} [opts.onInterimResult] - Called with interim transcript as
 *   the user speaks. Useful for live preview / multiplayer live updates.
 */

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

export default function useSpeechRecognition({ onFinalResult, onInterimResult } = {}) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [supported] = useState(() => !!SpeechRecognition)

  const recognitionRef = useRef(null)
  const onFinalResultRef = useRef(onFinalResult)
  const onInterimResultRef = useRef(onInterimResult)
  const stoppedManuallyRef = useRef(false)

  // Keep callback refs current
  onFinalResultRef.current = onFinalResult
  onInterimResultRef.current = onInterimResult

  const stop = useCallback(() => {
    stoppedManuallyRef.current = true
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
    setListening(false)
  }, [])

  const start = useCallback(() => {
    if (!SpeechRecognition) return
    // Clean up any existing instance
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }

    stoppedManuallyRef.current = false
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListening(true)
    }

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (final) {
        setTranscript(final)
        onInterimResultRef.current?.(final)
        // Auto-submit: user paused speaking, browser delivered final result
        onFinalResultRef.current?.(final.trim())
      } else if (interim) {
        setTranscript(interim)
        onInterimResultRef.current?.(interim)
      }
    }

    recognition.onerror = (event) => {
      // 'no-speech' and 'aborted' are expected — user didn't speak or we stopped
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setListening(false)
        return
      }
      // 'not-allowed' means mic permission denied
      if (event.error === 'not-allowed') {
        console.warn('Microphone permission denied')
        setListening(false)
        return
      }
      console.error('Speech recognition error:', event.error)
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
      // If recognition ended naturally (not manually stopped) and no final
      // result was delivered, don't restart — the user may want to type instead.
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (err) {
      // Can throw if called too rapidly or if already started
      console.error('Failed to start speech recognition:', err)
      setListening(false)
    }
  }, [])

  const reset = useCallback(() => {
    stop()
    setTranscript('')
  }, [stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  return {
    start,
    stop,
    reset,
    listening,
    transcript,
    supported,
  }
}
