// src/services/websocket.js
// WebSocket service - preparado para cuando se habilite

const logger = require('../utils/logger');
const config = require('../config');

class WebSocketService {
  constructor(matchId, onMessage, onError) {
    this.matchId = matchId;
    this.onMessage = onMessage;
    this.onError = onError;
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.reconnectInterval = config.websocket?.reconnectIntervalMs || 5000;
    this.maxReconnectAttempts = config.websocket?.maxReconnectAttempts || 10;
    this.shouldReconnect = true;
    this.enabled = config.websocket?.enabled || false;
  }

  connect() {
    if (!this.enabled) {
      logger.debug('WebSocket disabled, skipping connection');
      return;
    }

    // WebSocket implementation would go here
    // For now, just log that it's not implemented
    logger.warn('WebSocket service not fully implemented yet');
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    logger.info('WebSocket disconnected');
  }

  send(data) {
    if (this.isConnected && this.ws) {
      // Send data
      return true;
    }
    return false;
  }
}

module.exports = WebSocketService;