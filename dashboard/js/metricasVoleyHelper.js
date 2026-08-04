export function normalizarEquipo(valor) {
    const equipo = String(valor || '').toUpperCase();
    if (equipo === 'HOME' || equipo === 'LOCAL') return 'HOME';
    if (equipo === 'AWAY' || equipo === 'VISITANTE') return 'AWAY';
    return null;
}

export function obtenerAnotador(punto) {
    return normalizarEquipo(punto?.scorer || punto?.equipoAnota);
}

export function obtenerSaqueAntes(punto) {
    return normalizarEquipo(
        punto?.servingBefore ||
        punto?.equipoSacaba ||
        punto?.serving
    );
}

function porcentaje(exitos, oportunidades) {
    return oportunidades > 0 ? Number((exitos / oportunidades * 100).toFixed(1)) : 0;
}

export function calcularMetricasRally(puntos) {
    const equipos = {
        HOME: {
            sideout: { exitos: 0, oportunidades: 0, porcentaje: 0 },
            breakpoint: { exitos: 0, oportunidades: 0, porcentaje: 0 }
        },
        AWAY: {
            sideout: { exitos: 0, oportunidades: 0, porcentaje: 0 },
            breakpoint: { exitos: 0, oportunidades: 0, porcentaje: 0 }
        }
    };
    const breakpoints = [];

    for (const punto of Array.isArray(puntos) ? puntos : []) {
        const anotador = obtenerAnotador(punto);
        const saqueAntes = obtenerSaqueAntes(punto);
        if (!anotador || !saqueAntes) continue;

        const receptor = saqueAntes === 'HOME' ? 'AWAY' : 'HOME';
        equipos[saqueAntes].breakpoint.oportunidades++;
        equipos[receptor].sideout.oportunidades++;

        if (anotador === saqueAntes) {
            equipos[saqueAntes].breakpoint.exitos++;
            breakpoints.push({ ...punto, equipoBreakpoint: saqueAntes });
        } else {
            equipos[receptor].sideout.exitos++;
        }
    }

    for (const equipo of ['HOME', 'AWAY']) {
        equipos[equipo].sideout.porcentaje = porcentaje(
            equipos[equipo].sideout.exitos,
            equipos[equipo].sideout.oportunidades
        );
        equipos[equipo].breakpoint.porcentaje = porcentaje(
            equipos[equipo].breakpoint.exitos,
            equipos[equipo].breakpoint.oportunidades
        );
    }

    return { equipos, breakpoints };
}

export function eventoEstandar(punto) {
    const anotador = obtenerAnotador(punto);
    const saqueAntes = obtenerSaqueAntes(punto);
    if (!anotador || !saqueAntes) return 'POINT';
    return `${anotador === saqueAntes ? 'BREAK' : 'SIDEOUT'}_${anotador}`;
}
