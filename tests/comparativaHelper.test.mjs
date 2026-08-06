import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dashboard/js/comparativaHelper.js', import.meta.url), 'utf8');
const helper = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const {
    calcularTendencias,
    crearReporteLegacy,
    extraerFechaReporte,
    generarConclusiones,
    prepararComparativa,
    reporteDesdeMetadata
} = helper;

assert.equal(
    extraerFechaReporte('reporte_VELEZ_2026-08-05T21-01-27.html', '5/8/2026, 18:01:27'),
    '2026-08-05T21:01:27.000Z',
    'la fecha ISO del nombre debe tener prioridad sobre la fecha localizada'
);
assert.match(
    extraerFechaReporte('', '4/8/2026, 22:53:26'),
    /^2026-08-04T22:53:26/,
    'DD/MM/YYYY no debe interpretarse como MM/DD/YYYY'
);

function legacy({
    archivo,
    home,
    away,
    estado = 'unknown',
    categoria = null,
    matchId = null,
    sideoutHome = 60,
    sideoutAway = 40
}) {
    const reporte = crearReporteLegacy({
        nombreArchivo: archivo,
        version: '3.0.4',
        esquema: 'standard-v1',
        homeTeam: home,
        awayTeam: away,
        estado,
        metrics: {
            sideoutHome,
            sideoutAway,
            breakpointHome: 35,
            breakpointAway: 30,
            clutchHome: 55,
            clutchAway: 45,
            serviceHome: -5,
            serviceAway: 10,
            efficiencyHome: 52,
            efficiencyAway: 48
        }
    });
    reporte.categoria = categoria;
    reporte.matchId = matchId;
    return reporte;
}

const primero = legacy({
    archivo: 'reporte_ACQUA_2026-08-01T20-00-00.html',
    home: 'ACQUA',
    away: 'CAIT',
    sideoutHome: 50
});
const segundo = legacy({
    archivo: 'reporte_RIVER_2026-08-03T20-00-00.html',
    home: 'RIVER',
    away: 'ACQUA',
    sideoutAway: 64
});
const parcial = legacy({
    archivo: 'reporte_ACQUA_2026-08-04T20-00-00.html',
    home: 'ACQUA',
    away: 'BOCA',
    estado: 'partial'
});
const comparativa = prepararComparativa([segundo, parcial, primero]);
assert.equal(comparativa.ok, true);
assert.equal(comparativa.equipoNombre, 'ACQUA');
assert.equal(comparativa.serie.length, 2, 'los partidos parciales deben excluirse');
assert.equal(comparativa.serie[0].rival, 'CAIT');
assert.equal(comparativa.serie[1].lado, 'away', 'el equipo debe seguirse aunque sea visitante');
assert.equal(comparativa.serie[1].metricas.sideout, 64);

const sinComun = prepararComparativa([
    primero,
    legacy({ archivo: 'reporte_X_2026-08-05T20-00-00.html', home: 'BOCA', away: 'RIVER' })
]);
assert.equal(sinComun.codigo, 'no-common-team');

const mismoCruce = [
    legacy({ archivo: 'reporte_AB_2026-08-01T20-00-00.html', home: 'A', away: 'B' }),
    legacy({ archivo: 'reporte_AB_2026-08-02T20-00-00.html', home: 'A', away: 'B' })
];
assert.equal(prepararComparativa(mismoCruce).codigo, 'team-required');
assert.equal(prepararComparativa(mismoCruce, 'B').serie[0].lado, 'away');

const categoriasDistintas = prepararComparativa([
    legacy({ archivo: 'reporte_1_2026-08-01T20-00-00.html', home: 'ACQUA', away: 'A', categoria: 'sub_14' }),
    legacy({ archivo: 'reporte_2_2026-08-02T20-00-00.html', home: 'ACQUA', away: 'B', categoria: 'sub_16' })
]);
assert.equal(categoriasDistintas.codigo, 'category-mismatch');

const duplicadoViejo = legacy({ archivo: 'reporte_1_2026-08-01T20-00-00.html', home: 'ACQUA', away: 'A', matchId: 123 });
const duplicadoNuevo = legacy({ archivo: 'reporte_1_2026-08-02T20-00-00.html', home: 'ACQUA', away: 'A', matchId: 123 });
const otro = legacy({ archivo: 'reporte_2_2026-08-03T20-00-00.html', home: 'ACQUA', away: 'B', matchId: 456 });
assert.equal(prepararComparativa([duplicadoViejo, duplicadoNuevo, otro]).serie.length, 2, 'un partido repetido debe contarse una sola vez');

const metadata = reporteDesdeMetadata({
    type: 'voleyinsight-report',
    schema: 'comparison-v1',
    version: '3.0.5',
    generatedAt: '2026-08-06T18:30:00.000Z',
    matchId: 999,
    category: 'sub_14',
    status: 'final',
    teams: { home: 'GEBA', away: 'SGREGOR' },
    score: { homeSets: 2, awaySets: 0 },
    metrics: {
        home: { sideout: { percentage: 62, successes: 31, attempts: 50 }, service: { percentage: -4 } },
        away: { sideout: { percentage: 51 }, service: { percentage: 7 } }
    }
}, 'reporte_GEBA.html');
assert.equal(metadata.metricasCompatibles, true);
assert.equal(metadata.metrics.home.sideout, 62);
assert.equal(metadata.metrics.home.service, -4, 'una eficiencia negativa no debe convertirse en cero');
assert.deepEqual(metadata.metrics.home.muestras.sideout, { intentos: 50, exitos: 31 });

const sinDato = crearReporteLegacy({
    esquema: 'standard-v1', homeTeam: 'A', awayTeam: 'B', metrics: { sideoutHome: '' }
});
assert.equal(sinDato.metrics.home.sideout, null, 'un dato ausente debe seguir ausente');

const tendencias = calcularTendencias(comparativa.serie);
const sideout = tendencias.find(tendencia => tendencia.clave === 'sideout');
assert.equal(sideout.delta, 14);
assert.equal(sideout.estado, 'improved');
assert.ok(generarConclusiones(tendencias, 3).length <= 3);

console.log('comparativaHelper: tests OK');
