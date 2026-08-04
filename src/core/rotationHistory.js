const EQUIPOS = new Set(['LOCAL', 'VISITANTE']);

function normalizarSaque(valor) {
    const equipo = String(valor || '').toUpperCase();
    if (equipo === 'HOME' || equipo === 'LOCAL') return 'HOME';
    if (equipo === 'AWAY' || equipo === 'VISITANTE') return 'AWAY';
    return null;
}

function normalizarAnotador(valor) {
    const equipo = String(valor || '').toUpperCase();
    if (equipo === 'HOME' || equipo === 'LOCAL') return 'HOME';
    if (equipo === 'AWAY' || equipo === 'VISITANTE') return 'AWAY';
    return null;
}

function aEquipoManual(valor) {
    const equipo = normalizarAnotador(valor);
    if (equipo === 'HOME') return 'LOCAL';
    if (equipo === 'AWAY') return 'VISITANTE';
    return null;
}

function rotacionValida(valor) {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero >= 1 && numero <= 6;
}

function avanzarRotacion(rotacion) {
    return (Number(rotacion) % 6) + 1;
}

function claveRally(set, homeScore, awayScore) {
    return `${Number(set) || 1}:${Number(homeScore)}-${Number(awayScore)}`;
}

function eventoDesdeRally(anotador, saqueAntes) {
    if (!anotador || !saqueAntes) return 'POINT';
    const tipo = anotador === saqueAntes ? 'BREAK' : 'SIDEOUT';
    return `${tipo}_${anotador}`;
}

function reconstruirRalliesOficiales(snapshots) {
    const estados = new Map();
    const rallies = [];

    for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
        const set = Number(snapshot?.set) || 1;
        const homeScore = Number(snapshot?.homeScore);
        const awayScore = Number(snapshot?.awayScore);
        if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

        if (!estados.has(set)) {
            estados.set(set, {
                rotacionLocal: 1,
                rotacionVisitante: 1,
                saqueActual: null,
                inicializado: false
            });
        }
        const estado = estados.get(set);
        const anotador = normalizarAnotador(snapshot?.scorer);

        if (!anotador) {
            const saquePublicado = normalizarSaque(
                snapshot?.servingAfter ||
                snapshot?.equipoSacaDespues ||
                snapshot?.serving ||
                snapshot?.servingBefore ||
                snapshot?.equipoSacaba
            );
            if (saquePublicado) {
                estado.saqueActual = saquePublicado;
                estado.inicializado = true;
            }
            if (rotacionValida(snapshot?.rotacionLocalDespues)) {
                estado.rotacionLocal = Number(snapshot.rotacionLocalDespues);
            }
            if (rotacionValida(snapshot?.rotacionVisitanteDespues)) {
                estado.rotacionVisitante = Number(snapshot.rotacionVisitanteDespues);
            }
            continue;
        }

        const tieneSaqueAntesExplicito = Boolean(snapshot?.servingBefore || snapshot?.equipoSacaba);
        const saqueAntes = normalizarSaque(snapshot?.servingBefore || snapshot?.equipoSacaba) ||
            (estado.inicializado ? estado.saqueActual : null);
        const rotacionLocalAntes = rotacionValida(snapshot?.rotacionLocal)
            ? Number(snapshot.rotacionLocal)
            : estado.inicializado
                ? estado.rotacionLocal
                : null;
        const rotacionVisitanteAntes = rotacionValida(snapshot?.rotacionVisitante)
            ? Number(snapshot.rotacionVisitante)
            : estado.inicializado
                ? estado.rotacionVisitante
                : null;

        let rotacionLocalDespues = rotacionValida(snapshot?.rotacionLocalDespues)
            ? Number(snapshot.rotacionLocalDespues)
            : rotacionLocalAntes;
        let rotacionVisitanteDespues = rotacionValida(snapshot?.rotacionVisitanteDespues)
            ? Number(snapshot.rotacionVisitanteDespues)
            : rotacionVisitanteAntes;

        if (
            saqueAntes &&
            rotacionLocalAntes &&
            rotacionVisitanteAntes &&
            !rotacionValida(snapshot?.rotacionLocalDespues) &&
            !rotacionValida(snapshot?.rotacionVisitanteDespues) &&
            anotador !== saqueAntes
        ) {
            if (anotador === 'HOME') rotacionLocalDespues = avanzarRotacion(rotacionLocalAntes);
            if (anotador === 'AWAY') rotacionVisitanteDespues = avanzarRotacion(rotacionVisitanteAntes);
        }

        // En archivos anteriores a v2.9.2, `serving` era el saque posterior.
        // En los nuevos snapshots hay campos before/after explícitos.
        const saqueLegacyPosterior = tieneSaqueAntesExplicito ? null : normalizarSaque(snapshot?.serving);
        const saqueDespues = normalizarSaque(snapshot?.servingAfter || snapshot?.equipoSacaDespues) ||
            saqueLegacyPosterior ||
            anotador;
        const sincronizado = Boolean(
            saqueAntes &&
            rotacionLocalAntes &&
            rotacionVisitanteAntes &&
            rotacionLocalDespues &&
            rotacionVisitanteDespues
        );

        const rally = {
            set,
            homeScore,
            awayScore,
            marcadorDespues: `${homeScore}-${awayScore}`,
            equipoAnota: aEquipoManual(anotador),
            rotacionLocal: rotacionLocalAntes,
            rotacionVisitante: rotacionVisitanteAntes,
            equipoSacaba: aEquipoManual(saqueAntes),
            rotacionLocalDespues,
            rotacionVisitanteDespues,
            equipoSacaDespues: aEquipoManual(saqueDespues),
            servingBefore: saqueAntes,
            servingAfter: saqueDespues,
            event: eventoDesdeRally(anotador, saqueAntes),
            sincronizado
        };
        rallies.push(rally);

        if (sincronizado) {
            estado.rotacionLocal = rotacionLocalDespues;
            estado.rotacionVisitante = rotacionVisitanteDespues;
            estado.saqueActual = saqueDespues;
            estado.inicializado = true;
        }
    }

    return rallies;
}

