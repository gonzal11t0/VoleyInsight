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
assert.equal(snapshots.filter(p => p?.event?.startsWith('BREAK_')).length, 17);

const metricas = new VolleyballMetrics(snapshots);
assert.deepEqual(metricas.calculateSideoutPercentage().percentage, { home: '64.0', away: '68.0' });
assert.deepEqual(metricas.calculateBreakPointEfficiency().efficiency, { home: '32.0', away: '36.0' });

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

console.log('rotationState 259144: tests OK');
