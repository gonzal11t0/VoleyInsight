const assert = require('node:assert/strict');
const StateProcessor = require('../src/core/stateProcessor');
const {
    enriquecerPuntosManuales,
    enriquecerSnapshotsOficiales
} = require('../src/core/rotationHistory');
const VolleyballMetrics = require('../src/analytics/volleyballMetrics');

// Secuencia real del set ACQUA 24-26 CAIT (partido 259144).
const secuencia = 'AAAAHAAAAHHHAAAAHHHHAAHHAHHHHAHHHHAAAAAAHHAAHHHHAA';

function apiData(homeScore, awayScore, serving) {
    return {
        match: {
            currentSet: 1,
            homeTeam: { name: 'ACQUA' },
            awayTeam: { name: 'CAIT' },
            sets: [{ homeTeamScore: homeScore, awayTeamScore: awayScore }]
        },
        liveState: { serving: serving === 'H' ? 'home' : 'away' }
    };
}

const processor = new StateProcessor();
const snapshots = [];
let homeScore = 0;
let awayScore = 0;

snapshots.push(processor.processUpdate(apiData(0, 0, 'H')));
for (const ganador of secuencia) {
    if (ganador === 'H') homeScore++;
    else awayScore++;
    snapshots.push(processor.processUpdate(apiData(homeScore, awayScore, ganador)));
}

assert.equal(snapshots.length, 51);
assert.equal(snapshots.filter(Boolean).length, 51);
assert.deepEqual(
    {
        marcador: `${snapshots[1].homeScore}-${snapshots[1].awayScore}`,
        sacaba: snapshots[1].equipoSacaba,
        anota: snapshots[1].scorer,
        rotacionAntes: snapshots[1].rotacionVisitante,
        rotacionDespues: snapshots[1].rotacionVisitanteDespues
    },
    {
        marcador: '0-1',
        sacaba: 'LOCAL',
        anota: 'AWAY',
        rotacionAntes: 1,
        rotacionDespues: 2
    },
    'el primer punto debe usar el saque previo y rotar a CAIT'
);

const ultimo = snapshots.at(-1);
assert.equal(ultimo.homeScore, 24);
assert.equal(ultimo.awayScore, 26);
assert.equal(ultimo.rotacionLocalDespues, 3);
assert.equal(ultimo.rotacionVisitanteDespues, 4);
assert.equal(snapshots.filter(p => p?.event?.startsWith('BREAK_')).length, 33);

const metricas = new VolleyballMetrics(snapshots);
assert.deepEqual(metricas.calculateSideoutPercentage().percentage, { home: '32.0', away: '36.0' });
assert.deepEqual(metricas.calculateBreakPointEfficiency().efficiency, { home: '64.0', away: '68.0' });

const snapshotsLegacy = snapshots.map(snapshot => {
    const copia = { ...snapshot, serving: snapshot.servingAfter };
    delete copia.servingBefore;
    delete copia.servingAfter;
    delete copia.rotacionLocal;
    delete copia.rotacionVisitante;
    delete copia.rotacionLocalDespues;
    delete copia.rotacionVisitanteDespues;
    delete copia.equipoSacaba;
    delete copia.equipoSacaDespues;
    return copia;
});
const snapshotsLegacyCorregidos = enriquecerSnapshotsOficiales(snapshotsLegacy);
assert.equal(snapshotsLegacyCorregidos[1].serving, 'HOME');
assert.equal(snapshotsLegacyCorregidos[1].servingAfter, 'AWAY');
assert.equal(snapshotsLegacyCorregidos.at(-1).rotacionLocalDespues, 3);
assert.equal(snapshotsLegacyCorregidos.at(-1).rotacionVisitanteDespues, 4);

const manualesConErrorAnterior = snapshots.slice(1).map((snapshot, indice) => ({
    set: 1,
    punto: indice + 1,
    equipoAnota: snapshot.scorer === 'HOME' ? 'LOCAL' : 'VISITANTE',
    marcadorDespues: `${snapshot.homeScore}-${snapshot.awayScore}`,
    rotacionLocal: 1,
    rotacionVisitante: 1,
    equipoSacaba: snapshot.scorer === 'HOME' ? 'LOCAL' : 'VISITANTE',
    rotacionLocalDespues: 1,
    rotacionVisitanteDespues: 1
}));

