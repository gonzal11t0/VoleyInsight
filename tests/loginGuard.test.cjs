const assert = require('node:assert/strict');
const { LoginGuard } = require('../src/core/loginGuard');

const guard = new LoginGuard({ maxAttempts: 3, windowMs: 1000, blockMs: 5000 });
assert.equal(guard.status('ip', 0).blocked, false);
guard.failure('ip', 0);
guard.failure('ip', 10);
assert.equal(guard.status('ip', 20).blocked, false);
assert.equal(guard.failure('ip', 30).blocked, true);
assert.equal(guard.status('ip', 2000).retryAfterMs, 3030);
assert.equal(guard.status('ip', 6000).blocked, false);
guard.failure('ok', 0);
guard.success('ok');
assert.equal(guard.status('ok', 1).blocked, false);

console.log('loginGuard: tests OK');
