import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for text-to-speech using the Web Speech API.
 * Speaks in sentence-sized chunks for natural flow. Words within each
 * chunk are revealed when that chunk starts speaking (via onstart),
 * which fires reliably on all platforms including Android.
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

  // Split words into sentence/clause chunks at punctuation boundaries.
  // Returns array of { text, startIndex, endIndex } objects.
  const buildChunks = useCallback((words) => {
    const chunks = []
    let chunkStart = 0

    for (let i = 0; i < words.length; i++) {
      // Split at sentence/clause-ending punctuation
      if (/[.?!;,:]$/.test(words[i]) || i === words.length - 1) {
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

  // Speak text in sentence-sized chunks. Each chunk's onstart reveals
  // all its words at once. Pauses between sentences are natural.
  // onboundary provides finer word-level tracking when available (desktop).
  const speakChunks = useCallback((words) => {
    if (cancelledRef.current) return
    if (words.length === 0) {
      setSpeaking(false)
      setDone(true)
      return
    }

    const chunks = buildChunks(words)
    const voice = getVoice()

    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c]
      const utt = new SpeechSynthesisUtterance(chunk.text)
      utt.rate = rateRef.current
      if (voice) utt.voice = voice

      // When this chunk starts, reveal the first word. onboundary will
      // advance word-by-word on desktop. On Android (no onboundary),
      // onend will reveal the rest before the next chunk starts.
      const chunkWords = words.slice(chunk.startIndex, chunk.endIndex + 1)
      const charToWord = []
      let charPos = 0
      for (let i = 0; i < chunkWords.length; i++) {
        charToWord.push({ start: charPos, wordIndex: chunk.startIndex + i })
        charPos += chunkWords[i].length + 1
      }

      let boundaryFired = false
      let fallbackTimer = null

      utt.onstart = () => {
        if (cancelledRef.current) return
        setWordIndex(chunk.startIndex)
        currentIndexRef.current = chunk.startIndex
        // Fallback for Android: if onboundary doesn't fire within 100ms,
        // reveal all words in this chunk immediately
        fallbackTimer = setTimeout(() => {
          if (!boundaryFired && !cancelledRef.current) {
            setWordIndex(chunk.endIndex)
            currentIndexRef.current = chunk.endIndex
          }
        }, 100)
      }

      utt.onboundary = (event) => {
        if (event.name === 'word') {
          if (!boundaryFired) {
            boundaryFired = true
            clearTimeout(fallbackTimer)
          }
          let wi = chunk.startIndex
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

      // onend: ensure all words in chunk are revealed, then handle done
      if (c === chunks.length - 1) {
        utt.onend = () => {
          clearTimeout(fallbackTimer)
          if (cancelledRef.current) return
          setWordIndex(words.length - 1)
          currentIndexRef.current = words.length
          setSpeaking(false)
          setPaused(false)
          setDone(true)
        }
      } else {
        utt.onend = () => {
          clearTimeout(fallbackTimer)
          if (cancelledRef.current) return
          // Always ensure all chunk words are revealed before next chunk
          setWordIndex(chunk.endIndex)
          currentIndexRef.current = chunk.endIndex
        }
      }

      utt.onerror = (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') return
        console.error('TTS error:', event.error)
        setSpeaking(false)
      }

      window.speechSynthesis.speak(utt)
    }
  }, [getVoice, buildChunks])

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
    speakChunks(words)
  }, [speakChunks])

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