const resultado = enriquecerPuntosManuales(manualesConErrorAnterior, snapshots);
assert.equal(resultado.puntos.length, 50);
assert.equal(resultado.pendientes, 0);
assert.equal(resultado.conflictos, 0);
assert.equal(resultado.puntos.filter(p => p.sincronizacionOficial === 'confirmada').length, 50);
assert.equal(resultado.puntos.at(-1).rotacionLocalDespues, 3);
assert.equal(resultado.puntos.at(-1).rotacionVisitanteDespues, 4);

const resumenLocal = Object.fromEntries(
    Array.from({ length: 6 }, (_, indice) => [indice + 1, { favor: 0, contra: 0 }])
);
for (const punto of resultado.puntos) {
    const fila = resumenLocal[punto.rotacionLocal];
    if (punto.equipoAnota === 'LOCAL') fila.favor++;
    else fila.contra++;
}
assert.deepEqual(resumenLocal, {
    1: { favor: 5, contra: 10 },
    2: { favor: 3, contra: 6 },
    3: { favor: 6, contra: 6 },
    4: { favor: 4, contra: 2 },
    5: { favor: 2, contra: 1 },
    6: { favor: 4, contra: 1 }
});

// Caso real MUNMARG 9-12 -> 11-12: los dos puntos deben conservarse.
const gapProcessor = new StateProcessor();
gapProcessor.processUpdate(apiData(9, 12, 'A'));
gapProcessor.rotations = { home: 2, away: 1 };
const gapSnapshots = gapProcessor.processUpdates(apiData(11, 12, 'H'));

assert.equal(gapSnapshots.length, 2, 'un salto de dos debe producir dos rallies');
assert.deepEqual(
    gapSnapshots.map(punto => ({
        marcador: `${punto.homeScore}-${punto.awayScore}`,
        evento: punto.event,
        rotacionAntes: punto.rotacionLocal,
        rotacionDespues: punto.rotacionLocalDespues,
        origen: punto.origenPunto
    })),
    [
        {
            marcador: '10-12',
            evento: 'SIDEOUT_HOME',
            rotacionAntes: 2,
            rotacionDespues: 3,
            origen: 'score_gap_same_team'
        },
        {
            marcador: '11-12',
            evento: 'BREAK_HOME',
            rotacionAntes: 3,
            rotacionDespues: 3,
            origen: 'score_gap_same_team'
        }
    ]
);

// Si anotaron ambos equipos entre consultas, la timeline define el orden.
const timelineProcessor = new StateProcessor();
timelineProcessor.processUpdate(apiData(1, 1, 'H'));
const mixedData = apiData(2, 2, 'H');
mixedData.liveState.timeline = [
    { id: 'metro-1', type: 'SCORE_POINT', setNumber: 1, score: { home: 1, away: 2 }, timestamp: '2026-08-05T00:00:01.000Z', undone: false },
    { id: 'metro-2', type: 'SCORE_POINT', setNumber: 1, score: { home: 2, away: 2 }, timestamp: '2026-08-05T00:00:02.000Z', undone: false }
];
const mixedSnapshots = timelineProcessor.processUpdates(mixedData);
assert.deepEqual(mixedSnapshots.map(p => p.scorer), ['AWAY', 'HOME']);
assert.deepEqual(mixedSnapshots.map(p => p.metroEventId), ['metro-1', 'metro-2']);
assert.ok(mixedSnapshots.every(p => p.origenPunto === 'metro_timeline'));

// Sin timeline y con puntos de ambos equipos, no se inventa el orden.
const ambiguousProcessor = new StateProcessor();
ambiguousProcessor.processUpdate(apiData(1, 1, 'H'));
const ambiguousSnapshots = ambiguousProcessor.processUpdates(apiData(2, 2, 'H'));
assert.equal(ambiguousSnapshots.length, 1);
assert.equal(ambiguousSnapshots[0].scorer, null);
assert.equal(ambiguousSnapshots[0].event, 'SCORE_GAP_AMBIGUOUS');
assert.equal(ambiguousSnapshots[0].sincronizacionOficial, 'ambigua');
assert.deepEqual(ambiguousSnapshots[0].scoreGap, { home: 1, away: 1, total: 2 });

// Los límites visibles son Early 1-10, Mid 11-20 y Late 21+.
const phaseProcessor = new StateProcessor();
assert.equal(phaseProcessor.calculatePhase(10), 'EARLY');
assert.equal(phaseProcessor.calculatePhase(11), 'MID');
assert.equal(phaseProcessor.calculatePhase(20), 'MID');
assert.equal(phaseProcessor.calculatePhase(21), 'LATE');

console.log('rotationState + score gaps: tests OK');
