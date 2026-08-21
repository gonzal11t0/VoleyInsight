const crypto = require('crypto');

const COOKIE_NAME = 'voleyinsight_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const ROLES = new Set(['operator', 'public']);

function safeEqual(left, right) {
    const a = Buffer.from(String(left || ''), 'utf8');
    const b = Buffer.from(String(right || ''), 'utf8');
    if (a.length !== b.length) {
        crypto.timingSafeEqual(a, Buffer.alloc(a.length));
        return false;
    }
    return crypto.timingSafeEqual(a, b);
}

function parseCookies(header = '') {
    return String(header)
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .reduce((cookies, part) => {
            const separator = part.indexOf('=');
            if (separator < 1) return cookies;
            const key = decodeURIComponent(part.slice(0, separator).trim());
            const value = decodeURIComponent(part.slice(separator + 1).trim());
            cookies[key] = value;
            return cookies;
        }, {});
}

function base64UrlEncode(value) {
    return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload, secret) {
    return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function createSessionToken({ role, now = Date.now(), durationMs = SESSION_DURATION_MS } = {}, secret) {
    if (!ROLES.has(role)) throw new Error('Rol inválido');
    if (!secret) throw new Error('Falta el secreto de sesión');
    const payload = base64UrlEncode(JSON.stringify({
        role,
        issuedAt: now,
        expiresAt: now + durationMs,
        nonce: crypto.randomBytes(12).toString('hex')
    }));
    return `${payload}.${sign(payload, secret)}`;
}

function verifySessionToken(token, secret, now = Date.now()) {
    if (!token || !secret) return null;
    const [payload, signature, extra] = String(token).split('.');
    if (!payload || !signature || extra) return null;
    if (!safeEqual(signature, sign(payload, secret))) return null;
    try {
        const session = JSON.parse(base64UrlDecode(payload));
        if (!ROLES.has(session.role)) return null;
        if (!Number.isFinite(session.expiresAt) || session.expiresAt <= now) return null;
        return session;
    } catch (error) {
        return null;
    }
}

function validatePassword(role, password, passwords = {}) {
    if (!ROLES.has(role)) return false;
    const expected = role === 'operator'
        ? passwords.operator
        : passwords.public;
    return Boolean(expected) && safeEqual(password, expected);
}

function cookieOptions({ secure = false, maxAgeMs = SESSION_DURATION_MS } = {}) {
    const parts = [
        `${COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${Math.floor(maxAgeMs / 1000)}`
    ];
    if (secure) parts.push('Secure');
    return parts;
}

function serializeSessionCookie(token, options = {}) {
    const parts = cookieOptions(options);
    parts[0] = `${COOKIE_NAME}=${encodeURIComponent(token)}`;
    return parts.join('; ');
}

function serializeExpiredCookie({ secure = false } = {}) {
    const parts = [
        `${COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=0'
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
}

function readSessionFromRequest(req, secret, now = Date.now()) {
    const token = parseCookies(req?.headers?.cookie || '')[COOKIE_NAME];
    return verifySessionToken(token, secret, now);
}

module.exports = {
    COOKIE_NAME,
    SESSION_DURATION_MS,
    ROLES,
    safeEqual,
    parseCookies,
    createSessionToken,
    verifySessionToken,
    validatePassword,
    serializeSessionCookie,
    serializeExpiredCookie,
    readSessionFromRequest
};
