const assert = require('node:assert/strict');
const {
    appendEvent,
    normalizeLegacyEvents,
    updateEvent,
    voidEvent,
    activeEvents,
    recoveryStatus,
    createRecoveryEvents,
    coverageBySet
} = require('../src/core/eventEngine');

const basePoint = {
    set: 1,
    equipoAnota: 'LOCAL',
    accion: 'ATAQUE',
    jugador: 7,
    marcadorAntes: '0-0',
    marcadorDespues: '1-0',
    timestamp: '2026-08-20T12:00:00.000Z'
};

let events = normalizeLegacyEvents([basePoint], { matchId: 123 });
assert.ok(events[0].eventId, 'los puntos viejos reciben un identificador');
const duplicate = appendEvent(events, basePoint, { matchId: 123 });
assert.equal(duplicate.duplicate, true);
assert.equal(duplicate.events.length, 1, 'un reintento no debe duplicar el punto');
const sameScoreDifferentDetail = appendEvent(events, {
    ...basePoint,
    accion: 'BLOQUEO',
    jugador: 9
}, { matchId: 123 });
assert.equal(sameScoreDifferentDetail.duplicate, true, 'un mismo marcador identifica un único rally aunque cambie el detalle');

const corrected = updateEvent(events, events[0].eventId, { accion: 'BLOQUEO', jugador: 9 });
assert.equal(corrected.found, true);
assert.equal(corrected.event.accion, 'BLOQUEO');
assert.equal(corrected.event.revision, 2);
assert.equal(corrected.event.revisionHistory.length, 1);

const voided = voidEvent(corrected.events, corrected.event.eventId);
assert.equal(activeEvents(voided.events).length, 0, 'deshacer anula solo el evento elegido');

const snapshots = [
    { set: 1, homeScore: 0, awayScore: 0 },
    { set: 1, homeScore: 1, awayScore: 0 },
    { set: 1, homeScore: 1, awayScore: 1 },
    { set: 1, homeScore: 2, awayScore: 1 }
];
const status = recoveryStatus(events, snapshots, 1);
assert.deepEqual(status.order, ['VISITANTE', 'LOCAL']);
assert.equal(status.missing, 2);
assert.equal(status.exactOrder, true);
const recovery = createRecoveryEvents(events, snapshots, { matchId: 123, set: 1 });
assert.equal(recovery.created.length, 2);
assert.equal(recovery.created[0].jugador, null);
assert.equal(recovery.created[0].accion, 'EQUIPO');
assert.equal(recovery.created.at(-1).marcadorDespues, '2-1');

const coverage = coverageBySet(recovery.events, snapshots);
assert.equal(coverage[0].official, 3);
assert.equal(coverage[0].manual, 3);
assert.equal(coverage[0].complete, true);

const salto = recoveryStatus([], [
    { set: 1, homeScore: 0, awayScore: 0 },
    { set: 1, homeScore: 2, awayScore: 1 }
], 1);
assert.equal(salto.reason, 'official-incomplete');
assert.equal(salto.canRecover, false, 'un salto mixto no debe recuperarse inventando el orden');
assert.equal(salto.missing, 0, 'solo se ofrecen eventos que Metro permite reconstruir exactamente');

const ordenParcialInconsistente = recoveryStatus([], [
    { set: 1, homeScore: 1, awayScore: 0 },
    { set: 1, homeScore: 2, awayScore: 0 },
    { set: 1, homeScore: 1, awayScore: 1 }
], 1);
assert.equal(ordenParcialInconsistente.reason, 'official-incomplete');
assert.equal(ordenParcialInconsistente.canRecover, false);

const conflicto = recoveryStatus(normalizeLegacyEvents([{
    set: 1,
    equipoAnota: 'LOCAL',
    marcadorAntes: '1-0',
    marcadorDespues: '2-0'
}], { matchId: 123 }), [
    { set: 1, homeScore: 0, awayScore: 0 },
    { set: 1, homeScore: 1, awayScore: 0, scorer: 'HOME' }
], 1);
assert.equal(conflicto.conflict, true);
assert.equal(conflicto.canRecover, false, 'si el manual está adelantado hay que corregir, no agregar puntos');

const unavailable = recoveryStatus(events, [
    { set: 5, homeScore: 7, awayScore: 15 }
], 1);
assert.equal(unavailable.reason, 'official-unavailable');
assert.equal(unavailable.conflict, false, 'sin historial oficial no corresponde acusar un conflicto');
assert.equal(unavailable.canRecover, false);

const fullSet = [];
let home = 0;
let away = 0;
fullSet.push({ set: 3, homeScore: 0, awayScore: 0 });
for (const team of ['LOCAL', 'LOCAL', 'VISITANTE', 'LOCAL', 'VISITANTE', 'LOCAL', 'LOCAL', 'LOCAL', 'LOCAL', 'VISITANTE']) {
    if (team === 'LOCAL') home += 1;
    else away += 1;
    fullSet.push({
        set: 3,
        homeScore: home,
        awayScore: away,
        scorer: team === 'LOCAL' ? 'HOME' : 'AWAY',
        timestamp: `2026-08-20T12:00:${String(home + away).padStart(2, '0')}.000Z`
    });
}
const retainedSuffix = normalizeLegacyEvents(fullSet
    .filter(snapshot => snapshot.homeScore + snapshot.awayScore >= 6)
    .filter(snapshot => snapshot.scorer)
    .map(snapshot => ({
        set: 3,
        equipoAnota: snapshot.scorer === 'HOME' ? 'LOCAL' : 'VISITANTE',
        marcadorDespues: `${snapshot.homeScore}-${snapshot.awayScore}`
    })), { matchId: 123 });
const prefixLoss = recoveryStatus(retainedSuffix, fullSet, 3);
assert.equal(prefixLoss.manualScore.home, home, 'el marcador final puede coincidir aunque falten eventos anteriores');
assert.equal(prefixLoss.manualScore.away, away);
assert.equal(prefixLoss.missing, 5, 'la recuperación compara rallies presentes, no solo el marcador final');
assert.equal(prefixLoss.canRecover, true);
const restoredPrefix = createRecoveryEvents(retainedSuffix, fullSet, { matchId: 123, set: 3 });
assert.equal(restoredPrefix.created.length, 5);
assert.equal(restoredPrefix.events[0].marcadorDespues, '1-0', 'los puntos recuperados vuelven a su posición cronológica');
assert.equal(coverageBySet(restoredPrefix.events, fullSet)[0].complete, true);

console.log('eventEngine: tests OK');
