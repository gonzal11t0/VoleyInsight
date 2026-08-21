const assert = require('node:assert/strict');
const { obtenerMatchIdActivo } = require('../src/core/trackerActiveState');

assert.equal(obtenerMatchIdActivo({ matchId: 274738 }), 274738);
assert.equal(obtenerMatchIdActivo({ matchId: '277500' }), 277500);
assert.equal(obtenerMatchIdActivo({}), null);
assert.equal(obtenerMatchIdActivo({ matchId: 0 }), null);
assert.equal(obtenerMatchIdActivo({ matchId: 'invalido' }), null);

console.log('trackerActiveState: tests OK');
