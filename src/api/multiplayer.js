/**
 * QBreader Multiplayer WebSocket client.
 * qbreader uses raw WebSocket (not Socket.IO).
 * All messages are JSON objects with a `type` field.
 */

const WS_BASE = 'wss://www.qbreader.org'
const PING_INTERVAL = 30000

export default class MultiplayerClient {
  constructor() {
    this.socket = null
    this.pingTimer = null
    this.listeners = new Map()
    this.userId = null
    this.username = null
    this.roomName = null
  }

  /**
   * Generate a random user ID.
   */
  static generateUserId() {
    return 'user_' + Math.random().toString(36).substring(2, 10)
  }

  /**
   * Connect to a multiplayer room.
   * @param {string} roomName
   * @param {string} username
   * @param {string} [userId]
   */
  connect(roomName, username, userId) {
    this.roomName = roomName
    this.username = username
    this.userId = userId || MultiplayerClient.generateUserId()

    const params = new URLSearchParams({
      roomName,
      userId: this.userId,
      username,
    })

    const url = `${WS_BASE}/play/mp/room/${encodeURIComponent(roomName)}?${params}`

    this.socket = new WebSocket(url)

    this.socket.onopen = () => {
      this._emit('_connected', {})
      // Start ping keepalive
      this.pingTimer = setInterval(() => {
        this.send('ping', {})
      }, PING_INTERVAL)
    }

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        this._emit(msg.type, msg)
      } catch (err) {
        console.error('Failed to parse WS message:', err)
      }
    }

    this.socket.onclose = (event) => {
      this._cleanup()
      this._emit('_disconnected', { code: event.code, reason: event.reason })
    }

    this.socket.onerror = (event) => {
      this._emit('_error', { error: event })
    }
  }

  /**
   * Send a message to the server.
   * @param {string} type
   * @param {Object} data
   */
  send(type, data = {}) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, ...data }))
    }
  }

  /**
   * Register a listener for a message type.
   * @param {string} type
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type).add(callback)
    return () => this.listeners.get(type)?.delete(callback)
  }

  /**
   * Disconnect from the room.
   */
  disconnect() {
    this._cleanup()
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  // --- Convenience methods for common actions ---

  buzz() { this.send('buzz') }
  next() { this.send('next') }
  pause(pausedTime) { this.send('pause', { pausedTime }) }
  chat(message) { this.send('chat', { message }) }
  giveAnswer(givenAnswer) { this.send('give-answer', { givenAnswer }) }
  giveAnswerLiveUpdate(givenAnswer) { this.send('give-answer-live-update', { givenAnswer }) }
  startBonusAnswer() { this.send('start-bonus-answer') }

  // --- Internal ---

  _emit(type, data) {
    const handlers = this.listeners.get(type)
    if (handlers) {
      for (const handler of handlers) {
        try { handler(data) } catch (err) { console.error(`Handler error for ${type}:`, err) }
      }
    }
    // Also emit to wildcard listeners
    const wildcardHandlers = this.listeners.get('*')
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try { handler(type, data) } catch (err) { console.error('Wildcard handler error:', err) }
      }
    }
  }

  _cleanup() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}
