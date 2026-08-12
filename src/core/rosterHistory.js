'use strict';

function normalizarNumeroJugador(valor) {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function nombreGenerico(numero) {
    return `Jugador #${numero}`;
}

function esNombreGenerico(nombre) {
    return /^jugador\s*#?\s*\d+$/i.test(String(nombre || '').trim());
}

function normalizarNombreJugador(nombre, numero) {
    const limpio = String(nombre || '').trim();
    return limpio || nombreGenerico(numero);
}

function normalizarMapaPlantel(mapa = {}) {
    const resultado = {};
    if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) return resultado;

    for (const [clave, valor] of Object.entries(mapa)) {
        const numero = normalizarNumeroJugador(clave);
        if (numero === null) continue;
        resultado[numero] = normalizarNombreJugador(valor, numero);
    }
    return resultado;
}

function fusionarMapasPlantel(base = {}, entrante = {}) {
    const resultado = normalizarMapaPlantel(base);
    const nuevos = normalizarMapaPlantel(entrante);

    for (const [numero, nombre] of Object.entries(nuevos)) {
        const anterior = resultado[numero];
        if (!anterior || esNombreGenerico(anterior) || !esNombreGenerico(nombre)) {
            resultado[numero] = nombre;
        }
    }
    return resultado;
}

function normalizarPlantel(plantel = {}) {
    return {
        local: normalizarMapaPlantel(plantel.local),
        visitante: normalizarMapaPlantel(plantel.visitante)
    };
}

function fusionarPlanteles(...planteles) {
    return planteles.reduce((resultado, plantel) => {
        const normalizado = normalizarPlantel(plantel);
        return {
            local: fusionarMapasPlantel(resultado.local, normalizado.local),
            visitante: fusionarMapasPlantel(resultado.visitante, normalizado.visitante)
        };
    }, { local: {}, visitante: {} });
}

function plantelDesdePuntos(puntos = []) {
    const plantel = { local: {}, visitante: {} };
    for (const punto of Array.isArray(puntos) ? puntos : []) {
        const numero = normalizarNumeroJugador(punto?.jugador);
        const claveEquipo = punto?.equipo === 'LOCAL'
            ? 'local'
            : punto?.equipo === 'VISITANTE'
                ? 'visitante'
                : null;
        if (numero === null || !claveEquipo) continue;

        const nombre = normalizarNombreJugador(
            punto.jugadorNombre || punto.nombreJugador,
            numero
        );
        plantel[claveEquipo] = fusionarMapasPlantel(
            plantel[claveEquipo],
            { [numero]: nombre }
        );
    }
    return plantel;
}

module.exports = {
    normalizarNumeroJugador,
    nombreGenerico,
    esNombreGenerico,
    normalizarNombreJugador,
    normalizarMapaPlantel,
    fusionarMapasPlantel,
    normalizarPlantel,
    fusionarPlanteles,
    plantelDesdePuntos
};
