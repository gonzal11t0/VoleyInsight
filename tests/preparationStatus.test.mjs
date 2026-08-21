import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    normalizarMatchId,
    buscarPartidoConfigurado,
    obtenerRespaldoPartido,
    obtenerPartidosPreparados,
    guardarPartidoPreparado,
    quitarPartidoPreparado,
    actualizarHistorialPartidos,
    validarConfiguracionPartido,
    validarConfiguracionPendiente,
    aplicarPartidoActivo,
    finalizarPartidoActivo,
    obtenerEstadoCancha,
    evaluarPreparacion
} = require('../src/core/preparationStatus.js');

const courtCompleta = {
    liveState: {
        court: {
            home: { positions: Object.fromEntries([1, 2, 3, 4, 5, 6].map(position => [position, { position }])) },
            away: { positions: Object.fromEntries([1, 2, 3, 4, 5, 6].map(position => [position, { position }])) }
        }
    }
};

assert.equal(normalizarMatchId('275125'), 275125);
assert.equal(normalizarMatchId('0'), null);
assert.equal(normalizarMatchId('abc'), null);

const configConHistorialViejo = {
    matchId: 277134,
    homeTeam: 'ATTITUDE',
    awayTeam: 'CEP',
    categoria: 'mayores',
    metroStatus: 'verified',
    partidos: [
        { id: 230512, homeTeam: 'GEBA', awayTeam: 'SGREGOR', categoria: 'sub_14' },
        { id: 277134, homeTeam: 'LOCAL VIEJO', awayTeam: 'VISITANTE VIEJO', categoria: 'sub_18', metroStatus: 'pending' }
    ]
};
assert.deepEqual(obtenerRespaldoPartido(configConHistorialViejo, 277134), {
    id: 277134,
    homeTeam: 'ATTITUDE',
    awayTeam: 'CEP',
    categoria: 'mayores',
    metroStatus: 'verified'
}, 'el partido activo debe usar los campos principales de config.json');
assert.equal(buscarPartidoConfigurado({ partidos: {} }, 277134), null, 'un historial con formato inválido no debe romper el panel');

const historialSinDuplicados = actualizarHistorialPartidos([
    { id: 230512, homeTeam: 'GEBA' },
    { id: 277134, homeTeam: 'NOMBRE VIEJO' },
    { matchId: 277134, homeTeam: 'OTRO DUPLICADO' }
], {
    id: 277134,
    homeTeam: 'ATTITUDE',
    awayTeam: 'CEP',
    categoria: 'mayores'
});
assert.equal(historialSinDuplicados.length, 2);
assert.equal(historialSinDuplicados.filter(partido => partido.id === 277134).length, 1);
assert.equal(historialSinDuplicados.at(-1).homeTeam, 'ATTITUDE');

const pendienteValido = validarConfiguracionPendiente({
    matchId: '277134',
    homeTeam: 'ATTITUDE',
    awayTeam: 'CEP',
    categoria: 'mayores',
    categoriasPermitidas: { mayores: { nombre: 'Mayores' } }
});
assert.equal(pendienteValido.valida, true);
assert.equal(pendienteValido.matchId, 277134);

const pendienteInvalido = validarConfiguracionPendiente({
    matchId: '277134',
    homeTeam: 'LOCAL',
    awayTeam: 'VISITANTE',
    categoria: 'inventada',
    categoriasPermitidas: { mayores: { nombre: 'Mayores' } }
});
assert.equal(pendienteInvalido.valida, false);
assert.match(pendienteInvalido.errores.join(' '), /equipo local/i);
assert.match(pendienteInvalido.errores.join(' '), /categoría/i);

const configuracionDesdePanel = validarConfiguracionPartido({
    matchId: '299999',
    homeTeam: '  ATTITUDE  ',
    awayTeam: ' CEP ',
    categoria: 'mayores',
    categoriasPermitidas: { mayores: { nombre: 'Mayores' } }
});
assert.equal(configuracionDesdePanel.valida, true);
assert.equal(configuracionDesdePanel.homeTeam, 'ATTITUDE');

const activadaDesdePanel = aplicarPartidoActivo(configConHistorialViejo, {
    matchId: 299999,
    homeTeam: 'ATTITUDE',
    awayTeam: 'CEP',
    categoria: 'mayores',
    metroStatus: 'pending'
});
assert.equal(activadaDesdePanel.matchId, 299999);
assert.equal(activadaDesdePanel.homeTeam, 'ATTITUDE');
assert.equal(activadaDesdePanel.metroStatus, 'pending');
assert.equal(activadaDesdePanel.partidos.at(-1).id, 299999);
assert.equal(activadaDesdePanel.partidos.filter(partido => partido.id === 277134).length, 1,
    'activar un partido nuevo no debe borrar ni duplicar el historial anterior');
assert.equal(configConHistorialViejo.matchId, 277134,
    'la construcción de la configuración no debe mutar el objeto anterior');

const conPrimerPreparado = guardarPartidoPreparado(configConHistorialViejo, {
    id: 277500,
    homeTeam: 'ATTITUDE',
    awayTeam: 'CEDEN',
    categoria: 'mayores',
    metroStatus: 'pending'
});
assert.equal(conPrimerPreparado.matchId, 277134,
    'agregar un partido preparado no debe cambiar el partido activo');
