import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dashboard/js/metricasVoleyHelper.js', import.meta.url), 'utf8');
const { calcularMetricasRally, eventoEstandar } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

const puntos = [
    { scorer: 'HOME', servingBefore: 'HOME', set: 1 },
    { scorer: 'AWAY', servingBefore: 'HOME', set: 1 },
    { scorer: 'AWAY', servingBefore: 'AWAY', set: 1 },
    { equipoAnota: 'LOCAL', equipoSacaba: 'VISITANTE', set: 1 }
];

const metricas = calcularMetricasRally(puntos);
assert.deepEqual(metricas.equipos.HOME.sideout, { exitos: 1, oportunidades: 2, porcentaje: 50 });
assert.deepEqual(metricas.equipos.HOME.breakpoint, { exitos: 1, oportunidades: 2, porcentaje: 50 });
assert.deepEqual(metricas.equipos.AWAY.sideout, { exitos: 1, oportunidades: 2, porcentaje: 50 });
assert.deepEqual(metricas.equipos.AWAY.breakpoint, { exitos: 1, oportunidades: 2, porcentaje: 50 });
assert.equal(metricas.breakpoints.length, 2);
assert.equal(eventoEstandar(puntos[0]), 'BREAK_HOME');
assert.equal(eventoEstandar(puntos[1]), 'SIDEOUT_AWAY');

console.log('metricasVoleyHelper: tests OK');
