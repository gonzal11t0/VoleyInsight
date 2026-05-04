const MatchTracker = require('./src/core/tracker');
const logger = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

// Manejador de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

// Leer ID desde config.json
let matchId = 257929;
try {
    const configPath = path.join(__dirname, 'data', 'config.json');
    if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        matchId = configData.matchId;
        console.log(`📌 Tracker usando matchId: ${matchId} (desde config.json)`);
    } else {
        console.log('⚠️ No se encontró data/config.json, usando ID por defecto: 257929');
    }
} catch(e) {
    console.log('⚠️ Error leyendo config.json, usando ID por defecto');
}

// Crear tracker
const tracker = new MatchTracker(matchId);

// Manejar señales de cierre
const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    await tracker.stop();
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Iniciar
logger.info('🚀 Starting Metro Vóley Tracker...');
tracker.start();