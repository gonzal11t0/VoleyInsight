// src/core/tracker.js
const logger = require('../utils/logger');
const config = require('../config');
const MetroVoleyAPI = require('../services/api');
const WebSocketService = require('../services/websocket');
const StateProcessor = require('./stateProcessor');
const DataRepository = require('../repositories/dataRepository');
const PerformanceAnalyzer = require('../analytics/performanceAnalyzer');
const HTMLExporter = require('../export/htmlExporter');
const ActivityStatus = require('./activityStatus');
const fs = require('fs').promises;
const path = require('path');
const io = require('socket.io-client');

class MatchTracker {
    constructor(matchId, pollInterval = 3000) {
        this.matchId = matchId;
        this.api = new MetroVoleyAPI(matchId);
        this.processor = new StateProcessor();
        this.repository = new DataRepository(matchId);
        this.ws = null;
        this.isRunning = false;
        this.pollInterval = null;
        this.saveInterval = null;
        this.statsInterval = null;
        this.configMonitorInterval = null;
        this.notifier = null;
        this.socket = null;
        this.connectWebSocket();
        this.consecutiveErrors = 0;
        this.isReconnecting = false;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 60000;
        this.lastSuccessfulFetch = null;
        this.activityStatus = new ActivityStatus(120);
    }

    actualizarActividadPartido(snapshot = null) {
        const actividad = this.activityStatus.update(snapshot);
        if (actividad.shouldNotify) {
            logger.info(`⏸️ Partido sin puntos durante ${actividad.secondsWithoutPoints}s - el seguimiento continúa`);
            if (this.socket && this.socket.connected) {
                this.socket.emit('partido_sin_actividad', {
                    matchId: this.matchId,
                    timestamp: new Date().toISOString(),
                    secondsWithoutPoints: actividad.secondsWithoutPoints
                });
            }
        }
        return actividad;
    }

    connectWebSocket() {
        try {
            this.socket = io(config.server.localUrl, {
                transports: ['polling', 'websocket'],
                reconnection: true
            });
            this.socket.on('connect', () => {
                logger.info('🔌 WebSocket conectado al servidor');
                this.socket.emit('subscribe', this.matchId);
            });
            this.socket.on('disconnect', () => {
                logger.warn('⚠️ WebSocket desconectado; Socket.IO intentará reconectar');
            });
            this.socket.on('subscribed', (data) => {
                logger.info(`📡 Suscrito a partido ${data.matchId}`);
            });
            this.socket.on('cambiar_partido', async (data) => {
                logger.info(`🔄 Recibido cambio de partido a ${data.matchId} via WebSocket`);
                if (data.matchId && data.matchId !== this.matchId) {
                    await this.cambiarPartido(data.matchId);
                }
            });
        } catch (e) {
            logger.error('Error conectando WebSocket:', e.message);
        }
    }

    async cambiarPartido(nuevoMatchId) {
        logger.info(`🔄 Cambiando partido de ${this.matchId} a ${nuevoMatchId}`);
        if (this.repository.snapshots.length > 0) {
            await this.repository.saveJSON();
            logger.info(`💾 Datos del partido ${this.matchId} guardados`);
        }
        this.matchId = nuevoMatchId;
        this.api = new MetroVoleyAPI(this.matchId);
        this.repository = new DataRepository(this.matchId);
        this.processor.reset();
        this.activityStatus.reset();
        await this.crearArchivoPartidoVacio(this.matchId);
        this.repository.snapshots = [];
        if (this.socket && this.socket.connected) {
            this.socket.emit('unsubscribe');
            this.socket.emit('subscribe', this.matchId);
        }
        this.consecutiveErrors = 0;
        this.isReconnecting = false;
        this.reconnectDelay = 1000;
        setTimeout(() => this.fetchAndProcess(), 1000);
        logger.info(`✅ Partido cambiado a ${nuevoMatchId}`);
    }

