import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);

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

const statsConNombre = statsHelper.calcularStatsPorJugador([
    { equipo: 'LOCAL', jugador: 9, jugadorNombre: 'Malena Ferreyra', accion: 'ATAQUE' }
], 'LOCAL');
assert.equal(statsConNombre[9].jugadorNombre, 'Malena Ferreyra');
assert.match(
    statsHelper.generarTablaHTMLSimple(statsConNombre, {}),
    /Malena Ferreyra/,
    'el informe debe conservar el nombre incluido en la anotación aunque no exista la caché del plantel'
);

const nombresReconstruidos = statsHelper.fusionarNombresJugadores({}, {}, [
    { equipo: 'LOCAL', jugador: 9, jugadorNombre: 'Malena Ferreyra' },
    { equipo: 'VISITANTE', jugador: 12 }
]);
assert.equal(nombresReconstruidos.local[9], 'Malena Ferreyra');
assert.equal(nombresReconstruidos.visitante[12], 'Jugador #12');

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
    resumenVisitante: { puntosEquipo: 20, puntosAtribuidos: 18, sinAtribuir: 2 },
    coberturaAnalisis: {
        setsOficiales: [1, 2],
        setsManuales: [2],
        puntosOficiales: 84,
        puntosManuales: 42,
        detalle: [
            { set: 1, oficiales: 42, manuales: 0, manualCompleta: false },
            { set: 2, oficiales: 42, manuales: 42, manualCompleta: true }
        ]
    },
    reportMetadata: {
        generatedAt: '2026-08-06T18:30:00.000Z',
        matchId: 230512,
        category: 'sub_14',
        status: 'final',
        homeSets: 2,
        awaySets: 0,
        sets: [{ number: 1, home: 25, away: 20, status: 'final' }],
        coverage: {
            setsOficiales: [1, 2],
            setsManuales: [2],
            puntosOficiales: 84,
            puntosManuales: 42,
            detalle: [
                { set: 1, oficiales: 42, manuales: 0, manualCompleta: false },
                { set: 2, oficiales: 42, manuales: 42, manualCompleta: true }
            ]
        },
        metrics: {
            home: { sideout: { percentage: 62, successes: 13, attempts: 21 } },
            away: { sideout: { percentage: 58, successes: 11, attempts: 19 } }
        }
    }
});
assert.match(html, /data-metric-schema="standard-v1"/);
assert.match(html, /data-sideout-home="62"/);
assert.match(html, /id="voleyInsightReportData"/);
assert.match(html, /ESTADÍSTICAS INDIVIDUALES POR SET/);
assert.match(html, /Cobertura del análisis/);
assert.match(html, /Métricas generales y rotaciones: Set 1, Set 2 \(datos oficiales de Metro\)/);
assert.match(html, /Acciones, individuales y servicio: Set 2: 42 de 42 puntos/);
assert.match(html, /ESTADÍSTICAS INDIVIDUALES \(Sets analizados: 2\)/);
assert.match(html, /Equipo: 25 · Atribuidos a jugadoras\/es: 20 · Sin atribuir: 5/);
assert.doesNotMatch(html, /Puntos que convertís cuando tenés el saque/);

const metadataMatch = html.match(/<script id="voleyInsightReportData" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(metadataMatch, 'el informe debe incluir metadatos estables para comparación');
const metadata = JSON.parse(metadataMatch[1]);
assert.equal(metadata.schema, 'comparison-v1');
assert.equal(metadata.version, '3.0.6');
assert.equal(metadata.status, 'final');
assert.equal(metadata.matchId, 230512);
assert.equal(metadata.category, 'sub_14');
assert.equal(metadata.metrics.home.sideout.percentage, 62);
assert.equal(metadata.metrics.home.sideout.attempts, 21);
assert.deepEqual(metadata.coverage.setsManuales, [2]);

const DataRepository = require('../src/repositories/dataRepository.js');
assert.equal(
    DataRepository.contarPuntosReales([
        { set: 1, homeScore: 0, awayScore: 0 },
        { set: 1, scorer: 'HOME' },
        { set: 1, scorer: 'AWAY' },
        { set: 2, homeScore: 0, awayScore: 0 }
    ]),
    2,
    'analysis.json debe contar rallies, no snapshots iniciales 0-0'
);

const {
    fusionarPlanteles,
    plantelDesdePuntos
} = require('../src/core/rosterHistory.js');
const plantelHistorico = fusionarPlanteles(
    { local: { 9: 'Jugador #9' }, visitante: {} },
    plantelDesdePuntos([
        { equipo: 'LOCAL', jugador: 9, jugadorNombre: 'Malena Ferreyra' },
        { equipo: 'VISITANTE', jugador: 12 }
    ])
);
assert.equal(plantelHistorico.local[9], 'Malena Ferreyra');
assert.equal(plantelHistorico.visitante[12], 'Jugador #12');

const comparativaHelper = await cargarModulo('../dashboard/js/comparativaHelper.js');
const reporteComparable = comparativaHelper.reporteDesdeMetadata(metadata, 'reporte_LOCAL_2026-08-06T18-30-00.html');
assert.equal(reporteComparable.metricasCompatibles, true);
assert.equal(reporteComparable.estado, 'final');
assert.equal(reporteComparable.metrics.home.sideout, 62);

console.log('reportConsistency: tests OK');
