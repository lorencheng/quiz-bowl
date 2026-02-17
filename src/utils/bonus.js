/**
 * Calculate total bonus points from part results.
 * @param {{points: number}[]} partResults
 * @returns {number}
 */
export function calcBonusTotal(partResults) {
  return partResults.reduce((sum, r) => sum + r.points, 0)
}

/**
 * Pure score reducer for bonus scoring.
 * @param {{total: number, bonuses: number, thirties: number}} prev
 * @param {number} bonusTotal - Total points for this bonus (0-30)
 * @returns {{total: number, bonuses: number, thirties: number}}
 */
export function updateBonusScore(prev, bonusTotal) {
  return {
    total: prev.total + bonusTotal,
    bonuses: prev.bonuses + 1,
    thirties: prev.thirties + (bonusTotal === 30 ? 1 : 0),
  }
}
