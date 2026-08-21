class LoginGuard {
    constructor({ maxAttempts = 5, windowMs = 10 * 60 * 1000, blockMs = 15 * 60 * 1000 } = {}) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
        this.blockMs = blockMs;
        this.entries = new Map();
    }

    status(key, now = Date.now()) {
        const entry = this.entries.get(String(key));
        if (!entry) return { blocked: false, retryAfterMs: 0 };
        if (entry.blockedUntil > now) {
            return { blocked: true, retryAfterMs: entry.blockedUntil - now };
        }
        if (now - entry.firstAttemptAt > this.windowMs) {
            this.entries.delete(String(key));
            return { blocked: false, retryAfterMs: 0 };
        }
        return { blocked: false, retryAfterMs: 0, attempts: entry.attempts };
    }

    failure(key, now = Date.now()) {
        const id = String(key);
        const current = this.entries.get(id);
        const entry = !current || now - current.firstAttemptAt > this.windowMs
            ? { attempts: 0, firstAttemptAt: now, blockedUntil: 0 }
            : current;
        entry.attempts += 1;
        if (entry.attempts >= this.maxAttempts) entry.blockedUntil = now + this.blockMs;
        this.entries.set(id, entry);
        return this.status(id, now);
    }

    success(key) {
        this.entries.delete(String(key));
    }
}

module.exports = { LoginGuard };