assert.equal(conPrimerPreparado.partidosPreparados.length, 1);
assert.equal(conPrimerPreparado.partidosPreparados[0].id, 277500);
assert.equal(configConHistorialViejo.partidosPreparados, undefined,
    'agregar un partido preparado no debe mutar la configuración anterior');

const conDosPreparados = guardarPartidoPreparado(conPrimerPreparado, {
    id: 277501,
    homeTeam: 'ATTITUDE',
    awayTeam: 'AC D',
    categoria: 'mayores',
    metroStatus: 'pending'
});
assert.deepEqual(obtenerPartidosPreparados(conDosPreparados).map(partido => partido.id), [277500, 277501]);

const preparadoActualizado = guardarPartidoPreparado(conDosPreparados, {
    id: 277500,
    homeTeam: 'ATTITUDE',
    awayTeam: 'CEDEN ACTUALIZADO',
    categoria: 'mayores',
    metroStatus: 'verified'
});
assert.equal(obtenerPartidosPreparados(preparadoActualizado).length, 2,
    'volver a preparar el mismo ID debe actualizarlo sin duplicarlo');
assert.equal(obtenerPartidosPreparados(preparadoActualizado).at(-1).awayTeam, 'CEDEN ACTUALIZADO');

const activadoDesdePreparados = aplicarPartidoActivo(conDosPreparados, {
    id: 277500,
    homeTeam: 'ATTITUDE',
    awayTeam: 'CEDEN',
    categoria: 'mayores',
    metroStatus: 'verified'
});
assert.equal(activadoDesdePreparados.matchId, 277500);
assert.deepEqual(obtenerPartidosPreparados(activadoDesdePreparados).map(partido => partido.id), [277501],
    'activar un partido debe quitar solo ese partido de la lista de preparados');

const sinSegundoPreparado = quitarPartidoPreparado(conDosPreparados, 277501);
assert.deepEqual(obtenerPartidosPreparados(sinSegundoPreparado).map(partido => partido.id), [277500]);

const sinPartidoActivo = finalizarPartidoActivo(conDosPreparados);
assert.equal(sinPartidoActivo.matchId, undefined, 'finalizar debe dejar el sistema sin partido activo');
assert.equal(sinPartidoActivo.homeTeam, undefined);
assert.equal(sinPartidoActivo.partidos.at(-1).id, 277134,
    'el partido finalizado debe conservarse en el historial');
assert.equal(sinPartidoActivo.partidos.at(-1).estado, 'finalizado');
assert.deepEqual(obtenerPartidosPreparados(sinPartidoActivo).map(partido => partido.id), [277500, 277501],
    'finalizar el activo no debe borrar los próximos partidos');
assert.throws(() => finalizarPartidoActivo({}), /no hay un partido activo/i);
assert.throws(
    () => guardarPartidoPreparado(configConHistorialViejo, { id: 277134 }),
    /ya es el partido activo/i
);
assert.deepEqual(obtenerEstadoCancha(courtCompleta), {
    disponible: true,
    local: 6,
    visitante: 6,
    completa: true
});

const listo = evaluarPreparacion({
    datosMetro: courtCompleta,
    fullExiste: true,
    antiguedadFullMs: 3_000,
    ahoraMs: 1_000
});
assert.equal(listo.nivel, 'ready');
assert.equal(listo.tracker.estado, 'ok');
assert.equal(listo.formacion.estado, 'ok');
assert.equal(listo.puedeIngresar, true);

const antesDelPartido = evaluarPreparacion({
    datosMetro: { match: { id: 275125 } },
    fullExiste: true,
    antiguedadFullMs: 3_000
});
assert.equal(antesDelPartido.nivel, 'waiting');
assert.equal(antesDelPartido.tracker.estado, 'ok');
assert.equal(antesDelPartido.formacion.estado, 'espera');
assert.match(antesDelPartido.formacion.detalle, /normal antes del comienzo/i);

const preparadoAntesDeMetro = evaluarPreparacion({
    datosMetro: { matchId: 277134, liveState: { court: null } },
    fullExiste: true,
    antiguedadFullMs: 1_000,
    pendienteMetro: true
});
assert.equal(preparadoAntesDeMetro.nivel, 'waiting');
assert.equal(preparadoAntesDeMetro.tracker.estado, 'espera');
assert.match(preparadoAntesDeMetro.tracker.titulo, /esperando a Metro/i);

const trackerDetenido = evaluarPreparacion({
    datosMetro: courtCompleta,
    fullExiste: true,
    antiguedadFullMs: 180_000
});
assert.equal(trackerDetenido.nivel, 'warning');
assert.equal(trackerDetenido.tracker.estado, 'error');
assert.equal(trackerDetenido.puedeIngresar, true, 'una advertencia no debe bloquear el acceso');

const reconectando = evaluarPreparacion({
    datosMetro: {},
    fullExiste: true,
    antiguedadFullMs: 5_000,
    trackerStatus: { status: 'reconnecting', nextRetrySeconds: 4 }
});
assert.equal(reconectando.tracker.estado, 'error');
assert.match(reconectando.tracker.detalle, /4 segundos/);

console.log('preparationStatus: tests OK');
