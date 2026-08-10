function normalizarMatchId(value) {
    const matchId = Number(value);
    return Number.isInteger(matchId) && matchId > 0 ? matchId : null;
}

function normalizarNombreEquipo(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizarPartidoConfigurado(partido = {}) {
    const id = normalizarMatchId(partido?.id ?? partido?.matchId);
    if (!id) return null;
    return {
        ...partido,
        id
    };
}

function obtenerPartidosConfigurados(config = {}) {
    if (!Array.isArray(config?.partidos)) return [];
    return config.partidos
        .map(normalizarPartidoConfigurado)
        .filter(Boolean);
}

function buscarPartidoConfigurado(config = {}, matchId) {
    const id = normalizarMatchId(matchId);
    if (!id) return null;
    const partidos = obtenerPartidosConfigurados(config);
    for (let indice = partidos.length - 1; indice >= 0; indice -= 1) {
        if (partidos[indice].id === id) return partidos[indice];
    }
    return null;
}

function obtenerRespaldoPartido(config = {}, matchId) {
    const id = normalizarMatchId(matchId);
    if (!id) return {};

    // Los campos principales son la fuente de verdad del partido activo.
    if (normalizarMatchId(config?.matchId) === id) {
        return {
            id,
            homeTeam: config.homeTeam,
            awayTeam: config.awayTeam,
            categoria: config.categoria,
            metroStatus: config.metroStatus
        };
    }

    return buscarPartidoConfigurado(config, id) || { id };
}

function actualizarHistorialPartidos(partidos = [], partidoActualizado = {}) {
    const actualizado = normalizarPartidoConfigurado(partidoActualizado);
    if (!actualizado) return Array.isArray(partidos) ? partidos : [];
    const anteriores = obtenerPartidosConfigurados({ partidos })
        .filter(partido => partido.id !== actualizado.id);
    return [...anteriores, actualizado];
}

function obtenerClavesCategorias(categoriasPermitidas = []) {
    if (Array.isArray(categoriasPermitidas)) return categoriasPermitidas;
    if (categoriasPermitidas && typeof categoriasPermitidas === 'object') {
        return Object.keys(categoriasPermitidas);
    }
    return [];
}

function validarConfiguracionPendiente({
    matchId,
    homeTeam,
    awayTeam,
    categoria,
    categoriasPermitidas = []
} = {}) {
    const id = normalizarMatchId(matchId);
    const local = normalizarNombreEquipo(homeTeam);
    const visitante = normalizarNombreEquipo(awayTeam);
    const categoriaNormalizada = String(categoria || '').trim();
    const clavesCategorias = obtenerClavesCategorias(categoriasPermitidas);
    const errores = [];

    if (!id) errores.push('Ingresá un Match ID válido.');
    if (!local || local.toUpperCase() === 'LOCAL') {
        errores.push('Ingresá el nombre real del equipo local.');
    }
    if (!visitante || visitante.toUpperCase() === 'VISITANTE') {
        errores.push('Ingresá el nombre real del equipo visitante.');
    }
    if (local && visitante && local.localeCompare(visitante, 'es', { sensitivity: 'base' }) === 0) {
        errores.push('Los equipos local y visitante deben ser diferentes.');
    }
    if (!categoriaNormalizada) {
        errores.push('Seleccioná la categoría del partido.');
    } else if (clavesCategorias.length > 0 && !clavesCategorias.includes(categoriaNormalizada)) {
        errores.push(`La categoría "${categoriaNormalizada}" no está incluida en el reglamento.`);
    }

    return {
        valida: errores.length === 0,
        errores,
        matchId: id,
        homeTeam: local,
        awayTeam: visitante,
        categoria: categoriaNormalizada
    };
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
    pendienteMetro = false,
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
    if (pendienteMetro) {
        tracker = {
            estado: 'espera',
            titulo: 'Tracker esperando a Metro',
            detalle: 'El partido está preparado; todavía no hay datos oficiales en vivo.'
        };
    } else if (trackerReconectando) {
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
    normalizarNombreEquipo,
    normalizarPartidoConfigurado,
    obtenerPartidosConfigurados,
    buscarPartidoConfigurado,
    obtenerRespaldoPartido,
    actualizarHistorialPartidos,
    validarConfiguracionPendiente,
    obtenerCancha,
    obtenerEstadoCancha,
    obtenerEquipos,
    evaluarPreparacion
};