    async crearArchivoPartidoVacio(matchId) {
        try {
            const filePath = path.join('./data', `match_${matchId}.json`);
            const existe = await fs.access(filePath).then(() => true).catch(() => false);
            if (!existe) {
                const estructuraInicial = [{
                    "timestamp": new Date().toISOString(),
                    "set": 1,
                    "homeTeam": "LOCAL",
                    "awayTeam": "VISITANTE",
                    "homeScore": 0,
                    "awayScore": 0,
                    "scorer": null,
                    "serving": "HOME",
                    "homeRun": 0,
                    "awayRun": 0,
                    "lead": 0,
                    "phase": "EARLY",
                    "event": "INICIO"
                }];
                await fs.writeFile(filePath, JSON.stringify(estructuraInicial, null, 2), 'utf-8');
                logger.info(`📄 Archivo creado para partido ${matchId}`);
                const fullPath = path.join('./data', `full_${matchId}.json`);
                const fullExiste = await fs.access(fullPath).then(() => true).catch(() => false);
                if (!fullExiste) {
                    await fs.writeFile(fullPath, JSON.stringify({ matchId, liveState: { court: null } }, null, 2), 'utf-8');
                }
            }
        } catch (e) {
            logger.warn('Error creando archivo:', e.message);
        }
    }

    async iniciarMonitoreoConfig() {
        let ultimoMatchId = this.matchId;
        this.configMonitorInterval = setInterval(async () => {
            try {
                const configPath = path.join('./data', 'config.json');
                const configData = await fs.readFile(configPath, 'utf-8');
                const configFile = JSON.parse(configData);
                if (configFile.matchId && configFile.matchId !== ultimoMatchId) {
                    logger.info(`📋 [MONITOR] config.json cambió: ${ultimoMatchId} -> ${configFile.matchId}`);
                    ultimoMatchId = configFile.matchId;
                    if (configFile.matchId !== this.matchId) {
                        await this.cambiarPartido(configFile.matchId);
                        if (configFile.homeTeam && configFile.awayTeam) {
                            logger.info(`📋 Equipos: ${configFile.homeTeam} vs ${configFile.awayTeam}`);
                        }
                    }
                }
            } catch (e) {}
        }, 5000);
    }

