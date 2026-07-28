export function findCourt(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.court) return obj.court;
    if (obj.liveState?.court) return obj.liveState.court;

    for (const value of Object.values(obj)) {
        if (value && typeof value === 'object') {
            const court = findCourt(value);
            if (court) return court;
        }
    }
    return null;
}

export function crearJugador(info, posicion) {
    const nombreCompleto = `${info.firstName || ''} ${info.lastName || ''}`.trim();
    const nombreCorto = info.lastName || `Jugador ${info.number}`;
    return {
        numero: info.number,
        nombre: nombreCompleto || `Jugador ${info.number}`,
        nombreCorto: nombreCorto.split(' ')[0] || nombreCorto,
        posicion: Number(posicion),
        isLibero: Boolean(info.isLibero),
        substitutedFor: info.substitutedFor || null
    };
}

export function normalizarPosiciones(equipoCourt) {
    if (!equipoCourt?.positions) return [];

    const posiciones = [];
    for (let posicion = 1; posicion <= 6; posicion++) {
        const info = equipoCourt.positions[String(posicion)] || equipoCourt.positions[posicion];
        if (info?.number) {
            posiciones.push(crearJugador(info, posicion));
        }
    }
    return posiciones;
}

export function obtenerFirmaFormacion(formacion) {
    const firmaEquipo = equipo => (formacion[equipo] || [])
        .map(jugador => `${jugador.posicion}:${jugador.numero}`)
        .join('|');
    return `${firmaEquipo('local')}//${firmaEquipo('visitante')}`;
}

export function ordenarJugadoresParaCancha(jugadores, equipo) {
    const porPosicion = new Map(
        (jugadores || []).map(jugador => [Number(jugador.posicion), jugador])
    );

    // La red está en el centro. El visitante se dibuja espejado para
    // que los dos equipos queden enfrentados como en una cancha real.
    const ordenColumnas = equipo === 'VISITANTE'
        ? [[2, 3, 4], [1, 6, 5]]
        : [[5, 6, 1], [4, 3, 2]];

    return ordenColumnas.map(columna =>
        columna.map(posicion => porPosicion.get(posicion)).filter(Boolean)
    );
}
