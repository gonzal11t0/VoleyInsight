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
    reconstruirFormacionInicial
} = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString('base64')}`);

const fixtureUrl = new URL('./fixtures/rotaciones_258880.json', import.meta.url);
const puntos = JSON.parse(readFileSync(fileURLToPath(fixtureUrl), 'utf8'));

assert.equal(puntos.length, 33, 'el caso real debe contener los 33 puntos anotados');

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

console.log('rotacionHelper: tests OK');
