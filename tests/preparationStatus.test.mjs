import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    normalizarMatchId,
    validarConfiguracionPendiente,
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
