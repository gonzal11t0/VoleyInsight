const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadAuthPasswords } = require('../src/core/authConfig');

const passwords = loadAuthPasswords({
    VOLEY_OPERATOR_PASSWORD: 'ClaveOperador',
    VOLEY_PUBLIC_PASSWORD: 'ClavePublica'
});

assert.deepEqual(passwords, {
    operator: 'ClaveOperador',
    public: 'ClavePublica'
});
assert.throws(
    () => loadAuthPasswords({ VOLEY_OPERATOR_PASSWORD: 'ClaveOperador' }),
    /VOLEY_PUBLIC_PASSWORD/
);
assert.throws(
    () => loadAuthPasswords({ VOLEY_PUBLIC_PASSWORD: 'ClavePublica' }),
    /VOLEY_OPERATOR_PASSWORD/
);

const projectRoot = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(projectRoot, 'server-api.js'), 'utf8');
const envExample = fs.readFileSync(path.join(projectRoot, '.env.example'), 'utf8');
assert.match(serverSource, /require\('dotenv'\)\.config\(\)/);
assert.doesNotMatch(serverSource, /process\.env\.VOLEY_OPERATOR_PASSWORD\s*\|\|/);
assert.doesNotMatch(serverSource, /process\.env\.VOLEY_PUBLIC_PASSWORD\s*\|\|/);
assert.match(envExample, /cambiar-clave-del-operador/);
assert.match(envExample, /cambiar-clave-del-publico/);

console.log('authConfig: tests OK');
