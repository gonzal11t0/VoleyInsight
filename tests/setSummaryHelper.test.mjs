import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dashboard/js/setSummaryHelper.js', import.meta.url), 'utf8');
const helper = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const official = [];
for (let home = 1; home <= 25; home++) official.push({ set: 1, homeScore: home, awayScore: Math.min(home, 23), scorer: 'HOME' });
official.push({ set: 2, homeScore: 1, awayScore: 0, scorer: 'HOME' });
const manual = [
    { set: 1, equipoAnota: 'LOCAL', jugador: 8, marcadorDespues: '1-0' },
    { set: 1, equipoAnota: 'LOCAL', jugador: 8, marcadorDespues: '2-0' },
    { set: 1, equipoAnota: 'VISITANTE', jugador: 4, marcadorDespues: '2-1' }
];
const summary = helper.buildSetSummary({
    officialPoints: official,
    manualPoints: manual,
    homeTeam: 'ATTITUDE',
    awayTeam: 'RIVAL',
    homeNames: { 8: 'Jugadora Principal' },
    config: { puntosSetNormal: 25, puntosSetDecisivo: 15, maxSets: 5 }
});
assert.equal(summary.set, 1);
assert.equal(summary.winner, 'ATTITUDE');
assert.equal(summary.topScorer.name, 'Jugadora Principal');
assert.equal(summary.topScorer.points, 2);
assert.ok(summary.coverage > 0 && summary.coverage < 100);
assert.equal(helper.latestFinishedSet([{ set: 1, homeScore: 10, awayScore: 9 }]), null);

console.log('setSummaryHelper: tests OK');
