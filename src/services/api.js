const { retry, NetworkError, TimeoutError, APIError } = require('./retry');
const logger = require('../utils/logger');
const config = require('../config');

class MetroVoleyAPI {
    constructor(matchId) {
        this.matchId = matchId;
        this.baseUrl = config.api.baseUrl;
        this.timeoutMs = config.api.timeoutMs;
        this.retryConfig = config.api.retry;
    }

    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new TimeoutError(`Request timeout after ${this.timeoutMs}ms`);
            }
            throw new NetworkError(`Network error: ${error.message}`, error);
        }
    }

    async fetchUpdates() {
        const url = `${this.baseUrl}/${this.matchId}/updates`;
        const fetchFn = async () => {
            logger.debug('Fetching updates', { url });
            const response = await this.fetchWithTimeout(url);
            if (response.status === 404) {
                throw new APIError(404, `Partido ${this.matchId} no encontrado. Verificar ID.`);
            }
            if (!response.ok) {
                throw new APIError(response.status, `HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            this.validateResponse(data);
            return data;
        };
        const shouldRetry = (error) => {
            if (error instanceof APIError && error.statusCode === 404) {
                return false;
            }
            return error instanceof NetworkError || error instanceof TimeoutError;
        };
        return retry(fetchFn, {
            attempts: this.retryConfig.attempts,
            backoffMs: this.retryConfig.backoffMs,
            shouldRetry
        });
    }

    validateResponse(data) {
        if (!data?.match?.sets) {
            throw new Error('Invalid API response: missing match or sets data');
        }
        if (!Array.isArray(data.match.sets) || data.match.sets.length === 0) {
            throw new Error('Invalid API response: sets must be a non-empty array');
        }
        return data;
    }

    async fetchStats() {
        const url = `${this.baseUrl}/${this.matchId}/stats`;
        try {
            const response = await this.fetchWithTimeout(url);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            logger.warn('Failed to fetch stats', { error: error.message });
            return null;
        }
    }
}

module.exports = MetroVoleyAPI;