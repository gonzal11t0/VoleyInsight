import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function cargarModulo(ruta) {
    const source = await readFile(new URL(ruta, import.meta.url), 'utf8');
    return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const statsHelper = await cargarModulo('../dashboard/js/StatsHelper.js');
const stats = statsHelper.calcularStatsPorJugador([
    { equipo: 'LOCAL', jugador: 7, accion: 'ATAQUE' },
    { equipo: 'LOCAL', jugador: 7, accion: 'ERROR' },
    { equipo: 'LOCAL', jugador: 7, accion: 'ERROR_SAQUE' }
], 'LOCAL');
assert.equal(stats[7].puntos, 1);
assert.equal(stats[7].erroresAtaque, 1);
assert.equal(stats[7].erroresServicio, 1, 'solo ERROR_SAQUE debe contar como error de servicio');
assert.equal(stats[7].totalSaques, 1);
assert.equal(stats[7].eficienciaAtaque, '0.0', 'la eficiencia debe descontar el error de ataque');

const servicio = statsHelper.calcularEstadisticasServicio([
    { scorer: 'HOME', servingBefore: 'HOME' },
    { scorer: 'AWAY', servingBefore: 'HOME' },
    { scorer: 'AWAY', servingBefore: 'AWAY' }
], [
    { equipo: 'LOCAL', accion: 'ACE' },
    { equipo: 'LOCAL', accion: 'ERROR' },
    { equipo: 'VISITANTE', accion: 'ERROR_SAQUE' }
]);
assert.equal(servicio.home.totalSaques, 2);
assert.equal(servicio.home.aces, 1);
assert.equal(servicio.home.errores, 0);
assert.equal(servicio.away.totalSaques, 1);
assert.equal(servicio.away.errores, 1);

const { ReporteGenerator } = await cargarModulo('../dashboard/js/reporteGenerator.js');
const html = ReporteGenerator.generarHTML({
    homeTeam: 'LOCAL', awayTeam: 'VISITA', homeScore: 25, awayScore: 20,
    fechaHora: '03/08/2026', homeEfficiency: 55.6, awayEfficiency: 44.4,
    maxHomeRun: 4, maxAwayRun: 3, homeBreaks: 8, awayBreaks: 6,
    totalPoints: 45, homeClutchPct: 60, homePhaseEff: {}, awayPhaseEff: {},
    setsHtml: '', sideoutHome: 62, sideoutAway: 58,
    breakpointHome: 38, breakpointAway: 42,
    serviceEfficiencyHome: 10, serviceEfficiencyAway: -5,
    localPorSet: { 1: '<tr><td>L1</td></tr>' },
    visitantePorSet: { 1: '<tr><td>V1</td></tr>' },
    resumenLocal: { puntosEquipo: 25, puntosAtribuidos: 20, sinAtribuir: 5 },
    resumenVisitante: { puntosEquipo: 20, puntosAtribuidos: 18, sinAtribuir: 2 }
});
assert.match(html, /data-metric-schema="standard-v1"/);
assert.match(html, /data-sideout-home="62"/);
assert.match(html, /ESTADÍSTICAS INDIVIDUALES POR SET/);
assert.match(html, /Equipo: 25 · Atribuidos a jugadoras\/es: 20 · Sin atribuir: 5/);
assert.doesNotMatch(html, /Puntos que convertís cuando tenés el saque/);

console.log('reportConsistency: tests OK');