function enriquecerPuntosManuales(puntosManuales, snapshots) {
    const rallies = reconstruirRalliesOficiales(snapshots);
    const indice = new Map(
        rallies
            .filter(rally => rally.sincronizado)
            .map(rally => [claveRally(rally.set, rally.homeScore, rally.awayScore), rally])
    );
    let cambios = 0;
    let pendientes = 0;
    let conflictos = 0;

    const puntos = (Array.isArray(puntosManuales) ? puntosManuales : []).map(punto => {
        if (!EQUIPOS.has(punto?.equipoAnota) || !punto?.marcadorDespues) return { ...punto };
        const [homeScore, awayScore] = String(punto.marcadorDespues).split('-').map(Number);
        const rally = indice.get(claveRally(punto.set, homeScore, awayScore));
        if (!rally) {
            pendientes++;
            return { ...punto, sincronizacionOficial: 'pendiente' };
        }
        if (punto.equipoAnota !== rally.equipoAnota) {
            conflictos++;
            return {
                ...punto,
                sincronizacionOficial: 'equipo_no_coincide',
                equipoAnotaOficial: rally.equipoAnota
            };
        }

        const enriquecido = {
            ...punto,
            rotacionLocal: rally.rotacionLocal,
            rotacionVisitante: rally.rotacionVisitante,
            equipoSacaba: rally.equipoSacaba,
            rotacionLocalDespues: rally.rotacionLocalDespues,
            rotacionVisitanteDespues: rally.rotacionVisitanteDespues,
            equipoSacaDespues: rally.equipoSacaDespues,
            eventoOficial: rally.event,
            sincronizacionOficial: 'confirmada'
        };

        const campos = [
            'rotacionLocal', 'rotacionVisitante', 'equipoSacaba',
            'rotacionLocalDespues', 'rotacionVisitanteDespues',
            'equipoSacaDespues', 'eventoOficial', 'sincronizacionOficial'
        ];
        if (campos.some(campo => punto?.[campo] !== enriquecido[campo])) cambios++;
        return enriquecido;
    });

    return { puntos, rallies, cambios, pendientes, conflictos };
}

function enriquecerSnapshotsOficiales(snapshots) {
    const rallies = reconstruirRalliesOficiales(snapshots);
    const indice = new Map(
        rallies
            .filter(rally => rally.sincronizado)
            .map(rally => [claveRally(rally.set, rally.homeScore, rally.awayScore), rally])
    );

    return (Array.isArray(snapshots) ? snapshots : []).map(snapshot => {
        if (!normalizarAnotador(snapshot?.scorer)) return { ...snapshot };
        const rally = indice.get(claveRally(snapshot.set, snapshot.homeScore, snapshot.awayScore));
        if (!rally) return { ...snapshot };
        return {
            ...snapshot,
            serving: rally.servingBefore,
            servingBefore: rally.servingBefore,
            servingAfter: rally.servingAfter,
            event: rally.event,
            rotacionLocal: rally.rotacionLocal,
            rotacionVisitante: rally.rotacionVisitante,
            equipoSacaba: rally.equipoSacaba,
            rotacionLocalDespues: rally.rotacionLocalDespues,
            rotacionVisitanteDespues: rally.rotacionVisitanteDespues,
            equipoSacaDespues: rally.equipoSacaDespues
        };
    });
}

module.exports = {
    claveRally,
    reconstruirRalliesOficiales,
    enriquecerPuntosManuales,
    enriquecerSnapshotsOficiales
};
