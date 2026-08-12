const EQUIPOS_VALIDOS = new Set(['LOCAL', 'VISITANTE']);

function esPuntoOficial(punto) {
    return punto?.scorer === 'HOME' || punto?.scorer === 'AWAY';
}

function esPuntoManual(punto) {
    return EQUIPOS_VALIDOS.has(punto?.equipoAnota);
}

function contarPuntosPorSet(puntos, esPunto) {
    const conteo = new Map();
    for (const punto of Array.isArray(puntos) ? puntos : []) {
        if (!esPunto(punto)) continue;
        const set = Number(punto?.set || 1);
        if (!Number.isInteger(set) || set < 1) continue;
        conteo.set(set, (conteo.get(set) || 0) + 1);
    }
    return conteo;
}

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

export function filtrarPuntosPorSet(puntos, setSeleccionado = 'all') {
    if (setSeleccionado === 'all' || setSeleccionado === null || setSeleccionado === undefined) {
        return Array.isArray(puntos) ? puntos : [];
    }
    const setNumero = Number(setSeleccionado);
    return (Array.isArray(puntos) ? puntos : []).filter(punto => Number(punto?.set || 1) === setNumero);
}

export function obtenerCoberturaAnalisis(puntosOficiales, puntosManuales) {
    const oficialesPorSet = contarPuntosPorSet(puntosOficiales, esPuntoOficial);
    const manualesPorSet = contarPuntosPorSet(puntosManuales, esPuntoManual);
    const sets = [...new Set([...oficialesPorSet.keys(), ...manualesPorSet.keys()])]
        .sort((a, b) => a - b);
    const detalle = sets.map(set => {
        const oficiales = oficialesPorSet.get(set) || 0;
        const manuales = manualesPorSet.get(set) || 0;
        return {
            set,
            oficiales,
            manuales,
            manualCompleta: oficiales > 0 && manuales === oficiales
        };
    });

    return {
        setsOficiales: [...oficialesPorSet.keys()].sort((a, b) => a - b),
        setsManuales: [...manualesPorSet.keys()].sort((a, b) => a - b),
        puntosOficiales: [...oficialesPorSet.values()].reduce((total, valor) => total + valor, 0),
        puntosManuales: [...manualesPorSet.values()].reduce((total, valor) => total + valor, 0),
        detalle
    };
}

function equipoAnotadorOficial(punto) {
    if (EQUIPOS_VALIDOS.has(punto?.equipoAnota)) return punto.equipoAnota;
    if (punto?.scorer === 'HOME') return 'LOCAL';
    if (punto?.scorer === 'AWAY') return 'VISITANTE';
    return null;
}

function puntosValidosParaRotacion(puntos, equipo) {
    const campoRotacion = normalizarEquipo(equipo) === 'VISITANTE'
        ? 'rotacionVisitante'
        : 'rotacionLocal';

    return (Array.isArray(puntos) ? puntos : []).reduce((resultado, punto) => {
        const equipoAnota = equipoAnotadorOficial(punto);
        const rotacion = Number(punto?.[campoRotacion]);
        if (!equipoAnota || !Number.isInteger(rotacion) || rotacion < 1 || rotacion > 6) {
            return resultado;
        }
        resultado.push({ ...punto, equipoAnota });
        return resultado;
    }, []);
}

export function seleccionarPuntosParaRotaciones(
    puntosOficiales,
    puntosManuales,
    equipo = 'LOCAL',
    setSeleccionado = 'all'
) {
    const seleccionarSet = set => {
        const oficiales = puntosValidosParaRotacion(
            filtrarPuntosPorSet(puntosOficiales, set),
            equipo
        );
        if (oficiales.length > 0) return oficiales;

        return puntosValidosParaRotacion(
            filtrarPuntosPorSet(puntosManuales, set),
            equipo
        );
    };

    if (setSeleccionado !== 'all' && setSeleccionado !== null && setSeleccionado !== undefined) {
        return seleccionarSet(setSeleccionado);
    }

    const sets = new Set(
        [...(Array.isArray(puntosOficiales) ? puntosOficiales : []),
            ...(Array.isArray(puntosManuales) ? puntosManuales : [])]
            .map(punto => Number(punto?.set || 1))
            .filter(Number.isInteger)
    );
    return [...sets].sort((a, b) => a - b).flatMap(seleccionarSet);
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
