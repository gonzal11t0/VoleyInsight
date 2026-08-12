import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const helperSource = readFileSync(
    fileURLToPath(new URL('../dashboard/js/rotacionHelper.js', import.meta.url)),
    'utf8'
);
const {
    calcularRotacionesPorEquipo,
    obtenerStatsRotacion,
    rotarFormacion,
    reconstruirFormacionInicial,
    filtrarPuntosPorSet,
    seleccionarPuntosParaRotaciones,
    obtenerCoberturaAnalisis
} = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString('base64')}`);

const fixtureUrl = new URL('./fixtures/rotaciones_258880.json', import.meta.url);
const puntos = JSON.parse(readFileSync(fileURLToPath(fixtureUrl), 'utf8'));

assert.equal(puntos.length, 33, 'el caso real debe contener los 33 puntos anotados');
assert.equal(filtrarPuntosPorSet(puntos, 'all').length, 33);
assert.equal(filtrarPuntosPorSet(puntos, '1').length, 33);
assert.equal(filtrarPuntosPorSet(puntos, '2').length, 0);

const local = calcularRotacionesPorEquipo(puntos, 'LOCAL');
assert.deepEqual(
    [local[1].puntosAFavor, local[1].puntosEnContra],
    [2, 5],
    'la rotación 1 local no debe absorber el punto 3-6 de la rotación visitante'
);
assert.deepEqual([local[2].puntosAFavor, local[2].puntosEnContra], [14, 11]);
assert.deepEqual([local[3].puntosAFavor, local[3].puntosEnContra], [1, 0]);
assert.equal(
    Object.values(local).reduce((total, rotacion) => total + rotacion.totalPuntos, 0),
    33,
    'cada rally debe contabilizarse exactamente una vez'
);

const visitante = calcularRotacionesPorEquipo(puntos, 'VISITANTE');
assert.deepEqual([visitante[1].puntosAFavor, visitante[1].puntosEnContra], [6, 3]);
assert.deepEqual([visitante[2].puntosAFavor, visitante[2].puntosEnContra], [10, 14]);

assert.deepEqual(
    obtenerStatsRotacion(puntos, 'LOCAL', 1),
    { puntosAFavor: 2, puntosEnContra: 5, totalPuntos: 7, diferencia: -3, eficiencia: 28.6, estado: '❌ DÉBIL' },
    'la tabla y el detalle deben usar el mismo resultado'
);

const formacionInicial = [1, 2, 3, 4, 5, 6].map(numero => ({
    numero,
    nombre: `Jugadora ${numero}`,
    posicion: numero
}));
const segundaRotacion = rotarFormacion(formacionInicial, 2);
assert.deepEqual(
    segundaRotacion.map(jugadora => jugadora.numero),
    [2, 3, 4, 5, 6, 1],
    'la rotación debe respetar las posiciones de cancha, no ordenar dorsales'
);
assert.deepEqual(
    reconstruirFormacionInicial(segundaRotacion, 2).map(jugadora => jugadora.numero),
    [1, 2, 3, 4, 5, 6],
    'debe poder recuperar la formación inicial al abrir el sistema con el set empezado'
);

// Caso real ATTITUDE-AC D 260329: las anotaciones manuales terminaron 56-59,
// pero nueve rallies quedaron sin rotación por haberse cargado en otro orden.
const distribucionOficial260329 = {
    1: { local: 9, visitante: 10 },
    2: { local: 8, visitante: 11 },
    3: { local: 15, visitante: 7 },
    4: { local: 11, visitante: 8 },
    5: { local: 8, visitante: 12 },
    6: { local: 5, visitante: 11 }
};
const oficiales260329 = Object.entries(distribucionOficial260329).flatMap(([rotacion, resumen]) => [
    ...Array.from({ length: resumen.local }, () => ({
        set: 1,
        scorer: 'HOME',
        rotacionLocal: Number(rotacion),
        rotacionVisitante: 1
    })),
    ...Array.from({ length: resumen.visitante }, () => ({
        set: 1,
        scorer: 'AWAY',
        rotacionLocal: Number(rotacion),
        rotacionVisitante: 1
    }))
]);
const manuales260329 = oficiales260329.map((punto, indice) => ({
    set: punto.set,
    equipoAnota: punto.scorer === 'HOME' ? 'LOCAL' : 'VISITANTE',
    rotacionLocal: indice < 106 ? punto.rotacionLocal : null,
    rotacionVisitante: indice < 106 ? punto.rotacionVisitante : null
}));
const fuente260329 = seleccionarPuntosParaRotaciones(
    oficiales260329,
    manuales260329,
    'LOCAL',
    'all'
);
const rotaciones260329 = calcularRotacionesPorEquipo(fuente260329, 'LOCAL');
assert.equal(fuente260329.length, 115, 'las rotaciones deben cubrir los 115 rallies oficiales');
assert.deepEqual(
    Object.fromEntries(Object.entries(rotaciones260329).map(([rotacion, resumen]) => [
        rotacion,
        [resumen.puntosAFavor, resumen.puntosEnContra]
    ])),
    {
        1: [9, 10],
        2: [8, 11],
        3: [15, 7],
        4: [11, 8],
        5: [8, 12],
        6: [5, 11]
    },
    'la tabla debe usar la secuencia oficial aunque existan puntos manuales sin sincronizar'
);

const respaldoManual = seleccionarPuntosParaRotaciones([], puntos, 'LOCAL', 'all');
assert.equal(respaldoManual.length, 33, 'sin datos oficiales debe conservarse el respaldo manual');

const respaldoPorSet = seleccionarPuntosParaRotaciones(
    [{ set: 1, scorer: 'HOME', rotacionLocal: 1, rotacionVisitante: 1 }],
    [
        { set: 1, equipoAnota: 'LOCAL', rotacionLocal: 2, rotacionVisitante: 1 },
        { set: 2, equipoAnota: 'VISITANTE', rotacionLocal: 3, rotacionVisitante: 2 }
    ],
    'LOCAL',
    'all'
);
assert.deepEqual(
    respaldoPorSet.map(punto => [punto.set, punto.rotacionLocal]),
    [[1, 1], [2, 3]],
    'el acumulado debe usar respaldo manual solo en los sets sin datos oficiales'
);

const coberturaParcial = obtenerCoberturaAnalisis(
    [
        { set: 1, homeScore: 0, awayScore: 0 },
        { set: 1, scorer: 'HOME' },
        { set: 1, scorer: 'AWAY' },
        { set: 2, homeScore: 0, awayScore: 0 },
        { set: 2, scorer: 'HOME' },
        { set: 2, scorer: 'AWAY' }
    ],
    [
        { set: 2, equipoAnota: 'LOCAL' },
        { set: 2, equipoAnota: 'VISITANTE' },
        { set: 2, equipo: 'LOCAL', accion: 'RECEPCION_POSITIVA' }
    ]
);
assert.deepEqual(coberturaParcial.setsOficiales, [1, 2]);
assert.deepEqual(coberturaParcial.setsManuales, [2]);
assert.equal(coberturaParcial.puntosOficiales, 4, 'los snapshots 0-0 no deben contar como puntos');
assert.equal(coberturaParcial.puntosManuales, 2, 'los fundamentos sin punto no deben inflar la cobertura');
assert.deepEqual(
    coberturaParcial.detalle,
    [
        { set: 1, oficiales: 2, manuales: 0, manualCompleta: false },
        { set: 2, oficiales: 2, manuales: 2, manualCompleta: true }
    ]
);

const dashboardSource = readFileSync(
    fileURLToPath(new URL('../dashboard/js/dashboard.js', import.meta.url)),
    'utf8'
);
assert.equal(
    dashboardSource.match(/seleccionarPuntosParaRotaciones\(/g)?.length,
    2,
    'la tabla y el detalle de rotación deben usar la misma fuente oficial'
);
assert.match(
    dashboardSource,
    /this\.chartRotaciones\.destroy\(\);[\s\S]*this\.chartRotaciones = null;/,
    'al elegir un set inexistente debe eliminarse el gráfico anterior'
);

console.log('rotacionHelper: tests OK');
