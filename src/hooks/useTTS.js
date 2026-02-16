import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for text-to-speech using the Web Speech API.
 *
 * Two strategies based on platform:
 * - Desktop/iOS: Single utterance + onboundary for word-by-word display.
 * - Android: Phrase-level chunks (~5 words, breaking at punctuation) queued
 *   upfront. Each chunk's onstart reveals its words. Gaps at phrase boundaries
 *   sound natural.
 *
 * All wordIndex updates use Math.max to guarantee the index only moves forward,
 * preventing any flashing of words.
 */

const IS_ANDROID = /android/i.test(navigator.userAgent)
// Android chunks only break at punctuation — no max word limit,
// so pauses only occur at natural sentence/clause boundaries.

export default function useTTS({ rate = 1, voiceURI } = {}) {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [wordIndex, setWordIndex] = useState(-1)
  const [done, setDone] = useState(false)
  const [voices, setVoices] = useState([])

  const wordsRef = useRef([])
  const currentIndexRef = useRef(0)
  const cancelledRef = useRef(false)
  const rateRef = useRef(rate)
  const voiceURIRef = useRef(voiceURI)

  rateRef.current = rate
  voiceURIRef.current = voiceURI

  // Helper: only advance wordIndex forward, never backward
  const advanceWordIndex = useCallback((newIndex) => {
    setWordIndex(prev => Math.max(prev, newIndex))
    currentIndexRef.current = Math.max(currentIndexRef.current, newIndex)
  }, [])

  // Load available voices
  useEffect(() => {
    function loadVoices() {
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0) setVoices(v)
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
    }
  }, [])

  const getVoice = useCallback(() => {
    const v = window.speechSynthesis.getVoices()
    if (voiceURIRef.current) {
      const match = v.find(voice => voice.voiceURI === voiceURIRef.current)
      if (match) return match
    }
    return v.find(voice => voice.lang.startsWith('en')) || v[0] || null
  }, [])

  // ---------------------------------------------------------------
  // Strategy 1: Desktop/iOS — single utterance + onboundary
  // ---------------------------------------------------------------
  const speakSingleUtterance = useCallback((words) => {
    if (cancelledRef.current) return

    const text = words.join(' ')
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = rateRef.current
    const voice = getVoice()
    if (voice) utt.voice = voice

    // Build character-offset → word-index map for onboundary
    const charToWord = []
    let charPos = 0
    for (let i = 0; i < words.length; i++) {
      charToWord.push({ start: charPos, wordIndex: i })
      charPos += words[i].length + 1
    }

    utt.onstart = () => {
      if (cancelledRef.current) return
      advanceWordIndex(0)
    }

    utt.onboundary = (event) => {
      if (cancelledRef.current) return
      if (event.name === 'word') {
        let wi = 0
        for (let i = charToWord.length - 1; i >= 0; i--) {
          if (event.charIndex >= charToWord[i].start) {
            wi = charToWord[i].wordIndex
            break
          }
        }
        advanceWordIndex(wi)
      }
    }

    utt.onend = () => {
      if (cancelledRef.current) return
      advanceWordIndex(words.length - 1)
      setSpeaking(false)
      setPaused(false)
      setDone(true)
    }

    utt.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') return
      console.error('TTS error:', event.error)
      setSpeaking(false)
    }

    window.speechSynthesis.speak(utt)
  }, [getVoice, advanceWordIndex])

  // ---------------------------------------------------------------
  // Strategy 2: Android — phrase-level chunks chained sequentially
  // Each chunk speaks after the previous finishes, adding natural
  // pauses at sentence/clause boundaries instead of rushing through.
  // ---------------------------------------------------------------

  // Build chunks splitting at punctuation boundaries.
  const buildChunks = useCallback((words) => {
    const chunks = []
    let chunkStart = 0

    for (let i = 0; i < words.length; i++) {
      const atPunctuation = /[.?!;,:]$/.test(words[i])
      const atEnd = i === words.length - 1

      if (atPunctuation || atEnd) {
        chunks.push({
          text: words.slice(chunkStart, i + 1).join(' '),
          startIndex: chunkStart,
          endIndex: i,
        })
        chunkStart = i + 1
      }
    }
    return chunks
  }, [])

  const speakChunked = useCallback((words) => {
    if (cancelledRef.current) return

    const chunks = buildChunks(words)
    const voice = getVoice()

    const speakChunk = (c) => {
      if (cancelledRef.current || c >= chunks.length) return

      const chunk = chunks[c]
      const utt = new SpeechSynthesisUtterance(chunk.text)
      utt.rate = rateRef.current
      if (voice) utt.voice = voice

      utt.onstart = () => {
        if (cancelledRef.current) return
        // Reveal all words in this chunk when it starts speaking
        advanceWordIndex(chunk.endIndex)
      }

      utt.onend = () => {
        if (cancelledRef.current) return
        if (c === chunks.length - 1) {
          // Last chunk finished
          advanceWordIndex(words.length - 1)
          setSpeaking(false)
          setPaused(false)
          setDone(true)
        } else {
          // Chain next chunk after a brief pause for natural pacing
          setTimeout(() => speakChunk(c + 1), 150)
        }
      }

      utt.onerror = (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') return
        console.error('TTS error:', event.error)
        setSpeaking(false)
      }

      window.speechSynthesis.speak(utt)
    }

    speakChunk(0)
  }, [getVoice, buildChunks, advanceWordIndex])

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------

  const speak = useCallback((words) => {
    window.speechSynthesis.cancel()
    cancelledRef.current = false
    wordsRef.current = words
    currentIndexRef.current = 0
    setWordIndex(-1)
    setDone(false)
    setSpeaking(true)
    setPaused(false)

    if (words.length === 0) {
      setSpeaking(false)
      setDone(true)
      return
    }

    if (IS_ANDROID) {
      speakChunked(words)
    } else {
      speakSingleUtterance(words)
    }
  }, [speakSingleUtterance, speakChunked])

  const pause = useCallback(() => {
    window.speechSynthesis.pause()
    setPaused(true)
  }, [])

  const resume = useCallback(() => {
    window.speechSynthesis.resume()
    setPaused(false)
  }, [])

  const stop = useCallback(() => {
    cancelledRef.current = true
    window.speechSynthesis.cancel()
    const stoppedAt = currentIndexRef.current
    setSpeaking(false)
    setPaused(false)
    return stoppedAt
  }, [])

  const reset = useCallback(() => {
    cancelledRef.current = true
    window.speechSynthesis.cancel()
    wordsRef.current = []
    currentIndexRef.current = 0
    setSpeaking(false)
    setPaused(false)
    setWordIndex(-1)
    setDone(false)
  }, [])

  useEffect(() => {
    return () => {
      cancelledRef.current = true
      window.speechSynthesis.cancel()
    }
  }, [])

  return {
    speak,
    pause,
    resume,
    stop,
    reset,
    speaking,
    paused,
    wordIndex,
    done,
    voices,
  }
}
