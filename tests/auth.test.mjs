import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    COOKIE_NAME,
    createSessionToken,
    verifySessionToken,
    validatePassword,
    serializeSessionCookie,
    parseCookies
} = require('../src/core/auth.js');

const secret = 'secreto-de-prueba-muy-largo';
const now = Date.parse('2026-08-20T12:00:00.000Z');
const token = createSessionToken({ role: 'operator', now, durationMs: 10_000 }, secret);
assert.equal(verifySessionToken(token, secret, now + 5_000).role, 'operator');
assert.equal(verifySessionToken(token, secret, now + 10_001), null, 'la sesión vencida debe rechazarse');
assert.equal(verifySessionToken(`${token}x`, secret, now), null, 'una firma alterada debe rechazarse');
assert.equal(validatePassword('operator', 'ClaveOperador', { operator: 'ClaveOperador', public: 'ClavePublica' }), true);
assert.equal(validatePassword('operator', 'claveoperador', { operator: 'ClaveOperador', public: 'ClavePublica' }), false);
assert.equal(validatePassword('public', 'ClavePublica', { operator: 'ClaveOperador', public: 'ClavePublica' }), true);
const cookie = serializeSessionCookie(token);
assert.match(cookie, /HttpOnly/);
assert.match(cookie, /SameSite=Lax/);
assert.equal(parseCookies(cookie)[COOKIE_NAME], token);

console.log('auth: tests OK');
