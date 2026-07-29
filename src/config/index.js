const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const serverPort = parseInt(process.env.PORT || '5501', 10);

const config = {
    server: {
        port: serverPort,
        localUrl: process.env.LOCAL_SERVER_URL || `http://localhost:${serverPort}`
    },
    match: {
        id: parseInt(process.env.MATCH_ID || '240704', 10),
        pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '3000', 10),
        saveIntervalMs: parseInt(process.env.SAVE_INTERVAL_MS || '10000', 10)
    },
    api: {
        baseUrl: process.env.API_BASE_URL || 'https://metrovoley.com.ar/api/matches',
        timeoutMs: parseInt(process.env.API_TIMEOUT_MS || '10000', 10),
        retry: {
            attempts: parseInt(process.env.API_RETRY_ATTEMPTS || '3', 10),
            backoffMs: parseInt(process.env.API_RETRY_BACKOFF_MS || '1000', 10)
        }
    },
    websocket: {
        enabled: process.env.WS_ENABLED === 'true',
        url: process.env.WS_URL || 'wss://metrovoley.com.ar/ws/matches',
        reconnectIntervalMs: 5000,
        maxReconnectAttempts: 10
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
        file: process.env.LOG_FILE || 'tracker.log'
    }
};

if (!config.match.id) {
    throw new Error('MATCH_ID is required in .env file');
}

module.exports = config;
