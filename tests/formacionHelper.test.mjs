import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../dashboard/js/formacionHelper.js', import.meta.url), 'utf8');
const helpers = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const equipo = {
    positions: {
        1: { number: 13, firstName: 'Ana', lastName: 'Uno' },
        2: { number: 4, firstName: 'B', lastName: 'Dos' },
        3: { number: 6, firstName: 'C', lastName: 'Tres' },
        4: { number: 7, firstName: 'D', lastName: 'Cuatro' },
        5: { number: 8, firstName: 'E', lastName: 'Cinco', isLibero: true, substitutedFor: 12 },
        6: { number: 18, firstName: 'F', lastName: 'Seis' }
    }
};

const posiciones = helpers.normalizarPosiciones(equipo);
assert.deepEqual(posiciones.map(j => j.numero), [13, 4, 6, 7, 8, 18]);
assert.deepEqual(posiciones.map(j => j.posicion), [1, 2, 3, 4, 5, 6]);
assert.equal(posiciones[4].isLibero, true);
assert.equal(posiciones[4].substitutedFor, 12);

const formacion = { local: posiciones, visitante: posiciones };
assert.equal(
    helpers.obtenerFirmaFormacion(formacion),
    '1:13|2:4|3:6|4:7|5:8|6:18//1:13|2:4|3:6|4:7|5:8|6:18'
);

assert.equal(helpers.findCourt({ liveState: { court: { home: equipo } } }).home, equipo);
assert.equal(helpers.findCourt({ match: { nested: { court: { away: equipo } } } }).away, equipo);
assert.equal(helpers.findCourt({ liveState: {} }), null);

const columnasLocal = helpers.ordenarJugadoresParaCancha(posiciones, 'LOCAL');
assert.deepEqual(
    columnasLocal.map(columna => columna.map(j => j.posicion)),
    [[5, 6, 1], [4, 3, 2]]
);

const columnasVisitante = helpers.ordenarJugadoresParaCancha(posiciones, 'VISITANTE');
assert.deepEqual(
    columnasVisitante.map(columna => columna.map(j => j.posicion)),
    [[2, 3, 4], [1, 6, 5]]
);

const dashboardHtml = await readFile(new URL('../dashboard/index.html', import.meta.url), 'utf8');
const contar = patron => dashboardHtml.match(patron)?.length || 0;

assert.equal(contar(/id="formacionStatus"/g), 1);
assert.equal(contar(/id="formacionSyncTime"/g), 1);
assert.equal(contar(/id="servingDisplay"/g), 1);
assert.match(dashboardHtml, /class="posicion-court">P\$\{j\.posicion\}/);
assert.match(dashboardHtml, /fullData\.liveState\?\.serving/);
assert.match(dashboardHtml, /logo-horizontal\.png/);
assert.match(dashboardHtml, /logo-icon-192\.png/);
assert.match(dashboardHtml, /site\.webmanifest/);

for (const asset of [
    '../dashboard/logo-horizontal.png',
    '../dashboard/logo-icon-192.png',
    '../dashboard/logo-icon-512.png',
    '../dashboard/favicon.ico',
    '../dashboard/og-image.png',
    '../dashboard/site.webmanifest'
]) {
    const contenido = await readFile(new URL(asset, import.meta.url));
    assert.ok(contenido.length > 0, `${asset} debe existir y tener contenido`);
}

console.log('formacionHelper: tests OK');