    async fetchAndProcess() {
        if (this.isReconnecting) {
            logger.debug('Already reconnecting, skipping fetch');
            return;
        }
        try {
            const data = await this.api.fetchUpdates();
            if (this.consecutiveErrors > 0) {
                logger.info(`✅ Conexión restablecida después de ${this.consecutiveErrors} errores`);
                this.consecutiveErrors = 0;
                this.reconnectDelay = 1000;
                await this.notifyConnectionRestored();
            }
            this.lastSuccessfulFetch = new Date();
            const corrections = this.processor.extractUndoCorrections(data);
            const correctionResult = this.repository.applyCorrections(corrections);
            if (correctionResult.removedCount > 0) {
                this.processor.rebuildFromSnapshots(this.repository.getSnapshots());
                logger.info('↩️ Punto anulado por Metro retirado del historial', {
                    matchId: this.matchId,
                    corrections: correctionResult.applied.length,
                    snapshotsRemoved: correctionResult.removedCount
                });
                if (this.socket && this.socket.connected) {
                    this.socket.emit('score_correction', {
                        matchId: this.matchId,
                        corrections: correctionResult.applied.map(item => item.correction)
                    });
                }
            }
            const snapshots = this.processor.processUpdates(data);
            if (snapshots.length) {
                for (const snapshot of snapshots) {
                    this.repository.addSnapshot(snapshot);
                    this.logSnapshot(snapshot);
                    this.actualizarActividadPartido(snapshot);
                    if (this.socket && this.socket.connected && snapshot.scorer) {
                        this.socket.emit('new_point', {
                            matchId: this.matchId,
                            point: snapshot
                        });
                        try {
                            await fetch(`${config.server.localUrl}/api/webhook/point`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    matchId: this.matchId,
                                    point: snapshot
                                })
                            });
                        } catch (e) {
                            logger.debug('Webhook fallback error:', e.message);
                        }
                    }
                }
                try {
                    await this.repository.saveJSON();
                } catch (saveError) {
                    console.error('Error guardando JSON:', saveError.message);
                }
            }
            try {
                const fullDataPath = path.join('./data', `full_${this.matchId}.json`);
                await fs.writeFile(fullDataPath, JSON.stringify(data, null, 2), 'utf-8');
                if (data.court) {
                    const courtPath = path.join('./data', `court_${this.matchId}.json`);
                    await fs.writeFile(courtPath, JSON.stringify(data.court, null, 2), 'utf-8');
                } else {
                    console.log('⚠️ No hay datos de court en esta respuesta (normal, aparecerán cuando el partido empiece)');
                }
            } catch (e) {
                console.error('Error guardando datos completos:', e.message);
            }
            this.actualizarActividadPartido();
            await this.fetchStats();
        } catch (error) {
            this.consecutiveErrors++;
            logger.error(`❌ Error en fetch (${this.consecutiveErrors} consecutivos):`, { error: error.message, name: error.name });
            if (this.consecutiveErrors >= 3 && !this.isReconnecting) {
                await this.attemptReconnection();
            }
        }
    }

    async attemptReconnection() {
        this.isReconnecting = true;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.consecutiveErrors - 3), this.maxReconnectDelay);
        logger.warn(`🔄 Intentando reconexión... (delay: ${delay}ms, error #${this.consecutiveErrors})`);
        await this.notifyReconnecting(delay);
        await this.sleep(delay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.isReconnecting = false;
        await this.fetchAndProcess();
    }

    async notifyReconnecting(delay) {
        try {
            const status = {
                status: 'reconnecting',
                timestamp: new Date().toISOString(),
                consecutiveErrors: this.consecutiveErrors,
                nextRetryMs: delay,
                nextRetrySeconds: Math.round(delay / 1000)
            };
            const statusPath = path.join('./data', `tracker_status_${this.matchId}.json`);
            await fs.writeFile(statusPath, JSON.stringify(status, null, 2), 'utf-8');
        } catch (e) {
            logger.debug('Could not write tracker status', { error: e.message });
        }
    }

    async notifyConnectionRestored() {
        try {
            const status = {
                status: 'connected',
                timestamp: new Date().toISOString(),
                consecutiveErrors: 0
            };
            const statusPath = path.join('./data', `tracker_status_${this.matchId}.json`);
            await fs.writeFile(statusPath, JSON.stringify(status, null, 2), 'utf-8');
            setTimeout(async () => {
                try { await fs.unlink(statusPath); } catch (e) {}
            }, 5000);
            console.log(`\n✅ CONEXIÓN RESTABLECIDA - Tracker sincronizado nuevamente\n`);
        } catch (e) {
            logger.debug('Could not write tracker status', { error: e.message });
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchStats() {
        try {
            const stats = await this.api.fetchStats();
            if (stats) {
                logger.debug('Stats fetched', { hasStats: !!stats });
            }
        } catch (error) {
            logger.debug('Stats not available', { error: error.message });
        }
    }

    handleWebSocketMessage(data) {
        try {
            const apiCompatible = {
                match: {
                    currentSet: data.set || 1,
                    sets: data.sets || [],
                    homeTeam: { name: data.homeTeam },
                    awayTeam: { name: data.awayTeam }
                },
                liveState: {
                    serving: data.serving
                }
            };
            const snapshots = this.processor.processUpdates(apiCompatible);
            for (const snapshot of snapshots) {
                this.repository.addSnapshot(snapshot);
                this.logSnapshot(snapshot);
            }
        } catch (error) {
            logger.error('Error processing WebSocket message', { error: error.message });
        }
    }

    handleWebSocketError(error) {
        logger.warn('WebSocket error', { error: error.message });
        if (!this.isReconnecting && this.consecutiveErrors >= 2) {
            this.attemptReconnection();
        }
    }

    logSnapshot(snapshot) {
        const { set, homeTeam, homeScore, awayScore, awayTeam, scorer, event } = snapshot;
        const eventEmoji = event.includes('BREAK') ? '⚡' : event.includes('SIDEOUT') ? '🔄' : '🎯';
        logger.info(`${eventEmoji} ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`, {
            set,
            scorer,
            event,
            lead: snapshot.lead,
            homeRun: snapshot.homeRun,
            awayRun: snapshot.awayRun,
            phase: snapshot.phase
        });
    }

    startPolling() {
        logger.info('Starting polling mode', { interval: config.match.pollIntervalMs });
        this.start();
    }

    startWebSocket() {
        if (!config.websocket.enabled) return;
        logger.info('Starting WebSocket mode');
        this.ws = new WebSocketService(
            this.matchId,
            (data) => this.handleWebSocketMessage(data),
            (error) => this.handleWebSocketError(error)
        );
        this.ws.connect();
    }

    startSaving() {
        this.saveInterval = setInterval(async () => {
            await this.repository.saveCSV();
        }, config.match.saveIntervalMs);
        this.statsInterval = setInterval(async () => {
            await this.repository.saveJSON();
            await this.repository.saveAnalysis();
        }, 60000);
    }

    async start() {
        this.isRunning = true;
        logger.info(`🚀 Iniciando tracker para partido ${this.matchId} con reconexión automática`);
        await this.crearArchivoPartidoVacio(this.matchId);
        await this.iniciarMonitoreoConfig();
        await this.fetchAndProcess();
        this.pollInterval = setInterval(async () => {
            if (this.isRunning) {
                await this.fetchAndProcess();
            }
        }, config.match.pollIntervalMs || 3000);
        this.startSaving();
        this.startWebSocket();
    }

    async generateAnalysisReport() {
        if (this.repository.snapshots.length === 0) return;
        const analyzer = new PerformanceAnalyzer(this.repository.snapshots);
        const report = analyzer.exportForDashboard();
        const reportPath = path.join('./data', `analysis_${this.matchId}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
        logger.info('📊 Análisis avanzado generado', {
            path: reportPath,
            insights: report.insights?.length || 0,
            recommendations: report.recommendations?.length || 0
        });
        if (report.executiveSummary) console.log(`\n${report.executiveSummary}\n`);
        if (report.insights && report.insights.length > 0) {
            report.insights.forEach(i => console.log(`   ${i}`));
        }
        if (report.recommendations && report.recommendations.length > 0) {
            report.recommendations.forEach(r => console.log(`   ${r}`));
        }
        console.log('\n' + '='.repeat(60));
    }

    async generateFinalReport() {
        const analyzer = new PerformanceAnalyzer(this.repository.snapshots);
        const report = analyzer.generateFullReport();
        const reportPath = path.join('./data', `analysis_${this.matchId}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
        const htmlExporter = new HTMLExporter(this.matchId, this.repository.snapshots);
        const htmlPath = await htmlExporter.generateHTML();
        logger.info('Reports generated', { json: reportPath, html: htmlPath });
        return report;
    }

    async stop() {
        if (!this.isRunning) return;
        logger.info('⛔ Stopping tracker...');
        if (this.pollInterval) clearInterval(this.pollInterval);
        if (this.saveInterval) clearInterval(this.saveInterval);
        if (this.statsInterval) clearInterval(this.statsInterval);
        if (this.configMonitorInterval) clearInterval(this.configMonitorInterval);
        await this.repository.saveCSV();
        await this.repository.saveJSON();
        await this.generateAnalysisReport();
        this.isRunning = false;
        logger.info('✅ Tracker stopped');
    }
}

module.exports = MatchTracker;
