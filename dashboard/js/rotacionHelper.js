const EQUIPOS_VALIDOS = new Set(['LOCAL', 'VISITANTE']);

export function normalizarEquipo(equipo) {
    return EQUIPOS_VALIDOS.has(equipo) ? equipo : 'LOCAL';
}

export function calcularRotacionesPorEquipo(puntos, equipo = 'LOCAL') {
    const equipoAnalizado = normalizarEquipo(equipo);
    const campoRotacion = equipoAnalizado === 'LOCAL'
        ? 'rotacionLocal'
        : 'rotacionVisitante';

    const rotaciones = {};
    for (let numero = 1; numero <= 6; numero++) {
        rotaciones[numero] = {
            puntosAFavor: 0,
            puntosEnContra: 0,
            totalPuntos: 0,
            diferencia: 0,
            eficiencia: 0
        };
    }

    for (const punto of Array.isArray(puntos) ? puntos : []) {
        const rotacion = Number(punto?.[campoRotacion]);
        if (!Number.isInteger(rotacion) || rotacion < 1 || rotacion > 6) continue;
        if (!EQUIPOS_VALIDOS.has(punto?.equipoAnota)) continue;

        const resumen = rotaciones[rotacion];
        if (punto.equipoAnota === equipoAnalizado) {
            resumen.puntosAFavor++;
        } else {
            resumen.puntosEnContra++;
        }
        resumen.totalPuntos++;
    }

    for (const resumen of Object.values(rotaciones)) {
        resumen.diferencia = resumen.puntosAFavor - resumen.puntosEnContra;
        resumen.eficiencia = resumen.totalPuntos > 0
            ? Number(((resumen.puntosAFavor / resumen.totalPuntos) * 100).toFixed(1))
            : 0;
    }

    return rotaciones;
}

export function obtenerStatsRotacion(puntos, equipo, rotacion) {
    const numero = Number(rotacion);
    if (!Number.isInteger(numero) || numero < 1 || numero > 6) return null;

    const resumen = calcularRotacionesPorEquipo(puntos, equipo)[numero];
    if (!resumen || resumen.totalPuntos === 0) return null;

    let estado = '⚖️ NEUTRA';
    if (resumen.eficiencia > 60) estado = '✅ FUERTE';
    else if (resumen.eficiencia < 40) estado = '❌ DÉBIL';

    return { ...resumen, estado };
}

export function rotarFormacion(formacionInicial, rotacion = 1) {
    const jugadores = Array.isArray(formacionInicial)
        ? formacionInicial
            .filter(jugador => Number(jugador?.posicion) >= 1 && Number(jugador?.posicion) <= 6)
            .map(jugador => ({ ...jugador, posicion: Number(jugador.posicion) }))
        : [];

    if (jugadores.length !== 6) return [];

    const pasos = ((Number(rotacion) || 1) - 1) % 6;
    return jugadores
        .map(jugador => {
            let posicion = jugador.posicion;
            for (let i = 0; i < pasos; i++) {
                posicion = posicion === 1 ? 6 : posicion - 1;
            }
            return { ...jugador, posicion };
        })
        .sort((a, b) => a.posicion - b.posicion);
}

export function reconstruirFormacionInicial(formacionActual, rotacionActual = 1) {
    const jugadores = Array.isArray(formacionActual)
        ? formacionActual
            .filter(jugador => Number(jugador?.posicion) >= 1 && Number(jugador?.posicion) <= 6)
            .map(jugador => ({ ...jugador, posicion: Number(jugador.posicion) }))
        : [];

    if (jugadores.length !== 6) return [];

    const pasos = ((Number(rotacionActual) || 1) - 1) % 6;
    return jugadores
        .map(jugador => ({
            ...jugador,
            posicion: ((jugador.posicion - 1 + pasos) % 6) + 1
        }))
        .sort((a, b) => a.posicion - b.posicion);
}
