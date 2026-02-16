import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for word-by-word text-to-speech using the Web Speech API.
 *
 * @param {Object} opts
 * @param {number} [opts.rate=1] - Speech rate (0.5 - 2)
 * @param {string} [opts.voiceURI] - Preferred voice URI
 * @returns {Object} TTS controls and state
 */
export default function useTTS({ rate = 1, voiceURI } = {}) {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [wordIndex, setWordIndex] = useState(-1)
  const [done, setDone] = useState(false)
  const [voices, setVoices] = useState([])

  const wordsRef = useRef([])
  const utteranceRef = useRef(null)
  const currentIndexRef = useRef(0)
  const cancelledRef = useRef(false)
  const rateRef = useRef(rate)
  const voiceURIRef = useRef(voiceURI)

  rateRef.current = rate
  voiceURIRef.current = voiceURI

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
    // Default to first English voice
    return v.find(voice => voice.lang.startsWith('en')) || v[0] || null
  }, [])

  // Speak all words as a single utterance, using onboundary to track word position.
  const speakAll = useCallback((words) => {
    if (cancelledRef.current) return
    if (words.length === 0) {
      setSpeaking(false)
      setDone(true)
      return
    }

    const text = words.join(' ')
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = rateRef.current
    const voice = getVoice()
    if (voice) utt.voice = voice

    utteranceRef.current = utt
    currentIndexRef.current = 0

    // Map character offsets to word indices for boundary tracking
    const charToWord = []
    let charPos = 0
    for (let i = 0; i < words.length; i++) {
      charToWord.push({ start: charPos, wordIndex: i })
      charPos += words[i].length + 1 // +1 for the space
    }

    utt.onboundary = (event) => {
      if (event.name === 'word') {
        // Find which word this character offset corresponds to
        let wi = 0
        for (let i = charToWord.length - 1; i >= 0; i--) {
          if (event.charIndex >= charToWord[i].start) {
            wi = charToWord[i].wordIndex
            break
          }
        }
        setWordIndex(wi)
        currentIndexRef.current = wi
      }
    }

    utt.onend = () => {
      if (cancelledRef.current) return
      setWordIndex(words.length - 1)
      currentIndexRef.current = words.length
      setSpeaking(false)
      setPaused(false)
      setDone(true)
    }

    utt.onerror = (event) => {
      if (event.error === 'canceled' || event.error === 'interrupted') return
      console.error('TTS error:', event.error)
      setSpeaking(false)
    }

    setWordIndex(0)
    window.speechSynthesis.speak(utt)
  }, [getVoice])

  /**
   * Start speaking an array of words from the beginning.
   * @param {string[]} words
   */
  const speak = useCallback((words) => {
    window.speechSynthesis.cancel()
    cancelledRef.current = false
    wordsRef.current = words
    currentIndexRef.current = 0
    setWordIndex(-1)
    setDone(false)
    setSpeaking(true)
    setPaused(false)
    speakAll(words)
  }, [speakAll])

  /**
   * Pause speech.
   */
  const pause = useCallback(() => {
    window.speechSynthesis.pause()
    setPaused(true)
  }, [])

  /**
   * Resume speech.
   */
  const resume = useCallback(() => {
    window.speechSynthesis.resume()
    setPaused(false)
  }, [])

  /**
   * Stop speech entirely. Returns the word index where we stopped.
   * @returns {number} The word index at time of stopping
   */
  const stop = useCallback(() => {
    cancelledRef.current = true
    window.speechSynthesis.cancel()
    const stoppedAt = currentIndexRef.current
    setSpeaking(false)
    setPaused(false)
    return stoppedAt
  }, [])

  /**
   * Reset all TTS state.
   */
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

  // Cleanup on unmount
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
