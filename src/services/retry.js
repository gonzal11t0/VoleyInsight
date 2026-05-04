class NetworkError extends Error {
    constructor(message, originalError) {
        super(message);
        this.name = 'NetworkError';
        this.originalError = originalError;
    }
}

class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TimeoutError';
    }
}

class APIError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
    }
}

async function retry(fn, options = {}) {
    const attempts = options.attempts || 3;
    const backoffMs = options.backoffMs || 1000;
    const shouldRetry = options.shouldRetry || (() => true);
    
    let lastError;
    
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            const canRetry = shouldRetry(error) && i < attempts - 1;
            
            if (canRetry) {
                const delay = backoffMs * Math.pow(2, i);
                console.log(`⚠️ Intento ${i + 1}/${attempts} falló. Reintentando en ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
    
    throw lastError;
}

module.exports = {
    retry,
    NetworkError,
    TimeoutError,
    APIError
};