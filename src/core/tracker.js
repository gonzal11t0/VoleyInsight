const logger = require('../utils/logger');
const config = require('../config');
const MetroVoleyAPI = require('../services/api');
const WebSocketService = require('../services/websocket');
const StateProcessor = require('./stateProcessor');
const DataRepository = require('../repositories/dataRepository');
const PerformanceAnalyzer = require('../analytics/performanceAnalyzer');
const HTMLExporter = require('../export/htmlExporter');
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
        this.notifier = null;
        this.socket = null;
        this.connectWebSocket();
        this.consecutiveErrors = 0;
        this.isReconnecting = false;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 60000;
        this.lastSuccessfulFetch = null;
    }
connectWebSocket() {
    try {
        this.socket = io('http://localhost:3002');
        
        this.socket.on('connect', () => {
            logger.info('🔌 WebSocket conectado al servidor');
            this.socket.emit('subscribe', this.matchId);
        });
        
        this.socket.on('disconnect', () => {
            logger.warn('⚠️ WebSocket desconectado, reintentando en 5s');
            setTimeout(() => this.connectWebSocket(), 5000);
        });
        
        this.socket.on('subscribed', (data) => {
            logger.info(`📡 Suscrito a partido ${data.matchId}`);
        });
    } catch(e) {
        logger.error('Error conectando WebSocket:', e.message);
    }
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
        
        const snapshot = this.processor.processUpdate(data);
        
        if (snapshot) {
            this.repository.addSnapshot(snapshot);
            this.logSnapshot(snapshot);
            
            // ✅ WebSocket: enviar punto (AHORA DENTRO del bloque donde snapshot existe)
            if (this.socket && this.socket.connected) {
                if (snapshot.scorer) {
                    this.socket.emit('new_point', {
                        matchId: this.matchId,
                        point: snapshot
                    });
                    
                    // Fallback por HTTP
                    try {
                        const fetch = require('node-fetch');
                        await fetch('http://localhost:3002/api/webhook/point', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                matchId: this.matchId,
                                point: snapshot
                            })
                        });
                    } catch(e) {
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
        
        await this.fetchStats();
        
    } catch (error) {
        this.consecutiveErrors++;
        logger.error(`❌ Error en fetch (${this.consecutiveErrors} consecutivos):`, {
            error: error.message,
            name: error.name
        });
        
        if (this.consecutiveErrors >= 3 && !this.isReconnecting) {
            await this.attemptReconnection();
        }
    }
}
    // ✅ NUEVO MÉTODO: Intentar reconexión con backoff exponencial
    async attemptReconnection() {
        this.isReconnecting = true;
        
        // Calcular delay con backoff exponencial (1s, 2s, 4s, 8s, 16s, 32s, 60s...)
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.consecutiveErrors - 3), this.maxReconnectDelay);
        
        logger.warn(`🔄 Intentando reconexión... (delay: ${delay}ms, error #${this.consecutiveErrors})`);
        
        // Notificar al frontend
        await this.notifyReconnecting(delay);
        
        // Esperar antes de reintentar
        await this.sleep(delay);
        
        // Actualizar delay para el próximo intento
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        
        this.isReconnecting = false;
        
        // Forzar un fetch inmediato
        await this.fetchAndProcess();
    }

    // ✅ NUEVO MÉTODO: Notificar que estamos reconectando
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

    // ✅ NUEVO MÉTODO: Notificar que la conexión se restauró
    async notifyConnectionRestored() {
        try {
            const status = {
                status: 'connected',
                timestamp: new Date().toISOString(),
                consecutiveErrors: 0
            };
            const statusPath = path.join('./data', `tracker_status_${this.matchId}.json`);
            await fs.writeFile(statusPath, JSON.stringify(status, null, 2), 'utf-8');
            
            // Eliminar después de 5 segundos (solo para notificar el evento)
            setTimeout(async () => {
                try {
                    await fs.unlink(statusPath);
                } catch(e) {}
            }, 5000);
            
            console.log(`\n✅ CONEXIÓN RESTABLECIDA - Tracker sincronizado nuevamente\n`);
        } catch (e) {
            logger.debug('Could not write tracker status', { error: e.message });
        }
    }

    // ✅ NUEVO MÉTODO: Sleep helper
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
            
            const snapshot = this.processor.processUpdate(apiCompatible);
            
            if (snapshot) {
                this.repository.addSnapshot(snapshot);
                this.logSnapshot(snapshot);
            }
        } catch (error) {
            logger.error('Error processing WebSocket message', { error: error.message });
        }
    }

    handleWebSocketError(error) {
        logger.warn('WebSocket error', { error: error.message });
        
        // ✅ También manejar reconexión para WebSocket
        if (!this.isReconnecting && this.consecutiveErrors >= 2) {
            this.attemptReconnection();
        }
    }

    logSnapshot(snapshot) {
        const { set, homeTeam, homeScore, awayScore, awayTeam, scorer, event } = snapshot;
        
        const eventEmoji = event.includes('BREAK') ? '⚡' : 
                           event.includes('SIDEOUT') ? '🔄' : '🎯';
        
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
        
        // ✅ Usar el nuevo método start() que maneja reconexión
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

    // ✅ MÉTODO PRINCIPAL MODIFICADO
    async start() {
        this.isRunning = true;
        logger.info(`🚀 Iniciando tracker para partido ${this.matchId} con reconexión automática`);
        
        // Ejecutar fetch inmediatamente
        await this.fetchAndProcess();
        
        // Configurar polling con manejo de reconexión
        this.pollInterval = setInterval(async () => {
            if (this.isRunning) {
                await this.fetchAndProcess();
            }
        }, config.match.pollIntervalMs || 3000);
        
        // Iniciar otros servicios
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
        
        await this.repository.saveCSV();
        await this.repository.saveJSON();
        
        await this.generateAnalysisReport();
        
        this.isRunning = false;
        logger.info('✅ Tracker stopped');
    }
}

module.exports = MatchTracker;