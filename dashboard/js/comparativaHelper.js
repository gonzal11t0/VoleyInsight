const METRICAS = [
    { clave: 'sideout', etiqueta: 'Sideout%' },
    { clave: 'breakpoint', etiqueta: 'Breakpoint%' },
    { clave: 'clutch', etiqueta: 'Bajo presión' },
    { clave: 'service', etiqueta: 'Eficiencia de servicio' },
    { clave: 'efficiency', etiqueta: 'Puntos ganados' }
];

export function numeroONull(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
}

export function normalizarNombreEquipo(nombre) {
    return String(nombre || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

function fechaVisibleAISO(fechaVisible) {
    const match = String(fechaVisible || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (!match) return null;
    const [, dia, mes, anio, hora = '00', minuto = '00', segundo = '00'] = match;
    return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T${String(hora).padStart(2, '0')}:${minuto}:${segundo}`;
}

export function extraerFechaReporte(nombreArchivo, fechaVisible, fechaMetadata) {
    if (fechaMetadata && Number.isFinite(Date.parse(fechaMetadata))) {
        return new Date(fechaMetadata).toISOString();
    }
    const archivo = String(nombreArchivo || '').match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (archivo) return `${archivo[1]}T${archivo[2]}:${archivo[3]}:${archivo[4]}.000Z`;
    const visibleISO = fechaVisibleAISO(fechaVisible);
    return visibleISO && Number.isFinite(Date.parse(visibleISO)) ? visibleISO : null;
}

function valorMetrica(valor) {
    if (valor && typeof valor === 'object') {
        return numeroONull(valor.percentage ?? valor.porcentaje ?? valor.value ?? valor.eficiencia);
    }
    return numeroONull(valor);
}

function muestrasMetrica(valor) {
    if (!valor || typeof valor !== 'object') return null;
    const intentos = numeroONull(valor.attempts ?? valor.oportunidades ?? valor.total);
    const exitos = numeroONull(valor.successes ?? valor.exitos ?? valor.aces);
    return intentos === null && exitos === null ? null : { intentos, exitos };
}

function metricasDesdeMetadata(metricas = {}) {
    return {
        sideout: valorMetrica(metricas.sideout),
        breakpoint: valorMetrica(metricas.breakpoint),
        clutch: valorMetrica(metricas.clutch),
        service: valorMetrica(metricas.service),
        efficiency: valorMetrica(metricas.efficiency),
        muestras: {
            sideout: muestrasMetrica(metricas.sideout),
            breakpoint: muestrasMetrica(metricas.breakpoint),
            clutch: muestrasMetrica(metricas.clutch),
            service: muestrasMetrica(metricas.service)
        }
    };
}

export function reporteDesdeMetadata(metadata, nombreArchivo = '') {
    if (!metadata || metadata.type !== 'voleyinsight-report') return null;
    const homeTeam = String(metadata.teams?.home || '').trim();
    const awayTeam = String(metadata.teams?.away || '').trim();
    if (!homeTeam || !awayTeam) return null;
    const homeSets = numeroONull(metadata.score?.homeSets);
    const awaySets = numeroONull(metadata.score?.awaySets);
    const resultado = homeSets !== null && awaySets !== null
        ? `${homeSets}-${awaySets} sets`
        : `${metadata.score?.home ?? 0}-${metadata.score?.away ?? 0}`;
    return {
        nombreArchivo,
        version: String(metadata.version || ''),
        esquema: String(metadata.schema || ''),
        metricasCompatibles: metadata.schema === 'comparison-v1',
        homeTeam,
        awayTeam,
        nombrePartido: `${homeTeam} vs ${awayTeam}`,
        matchId: numeroONull(metadata.matchId),
        categoria: metadata.category || null,
        fecha: metadata.displayDate || '',
        generatedAt: extraerFechaReporte(nombreArchivo, metadata.displayDate, metadata.generatedAt),
        estado: ['final', 'partial'].includes(metadata.status) ? metadata.status : 'unknown',
        resultado,
        metrics: {
            home: metricasDesdeMetadata(metadata.metrics?.home),
            away: metricasDesdeMetadata(metadata.metrics?.away)
        }
    };
}

export function crearReporteLegacy({
    nombreArchivo = '',
    version = '',
    esquema = '',
    homeTeam = '',
    awayTeam = '',
    fecha = '',
    estado = 'unknown',
    resultado = '',
    metrics = {}
} = {}) {
    return {
        nombreArchivo,
        version,
        esquema,
        metricasCompatibles: esquema === 'standard-v1',
        homeTeam: String(homeTeam).trim(),
        awayTeam: String(awayTeam).trim(),
        nombrePartido: `${String(homeTeam).trim() || 'LOCAL'} vs ${String(awayTeam).trim() || 'VISITANTE'}`,
        matchId: null,
        categoria: null,
        fecha,
        generatedAt: extraerFechaReporte(nombreArchivo, fecha, null),
        estado,
        resultado,
        metrics: {
            home: {
                sideout: numeroONull(metrics.sideoutHome),
                breakpoint: numeroONull(metrics.breakpointHome),
                clutch: numeroONull(metrics.clutchHome),
                service: numeroONull(metrics.serviceHome),
                efficiency: numeroONull(metrics.efficiencyHome),
                muestras: {}
            },
            away: {
                sideout: numeroONull(metrics.sideoutAway),
                breakpoint: numeroONull(metrics.breakpointAway),
                clutch: numeroONull(metrics.clutchAway),
                service: numeroONull(metrics.serviceAway),
                efficiency: numeroONull(metrics.efficiencyAway),
                muestras: {}
            }
        }
    };
}

export function detectarEquiposComunes(reportes) {
    const elegibles = reportes.filter(reporte => reporte.metricasCompatibles && reporte.estado !== 'partial');
    if (!elegibles.length) return [];
    let comunes = new Set([
        normalizarNombreEquipo(elegibles[0].homeTeam),
        normalizarNombreEquipo(elegibles[0].awayTeam)
    ].filter(Boolean));
    for (const reporte of elegibles.slice(1)) {
        const equipos = new Set([
            normalizarNombreEquipo(reporte.homeTeam),
            normalizarNombreEquipo(reporte.awayTeam)
        ].filter(Boolean));
        comunes = new Set([...comunes].filter(equipo => equipos.has(equipo)));
    }
    return [...comunes];
}

function claveReporte(reporte) {
    if (reporte.matchId) return `match:${reporte.matchId}`;
    return [
        normalizarNombreEquipo(reporte.homeTeam),
        normalizarNombreEquipo(reporte.awayTeam),
        reporte.generatedAt || reporte.nombreArchivo
    ].join('|');
}

function deduplicarReportes(reportes) {
    const unicos = new Map();
    reportes.forEach(reporte => {
        const clave = claveReporte(reporte);
        const anterior = unicos.get(clave);
        if (!anterior || Date.parse(reporte.generatedAt || 0) >= Date.parse(anterior.generatedAt || 0)) {
            unicos.set(clave, reporte);
        }
    });
    return [...unicos.values()];
}

function orientarReporte(reporte, equipoNormalizado) {
    const homeNormalizado = normalizarNombreEquipo(reporte.homeTeam);
    const lado = homeNormalizado === equipoNormalizado ? 'home' : 'away';
    const rival = lado === 'home' ? reporte.awayTeam : reporte.homeTeam;
    return {
        ...reporte,
        equipo: lado === 'home' ? reporte.homeTeam : reporte.awayTeam,
        rival,
        lado,
        metricas: reporte.metrics?.[lado] || {},
        etiqueta: rival ? `vs ${rival}` : reporte.nombrePartido
    };
}

export function prepararComparativa(reportes, equipoPreferido = null) {
    const descartados = reportes.filter(reporte => !reporte.metricasCompatibles || reporte.estado === 'partial');
    const elegibles = deduplicarReportes(
        reportes.filter(reporte => reporte.metricasCompatibles && reporte.estado !== 'partial')
    );
    if (elegibles.length < 2) {
        return {
            ok: false,
            codigo: 'insufficient',
            mensaje: 'Necesitás al menos dos informes completos y compatibles.',
            descartados,
            equiposComunes: detectarEquiposComunes(elegibles)
        };
    }
    const equiposComunes = detectarEquiposComunes(elegibles);
    if (!equiposComunes.length) {
        return {
            ok: false,
            codigo: 'no-common-team',
            mensaje: 'Los informes no tienen un equipo en común.',
            descartados,
            equiposComunes
        };
    }
    const preferido = normalizarNombreEquipo(equipoPreferido);
    const equipo = equiposComunes.includes(preferido)
        ? preferido
        : equiposComunes.length === 1
            ? equiposComunes[0]
            : null;
    if (!equipo) {
        return {
            ok: false,
            codigo: 'team-required',
            mensaje: 'Elegí cuál de los dos equipos querés comparar.',
            descartados,
            equiposComunes
        };
    }
    const categorias = [...new Set(elegibles.map(reporte => reporte.categoria).filter(Boolean))];
    if (categorias.length > 1) {
        return {
            ok: false,
            codigo: 'category-mismatch',
            mensaje: `Hay categorías diferentes: ${categorias.join(', ')}.`,
            descartados,
            equiposComunes
        };
    }
    const serie = elegibles
        .map(reporte => orientarReporte(reporte, equipo))
        .sort((a, b) => {
            const fechaA = Date.parse(a.generatedAt || '');
            const fechaB = Date.parse(b.generatedAt || '');
            if (Number.isFinite(fechaA) && Number.isFinite(fechaB)) return fechaA - fechaB;
            if (Number.isFinite(fechaA)) return -1;
            if (Number.isFinite(fechaB)) return 1;
            return 0;
        });
    const advertencias = [];
    if (serie.some(reporte => reporte.estado === 'unknown')) {
        advertencias.push('Algunos informes anteriores no permiten confirmar si el partido había finalizado.');
    }
    if (serie.some(reporte => !reporte.categoria)) {
        advertencias.push('Algunos informes anteriores no incluyen categoría.');
    }
    return {
        ok: true,
        serie,
        equipo,
        equipoNombre: serie[0].equipo,
        categoria: categorias[0] || null,
        descartados,
        equiposComunes,
        advertencias
    };
}

export function calcularTendencias(serie) {
    if (!Array.isArray(serie) || serie.length < 2) return [];
    const primero = serie[0];
    const ultimo = serie[serie.length - 1];
    return METRICAS.map(({ clave, etiqueta }) => {
        const inicial = numeroONull(primero.metricas?.[clave]);
        const final = numeroONull(ultimo.metricas?.[clave]);
        if (inicial === null || final === null) {
            return { clave, etiqueta, inicial, final, delta: null, estado: 'unavailable' };
        }
        const delta = Number((final - inicial).toFixed(1));
        const estado = delta > 2 ? 'improved' : delta < -2 ? 'worsened' : 'stable';
        return { clave, etiqueta, inicial, final, delta, estado };
    });
}

export function generarConclusiones(tendencias, limite = 3) {
    const disponibles = tendencias.filter(tendencia => tendencia.delta !== null);
    const relevantes = [...disponibles].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const conclusiones = relevantes.slice(0, limite).map(tendencia => {
        if (tendencia.estado === 'improved') {
            return { tipo: 'mejora', texto: `${tendencia.etiqueta} mejoró ${Math.abs(tendencia.delta)} puntos (${tendencia.inicial}% → ${tendencia.final}%).` };
        }
        if (tendencia.estado === 'worsened') {
            return { tipo: 'revisar', texto: `${tendencia.etiqueta} bajó ${Math.abs(tendencia.delta)} puntos (${tendencia.inicial}% → ${tendencia.final}%).` };
        }
        return { tipo: 'estable', texto: `${tendencia.etiqueta} se mantuvo estable (${tendencia.inicial}% → ${tendencia.final}%).` };
    });
    return conclusiones.length
        ? conclusiones
        : [{ tipo: 'estable', texto: 'No hay suficientes métricas comparables.' }];
}

export { METRICAS };
