/**
 * Split words into chunks at punctuation boundaries for Android TTS.
 * Each chunk contains the text to speak and the start/end word indices.
 * @param {string[]} words
 * @returns {{text: string, startIndex: number, endIndex: number}[]}
 */
export function buildChunks(words) {
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
}
