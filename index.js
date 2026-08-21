// index.js
const MatchTracker = require('./src/core/tracker');
const logger = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');
const { obtenerMatchIdActivo } = require('./src/core/trackerActiveState');

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

function leerMatchIdActivo() {
  try {
    const configPath = path.join(__dirname, 'data', 'config.json');
    if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return obtenerMatchIdActivo(configData);
    }
  } catch (error) {
    logger.warn('No se pudo leer data/config.json', { error: error.message });
  }
  return null;
}

let tracker = null;
let esperandoAvisado = false;

async function iniciarCuandoHayaPartido() {
    while (!tracker) {
        const matchId = leerMatchIdActivo();
        if (matchId) {
            console.log(`📌 Tracker usando matchId: ${matchId} (desde config.json)`);
            tracker = new MatchTracker(matchId);
            await tracker.start();
            return;
        }
        if (!esperandoAvisado) {
            logger.info('⏸️ No hay partido activo. Tracker en espera hasta que se active uno desde el panel.');
            esperandoAvisado = true;
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    if (tracker) await tracker.stop();
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

logger.info('🚀 Starting Metro Vóley Tracker...');
iniciarCuandoHayaPartido();
