import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const helperSource = await readFile(new URL('../dashboard/js/partidoHelper.js', import.meta.url), 'utf8');
const helperModule = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString('base64')}`);
const { evaluarEstadoPartido, extraerEstadoOficial, isSetTerminado } = helperModule;

const require = createRequire(import.meta.url);
const ActivityStatus = require('../src/core/activityStatus.js');

const config = {
    maxSets: 3,
    setsParaGanar: 2,
    puntosSetNormal: 25,
    puntosSetDecisivo: 15
};

const dosSetsGanados = new Map([
    [1, { home: 25, away: 23 }],
    [2, { home: 25, away: 14 }]
]);
assert.equal(evaluarEstadoPartido(dosSetsGanados, config).partidoTerminado, true);

const tercerSetEnCurso = new Map([
    ...dosSetsGanados,
    [3, { home: 22, away: 23 }]
]);
assert.equal(isSetTerminado(22, 23, 3, config), false);
assert.equal(
    evaluarEstadoPartido(tercerSetEnCurso, config).partidoTerminado,
    false,
    'un set posterior en curso impide declarar ganador'
);

const fullDataEnCurso = {
    match: {
        statusId: 3,
        winnerId: null,
        currentSet: 3,
        sets: [
            { number: 1, statusId: 2, homeTeamScore: 25, awayTeamScore: 23 },
            { number: 2, statusId: 2, homeTeamScore: 25, awayTeamScore: 14 },
            { number: 3, statusId: 3, homeTeamScore: 22, awayTeamScore: 23 }
        ]
    }
};
const estadoOficialEnCurso = extraerEstadoOficial(fullDataEnCurso);
assert.equal(estadoOficialEnCurso.enCurso, true);
assert.equal(
    evaluarEstadoPartido(dosSetsGanados, config, estadoOficialEnCurso).partidoTerminado,
    false,
    'el estado oficial en curso tiene prioridad incluso entre sets'
);

const fullDataFinal = {
    match: {
        statusId: 4,
        winnerId: 123,
        currentSet: 3,
        sets: [
            { number: 1, statusId: 2 },
            { number: 2, statusId: 2 },
            { number: 3, statusId: 2 }
        ]
    }
};
assert.equal(
    evaluarEstadoPartido(tercerSetEnCurso, config, extraerEstadoOficial(fullDataFinal)).partidoTerminado,
    true,
    'un ganador oficial confirma el final'
);

const actividad = new ActivityStatus(120);
assert.equal(actividad.update(null, 1_000).status, 'waiting');
assert.equal(actividad.update({ scorer: 'HOME' }, 10_000).status, 'active');
assert.equal(actividad.update(null, 129_999).shouldNotify, false);
const pausa = actividad.update(null, 130_000);
assert.deepEqual(pausa, {
    status: 'inactive',
    secondsWithoutPoints: 120,
    shouldNotify: true
});
assert.equal(actividad.update(null, 140_000).shouldNotify, false, 'la pausa se avisa una sola vez');
assert.equal(actividad.update({ scorer: 'AWAY' }, 150_000).status, 'active');
assert.equal(actividad.update(null, 270_000).shouldNotify, true, 'un punto nuevo reinicia la pausa');

console.log('partidoStatus + inactivity: tests OK');
