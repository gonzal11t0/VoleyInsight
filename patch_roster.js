#!/usr/bin/env node
// patch_roster.js — Enriquece full_*.json y plantel_*.json con nombres reales
// Uso: node patch_roster.js <matchId> [--dry-run]
// Ej:  node patch_roster.js 260366
// Ej:  node patch_roster.js 260366 --dry-run   (no guarda, solo muestra)

const fs = require('fs');
const path = require('path');

const matchId = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!matchId) {
  console.error('Uso: node patch_roster.js <matchId> [--dry-run]');
  process.exit(1);
}

// Detectar carpeta data/ (funciona si el script está en la raíz del proyecto)
const DATA_DIR = fs.existsSync(path.join(__dirname, 'data'))
  ? path.join(__dirname, 'data')
  : path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  console.error(`ERROR: no existe la carpeta data/ (buscada en ${DATA_DIR})`);
  process.exit(1);
}

// ---------------------------------------------------------------
// 1) Descargar HTML y extraer data-page (JSON de Inertia.js)
// ---------------------------------------------------------------
async function fetchRoster(matchId) {
  const url = `https://metrovoley.com.ar/matches/${matchId}/players`;
  console.log(`Fetching ${url} ...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VoleyInsight/3.1.2)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${url}`);
  const html = await res.text();

  const match = html.match(/data-page="([^"]+)"/);
  if (!match) throw new Error('No se encontró data-page en el HTML (¿cambió la estructura?)');

  const raw = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  const dataPage = JSON.parse(raw);
  const props = dataPage.props || {};

  return {
    homeRoster: props.homeRoster || [],
    awayRoster: props.awayRoster || []
  };
}

// ---------------------------------------------------------------
// 2) Construir mapas de cruce
// ---------------------------------------------------------------
function buildMaps(roster) {
  const byMatchTeamPlayerId = {};
  const byJerseyHome = {};
  const byJerseyAway = {};

  for (const j of roster.homeRoster) {
    const nombre = (j.name || '').trim();
    if (!nombre) continue;
    byMatchTeamPlayerId[j.id] = nombre;
    byJerseyHome[String(j.jersey)] = nombre;
  }
  for (const j of roster.awayRoster) {
    const nombre = (j.name || '').trim();
    if (!nombre) continue;
    byMatchTeamPlayerId[j.id] = nombre;
    byJerseyAway[String(j.jersey)] = nombre;
  }

  return { byMatchTeamPlayerId, byJerseyHome, byJerseyAway };
}

// ---------------------------------------------------------------
// 3) Parchear full_*.json: walker genérico por matchTeamPlayerId
//    (funciona en cualquier nodo del árbol, sin importar la ruta)
// ---------------------------------------------------------------
function patchFullJSON(full, maps) {
  const stats = { enriquecidos: 0, yaOk: 0 };

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node.matchTeamPlayerId !== undefined) {
      const nombre = maps.byMatchTeamPlayerId[node.matchTeamPlayerId];
      if (nombre) {
        if (node.firstName === nombre && !node.lastName) {
          stats.yaOk++;
        } else {
          stats.enriquecidos++;
        }
        node.name = nombre;
        node.firstName = nombre;
        node.lastName = '';
      }
    }
    for (const v of Object.values(node)) walk(v);
  }

  walk(full);
  return stats;
}

// ---------------------------------------------------------------
// 4) Parchear plantel_*.json: mapa dorsal -> nombre
// ---------------------------------------------------------------
function patchPlantelJSON(plantel, maps) {
  let cambios = 0;

  for (const [dorsal, valor] of Object.entries(plantel.local || {})) {
    const nombre = maps.byJerseyHome[dorsal];
    if (nombre && valor !== nombre) {
      plantel.local[dorsal] = nombre;
      cambios++;
    }
  }
  for (const [dorsal, valor] of Object.entries(plantel.visitante || {})) {
    const nombre = maps.byJerseyAway[dorsal];
    if (nombre && valor !== nombre) {
      plantel.visitante[dorsal] = nombre;
      cambios++;
    }
  }
  return cambios;
}

// ---------------------------------------------------------------
// 5) Main
// ---------------------------------------------------------------
(async () => {
  try {
    const roster = await fetchRoster(matchId);
    const total = roster.homeRoster.length + roster.awayRoster.length;
    if (total === 0) {
      console.error('ERROR: el roster vino vacío. ¿El partido existe o todavía no cargaron la planilla?');
      process.exit(1);
    }
    console.log(`Roster: ${roster.homeRoster.length} locales + ${roster.awayRoster.length} visitantes = ${total}`);

    const maps = buildMaps(roster);

    // --- full_MATCHID.json ---
    const fullPath = path.join(DATA_DIR, `full_${matchId}.json`);
    if (fs.existsSync(fullPath)) {
      const full = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const stats = patchFullJSON(full, maps);
      console.log(`full_${matchId}.json: ${stats.enriquecidos} enriquecidos, ${stats.yaOk} ya estaban OK`);
      if (!dryRun) {
        fs.writeFileSync(fullPath, JSON.stringify(full, null, 2));
        console.log('  → guardado');
      } else {
        console.log('  → (dry-run, sin guardar)');
      }
    } else {
      console.warn(`⚠ No existe ${fullPath}`);
    }

    // --- plantel_MATCHID.json ---
    const plantelPath = path.join(DATA_DIR, `plantel_${matchId}.json`);
    if (fs.existsSync(plantelPath)) {
      const plantel = JSON.parse(fs.readFileSync(plantelPath, 'utf8'));
      const cambios = patchPlantelJSON(plantel, maps);
      plantel.updatedAt = new Date().toISOString();
      console.log(`plantel_${matchId}.json: ${cambios} nombres reemplazados`);
      if (!dryRun) {
        fs.writeFileSync(plantelPath, JSON.stringify(plantel, null, 2));
        console.log('  → guardado');
      } else {
        console.log('  → (dry-run, sin guardar)');
      }
    } else {
      console.warn(`⚠ No existe ${plantelPath}`);
    }

    console.log('\n✅ Listo. Ahora generá el informe desde el dashboard.');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();