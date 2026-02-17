import axios from 'axios'

const BASE_URL = 'https://www.qbreader.org/api'
const RATE_LIMIT_MS = 50 // 20 req/sec = 50ms between requests

let lastRequestTime = 0

async function throttledRequest(config) {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed))
  }
  lastRequestTime = Date.now()
  return axios(config)
}

/**
 * Strip undefined/null/empty-string values from a params object.
 * @param {Object} params
 * @returns {Object}
 */
export function cleanParams(params) {
  const cleaned = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value
    }
  }
  return cleaned
}

/**
 * Normalize an answer string for the QBReader API.
 * Converts leading negative numbers (e.g. "-1") to words ("negative 1").
 * @param {string} answer
 * @returns {string}
 */
export function normalizeAnswer(answer) {
  return answer.replace(/^-(\d)/, 'negative $1')
}

function get(path, params = {}) {
  const cleanedParams = cleanParams(params)
  return throttledRequest({
    method: 'GET',
    url: `${BASE_URL}${path}`,
    params: cleanedParams,
  }).then(res => res.data)
}

// Categories available in qbreader
export const CATEGORIES = [
  'Literature', 'History', 'Science', 'Fine Arts',
  'Religion', 'Mythology', 'Philosophy', 'Social Science',
  'Current Events', 'Geography', 'Other Academic', 'Trash',
]

// Difficulty levels (0-10)
export const DIFFICULTIES = [
  { value: 0, label: 'Unrated' },
  { value: 1, label: '1 - Middle School' },
  { value: 2, label: '2 - Easy High School' },
  { value: 3, label: '3 - Regular High School' },
  { value: 4, label: '4 - Hard High School' },
  { value: 5, label: '5 - Easy College' },
  { value: 6, label: '6 - Regular College' },
  { value: 7, label: '7 - Hard College' },
  { value: 8, label: '8 - Easy Open' },
  { value: 9, label: '9 - Regular Open' },
  { value: 10, label: '10 - National' },
]

/**
 * Fetch random tossup(s).
 * @param {Object} opts
 * @param {number} [opts.number=1] - Number of tossups to return
 * @param {string[]} [opts.categories] - Filter by categories
 * @param {string[]} [opts.subcategories] - Filter by subcategories
 * @param {number[]} [opts.difficulties] - Filter by difficulties
 * @param {number} [opts.minYear] - Minimum year
 * @param {number} [opts.maxYear] - Maximum year
 */
export async function getRandomTossup(opts = {}) {
  const data = await get('/random-tossup', {
    number: opts.number || 1,
    categories: opts.categories?.join(','),
    subcategories: opts.subcategories?.join(','),
    difficulties: opts.difficulties?.join(','),
    minYear: opts.minYear,
    maxYear: opts.maxYear,
  })
  return data.tossups
}

/**
 * Fetch random bonus(es).
 * @param {Object} opts - Same filters as getRandomTossup
 */
export async function getRandomBonus(opts = {}) {
  const data = await get('/random-bonus', {
    number: opts.number || 1,
    categories: opts.categories?.join(','),
    subcategories: opts.subcategories?.join(','),
    difficulties: opts.difficulties?.join(','),
    minYear: opts.minYear,
    maxYear: opts.maxYear,
  })
  return data.bonuses
}

/**
 * Check if an answer is correct.
 * @param {string} givenAnswer - The user's answer
 * @param {string} expectedAnswer - The correct answer string
 * @returns {Promise<{directive: string, directedPrompt: string|null}>}
 *   directive: "accept", "reject", or "prompt"
 */
export async function checkAnswer(givenAnswer, expectedAnswer) {
  const normalized = normalizeAnswer(givenAnswer)
  return get('/check-answer', {
    answerline: expectedAnswer,
    givenAnswer: normalized,
  })
}

/**
 * Get list of available question sets.
 * @returns {Promise<string[]>}
 */
export async function getSetList() {
  return get('/set-list')
}

/**
 * Get number of packets in a set.
 * @param {string} setName
 * @returns {Promise<number>}
 */
export async function getNumPackets(setName) {
  const data = await get('/num-packets', { setName })
  return data.numPackets
}

/**
 * Get a full packet (tossups + bonuses) by set name and packet number.
 * @param {string} setName
 * @param {number} packetNumber - 1-indexed
 * @returns {Promise<{tossups: Array, bonuses: Array}>}
 */
export async function getPacket(setName, packetNumber) {
  return get('/packet', { setName, packetNumber })
}

/**
 * Search questions by text query.
 * @param {Object} opts
 * @param {string} opts.queryString - Search text
 * @param {string} [opts.questionType] - "tossup", "bonus", or "all"
 * @param {string[]} [opts.categories]
 * @param {number[]} [opts.difficulties]
 * @param {number} [opts.maxReturnLength=25] - Max results
 */
export async function queryQuestions(opts = {}) {
  return get('/query', {
    queryString: opts.queryString,
    questionType: opts.questionType || 'all',
    categories: opts.categories?.join(','),
    difficulties: opts.difficulties?.join(','),
    maxReturnLength: opts.maxReturnLength || 25,
  })
}
