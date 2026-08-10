import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dashboard/js/metricasVoleyHelper.js', import.meta.url), 'utf8');
const { calcularMetricasRally, eventoEstandar, resumirUltimosPuntos } = await import(
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

const diezPuntosConRegistroIntermedio = [
    { scorer: 'HOME' },
    { scorer: 'AWAY' },
    { scorer: 'HOME' },
    { scorer: 'HOME' },
    { scorer: 'AWAY' },
    { scorer: 'HOME' },
    { scorer: 'AWAY' },
    { scorer: 'HOME' },
    { scorer: 'AWAY' },
    { scorer: 'HOME' },
    { set: 2, homeScore: 0, awayScore: 0 }
];
const ultimos = resumirUltimosPuntos(diezPuntosConRegistroIntermedio, 10);
assert.deepEqual(
    ultimos,
    { total: 10, home: 6, away: 4 },
    'un registro sin anotador no debe desplazar uno de los últimos diez puntos reales'
);

const conNombresAlternativos = resumirUltimosPuntos([
    { equipoAnota: 'LOCAL' },
    { equipoAnota: 'VISITANTE' }
], 10);
assert.deepEqual(conNombresAlternativos, { total: 2, home: 1, away: 1 });

const dashboardSource = await readFile(new URL('../dashboard/js/dashboard.js', import.meta.url), 'utf8');
assert.equal(
    dashboardSource.match(/resumirUltimosPuntos\(this\.data, 10\)/g)?.length,
    2,
    'el dashboard y el informe deben compartir el conteo de últimos puntos reales'
);
assert.doesNotMatch(
    dashboardSource,
    /this\.data\.slice\(-10\)\.filter\(s => s\.scorer\)/,
    'no se debe cortar la lista antes de descartar registros que no son puntos'
);

console.log('metricasVoleyHelper: tests OK');
