function normalizarConfig(config = {}) {
    return {
        maxSets: Number(config.maxSets) || 3,
        setsParaGanar: Number(config.setsParaGanar) || 2,
        puntosSetNormal: Number(config.puntosSetNormal) || 25,
        puntosSetDecisivo: Number(config.puntosSetDecisivo) || 15
    };
}

export function isSetTerminado(home, away, setNum, config = {}) {
    const reglas = normalizarConfig(config);
    const esSetDecisivo = Number(setNum) === reglas.maxSets;
    const puntosNecesarios = esSetDecisivo
        ? reglas.puntosSetDecisivo
        : reglas.puntosSetNormal;

    return (Number(home) >= puntosNecesarios || Number(away) >= puntosNecesarios)
        && Math.abs(Number(home) - Number(away)) >= 2;
}

export function extraerEstadoOficial(fullData) {
    const match = fullData?.match || null;
    if (!match) return null;

    const sets = Array.isArray(match.sets) ? match.sets : [];
    return {
        statusId: match.statusId ?? null,
        winnerId: match.winnerId ?? null,
        currentSet: match.currentSet ?? null,
        enCurso: match.statusId === 3 || sets.some(set => set?.statusId === 3),
        finalizado: match.winnerId !== null && match.winnerId !== undefined
    };
}

export function evaluarEstadoPartido(setsMap, config = {}, estadoOficial = null) {
    const entradas = setsMap instanceof Map
        ? Array.from(setsMap.entries())
        : Object.entries(setsMap || {}).map(([setNum, set]) => [Number(setNum), set]);
    const ordenadas = entradas.sort((a, b) => Number(a[0]) - Number(b[0]));

    let setsGanadosLocal = 0;
    let setsGanadosVisitante = 0;
    for (const [setNum, set] of ordenadas) {
        if (!isSetTerminado(set?.home, set?.away, setNum, config)) continue;
        if (Number(set.home) > Number(set.away)) setsGanadosLocal++;
        else setsGanadosVisitante++;
    }

    const ultimo = ordenadas.at(-1);
    const ultimoSetTerminado = Boolean(
        ultimo && isSetTerminado(ultimo[1]?.home, ultimo[1]?.away, ultimo[0], config)
    );
    const setsParaGanar = normalizarConfig(config).setsParaGanar;
    const alcanzoSetsNecesarios = setsGanadosLocal >= setsParaGanar
        || setsGanadosVisitante >= setsParaGanar;

    let partidoTerminado = ultimoSetTerminado && alcanzoSetsNecesarios;
    if (estadoOficial?.enCurso) partidoTerminado = false;
    else if (estadoOficial?.finalizado) partidoTerminado = true;

    return {
        partidoTerminado,
        ultimoSetTerminado,
        setsGanadosLocal,
        setsGanadosVisitante
    };
}
