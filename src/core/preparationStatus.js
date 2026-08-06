function normalizarMatchId(value) {
    const matchId = Number(value);
    return Number.isInteger(matchId) && matchId > 0 ? matchId : null;
}

function obtenerCancha(data = {}) {
    return data?.court || data?.liveState?.court || null;
}

function contarPosiciones(side) {
    return Object.keys(side?.positions || {}).filter(position => {
        const number = Number(position);
        return number >= 1 && number <= 6 && side.positions[position];
    }).length;
}

function obtenerEstadoCancha(data = {}) {
    const court = obtenerCancha(data);
    const local = contarPosiciones(court?.home);
    const visitante = contarPosiciones(court?.away);
    return {
        disponible: Boolean(court),
        local,
        visitante,
        completa: local === 6 && visitante === 6
    };
}

function obtenerEquipos(data = {}, respaldo = {}) {
    const homeTeam = data?.match?.homeTeam?.name
        || data?.homeTeam?.name
        || respaldo.homeTeam
        || null;
    const awayTeam = data?.match?.awayTeam?.name
        || data?.awayTeam?.name
        || respaldo.awayTeam
        || null;
    return { homeTeam, awayTeam };
}

function evaluarPreparacion({
    datosMetro = null,
    fullExiste = false,
    antiguedadFullMs = null,
    trackerStatus = null,
    ahoraMs = Date.now()
} = {}) {
    const cancha = obtenerEstadoCancha(datosMetro || {});
    const fullReciente = fullExiste
        && Number.isFinite(antiguedadFullMs)
        && antiguedadFullMs <= 20_000;
    const fullDemorado = fullExiste
        && Number.isFinite(antiguedadFullMs)
        && antiguedadFullMs > 20_000
        && antiguedadFullMs <= 120_000;
    const trackerReconectando = trackerStatus?.status === 'reconnecting';

    let tracker;
    if (trackerReconectando) {
        tracker = {
            estado: 'error',
            titulo: 'Tracker reconectando',
            detalle: `Reintento en ${trackerStatus.nextRetrySeconds || '?'} segundos.`
        };
    } else if (fullReciente) {
        tracker = {
            estado: 'ok',
            titulo: 'Tracker activo',
            detalle: 'Metro Vóley está actualizando los datos.'
        };
    } else if (fullDemorado) {
        tracker = {
            estado: 'espera',
            titulo: 'Tracker demorado',
            detalle: 'La última actualización tardó más de lo habitual.'
        };
    } else if (fullExiste) {
        tracker = {
            estado: 'error',
            titulo: 'Tracker sin actividad reciente',
            detalle: 'Revisá que la ventana del tracker siga abierta.'
        };
    } else {
        tracker = {
            estado: 'espera',
            titulo: 'Tracker esperando datos',
            detalle: 'Todavía no se creó información para este partido.'
        };
    }

    let formacion;
    if (cancha.completa) {
        formacion = {
            estado: 'ok',
            titulo: 'Formación disponible',
            detalle: 'Metro publicó las dos canchas completas.'
        };
    } else if (cancha.disponible) {
        formacion = {
            estado: 'espera',
            titulo: 'Formación incompleta',
            detalle: `Metro publicó ${cancha.local}/6 local y ${cancha.visitante}/6 visitante.`
        };
    } else {
        formacion = {
            estado: 'espera',
            titulo: 'Formación pendiente',
            detalle: 'Es normal antes del comienzo del partido.'
        };
    }

    const nivel = cancha.completa && fullReciente
        ? 'ready'
        : tracker.estado === 'error'
            ? 'warning'
            : 'waiting';

    return {
        nivel,
        puedeIngresar: true,
        tracker,
        formacion,
        cancha,
        comprobadoEn: new Date(ahoraMs).toISOString()
    };
}

module.exports = {
    normalizarMatchId,
    obtenerCancha,
    obtenerEstadoCancha,
    obtenerEquipos,
    evaluarPreparacion
};
