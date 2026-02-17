/**
 * Find the index of the word containing the (*) power marker.
 * @param {string[]} rawWords - Words from the raw (unsanitized) question
 * @returns {number} Index of the power marker word, or -1 if not found
 */
export function findPowerIndex(rawWords) {
  return rawWords.findIndex(w => w.includes('(*)'))
}

/**
 * Remove the (*) power marker from words, filtering out any that become empty.
 * @param {string[]} rawWords - Words that may contain (*)
 * @returns {string[]} Words with (*) stripped
 */
export function stripPowerMarker(rawWords) {
  return rawWords.map(w => w.replace('(*)', '').trim()).filter(Boolean)
}

/**
 * Calculate tossup points based on answer directive and buzz position.
 * @param {string} directive - "accept", "reject", or "prompt"
 * @param {number} powerIndex - Index of (*) in raw words, or -1
 * @param {number} buzzIndex - Index where the player buzzed
 * @returns {number} 15, 10, -5, or 0
 */
export function calcTossupPoints(directive, powerIndex, buzzIndex) {
  if (directive === 'accept') {
    if (powerIndex >= 0 && buzzIndex < powerIndex) {
      return 15
    }
    return 10
  }
  if (directive === 'reject') {
    return -5
  }
  return 0
}

/**
 * Pure score reducer for tossup scoring.
 * @param {{correct: number, neg: number, total: number, questions: number}} prev
 * @param {number} points
 * @returns {{correct: number, neg: number, total: number, questions: number}}
 */
export function updateTossupScore(prev, points) {
  return {
    correct: prev.correct + (points > 0 ? 1 : 0),
    neg: prev.neg + (points < 0 ? 1 : 0),
    total: prev.total + points,
    questions: prev.questions + 1,
  }
}
