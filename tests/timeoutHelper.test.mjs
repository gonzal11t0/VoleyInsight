import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dashboard/js/timeoutHelper.js', import.meta.url), 'utf8');
const { deduplicateTimeouts } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const base = { set: 1, equipo: 'LOCAL', marcador: '19-22', timestamp: '2026-08-13T21:19:28.000Z' };
assert.equal(deduplicateTimeouts([base, { ...base, timestamp: '2026-08-13T21:19:28.500Z' }]).length, 1);
assert.equal(deduplicateTimeouts([base, { ...base, marcador: '20-22' }]).length, 2);
assert.equal(deduplicateTimeouts([{ ...base, id: 't1' }, { ...base, id: 't1', marcador: '20-22' }]).length, 1);

console.log('timeoutHelper: tests OK');
