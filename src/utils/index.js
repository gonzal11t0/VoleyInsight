// MANEJADORES DE ERRORES GLOBALES - Evitan que el proceso se cierre
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection (ignorado):', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception (ignorado):', error.message);
    console.error(error.stack);
});

const MatchTracker = require('./src/core/tracker');
const logger = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

let matchId = 258193;
try {
    const configPath = path.join(__dirname, 'data', 'config.json');
    if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        matchId = configData.matchId;
        console.log(`📌 Tracker usando matchId: ${matchId} (desde config.json)`);
    } else {
        console.log('⚠️ No se encontró data/config.json, usando ID por defecto: 258193');
    }
} catch(e) {
    console.log('⚠️ Error leyendo config.json, usando ID por defecto');
}

const shutdown = async (signal) => {
    console.log(`\n🛑 Recibida señal ${signal}, cerrando tracker...`);
    if (tracker) {
        await tracker.stop();
    }
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const tracker = new MatchTracker(matchId);

console.log('🚀 Starting Metro Vóley Tracker...');
tracker.start().catch(err => {
    console.error('Error fatal:', err);
});