// server-api.js - Servidor Express con API REST + WebSocket
const cors = require('cors');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const socketIo = require('socket.io');

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

const app = express();
const corsOptions = {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST'],
        credentials: true,
        transports: ['polling', 'websocket']
    }
});

const PORT = process.env.PORT || 5501;
const connectedClients = new Map();

async function obtenerEstadoPartido(matchId) {
    try {
        const filePath = path.join(__dirname, 'data', `match_${matchId}.json`);
        const data = await fs.readFile(filePath, 'utf-8');
        const puntos = JSON.parse(data);
        if (puntos && puntos.length > 0) {
            const ultimo = puntos[puntos.length - 1];
            return {
                homeScore: ultimo.homeScore || 0,
                awayScore: ultimo.awayScore || 0,
                set: ultimo.set || 1,
                homeTeam: ultimo.homeTeam,
                awayTeam: ultimo.awayTeam,
                lastPoint: ultimo
            };
        }
    } catch(e) {
        console.log(`⚠️ No se pudo leer el estado del partido ${matchId}:`, e.message);
    }
    return null;
}


async function guardarPuntosManuales(matchId, puntos) {
    try {
        const filePath = path.join(__dirname, 'data', `puntos_manuales_${matchId}.json`);
        await fs.writeFile(filePath, JSON.stringify(puntos, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Error guardando puntos manuales:', e.message);
        return false;
    }
}

async function leerPuntosManuales(matchId) {
    try {
        const filePath = path.join(__dirname, 'data', `puntos_manuales_${matchId}.json`);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function emitPuntoManual(matchId, punto) {
    if (connectedClients.has(matchId)) {
        const clients = connectedClients.get(matchId);
        clients.forEach(client => {
            client.emit('punto_manual', punto);
        });
        console.log(`📤 Punto manual emitido a ${clients.size} clientes para partido ${matchId}`);
    }
}


app.post('/api/puntos', async (req, res) => {
    try {
        const { matchId, punto } = req.body;
        if (!matchId || !punto) {
            return res.status(400).json({ success: false, error: 'Faltan datos: matchId y punto son requeridos' });
        }

        const puntos = await leerPuntosManuales(matchId);
        puntos.push(punto);
        await guardarPuntosManuales(matchId, puntos);

        emitPuntoManual(matchId, punto);

        res.json({ success: true, message: 'Punto guardado correctamente' });
    } catch (e) {
        console.error('Error en POST /api/puntos:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/puntos/:matchId', async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId);
        const puntos = await leerPuntosManuales(matchId);
        res.json({ success: true, count: puntos.length, data: puntos });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/puntos/:matchId', async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId);
        const filePath = path.join(__dirname, 'data', `puntos_manuales_${matchId}.json`);
        await fs.unlink(filePath).catch(() => {});
        res.json({ success: true, message: 'Puntos eliminados' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});


io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);
    
    socket.on('subscribe', async (matchId) => {
        socket.matchId = matchId;
        if (!connectedClients.has(matchId)) {
            connectedClients.set(matchId, new Set());
        }
        connectedClients.get(matchId).add(socket);
        console.log(`📡 Cliente ${socket.id} suscrito a partido ${matchId}`);
        
        socket.emit('subscribed', { matchId, status: 'ok' });
        const estadoActual = await obtenerEstadoPartido(matchId);
        if (estadoActual) {
            socket.emit('match_update', estadoActual);
            console.log(`📤 Estado actual enviado a ${socket.id}: ${estadoActual.homeScore} - ${estadoActual.awayScore}`);
        }
    });
    
    socket.on('unsubscribe', (matchId) => {
        if (connectedClients.has(matchId)) {
            connectedClients.get(matchId).delete(socket);
            if (connectedClients.get(matchId).size === 0) {
                connectedClients.delete(matchId);
            }
        }
        console.log(`📡 Cliente ${socket.id} desuscrito de partido ${matchId}`);
    });
    
    socket.on('ping_keepalive', () => {});
    
    socket.on('disconnect', () => {
        if (socket.matchId && connectedClients.has(socket.matchId)) {
            connectedClients.get(socket.matchId).delete(socket);
        }
        console.log('🔌 Cliente desconectado:', socket.id);
    });
});

function emitNewPoint(matchId, pointData) {
    if (connectedClients.has(matchId)) {
        const clients = connectedClients.get(matchId);
        clients.forEach(client => {
            client.emit('new_point', pointData);
        });
        console.log(`📤 Punto emitido a ${clients.size} clientes para partido ${matchId}`);
    }
}

app.post('/api/webhook/point', (req, res) => {
    const { matchId, point } = req.body;
    if (matchId && point) {
        emitNewPoint(matchId, point);
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, error: 'Faltan datos' });
    }
});

app.get('/keepalive', (req, res) => {
    res.json({ status: 'alive', timestamp: Date.now() });
});

app.get('/api/matches', async (req, res) => {
    try {
        const files = await fs.readdir('./data');
        const matchIds = files
            .filter(f => f.startsWith('match_') && f.endsWith('.json'))
            .map(f => parseInt(f.replace('match_', '').replace('.json', '')))
            .sort((a, b) => b - a);
        
        const matches = [];
        for (const id of matchIds.slice(0, 50)) {
            try {
                const data = JSON.parse(await fs.readFile(`./data/match_${id}.json`, 'utf-8'));
                if (data && data.length > 0) {
                    const last = data[data.length - 1];
                    const first = data[0];
                    matches.push({
                        id: id,
                        homeTeam: last.homeTeam || first.homeTeam || 'LOCAL',
                        awayTeam: last.awayTeam || first.awayTeam || 'VISITANTE',
                        homeScore: last.homeScore,
                        awayScore: last.awayScore,
                        totalPoints: data.filter(p => p.scorer).length,
                        date: first.timestamp || null,
                        status: (last.homeScore >= 25 || last.awayScore >= 25) && Math.abs(last.homeScore - last.awayScore) >= 2 ? 'finalizado' : 'en_curso'
                    });
                }
            } catch(e) {}
        }
        res.json({ success: true, count: matches.length, data: matches });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/matches/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = JSON.parse(await fs.readFile(`./data/match_${id}.json`, 'utf-8'));
        if (!data || data.length === 0) {
            return res.status(404).json({ success: false, error: 'Partido no encontrado' });
        }
        
        const last = data[data.length - 1];
        const first = data[0];
        const points = data.filter(p => p.scorer);
        const homePoints = points.filter(p => p.scorer === 'HOME').length;
        const awayPoints = points.filter(p => p.scorer === 'AWAY').length;
        
        const setsMap = new Map();
        for (const punto of data) {
            if (!setsMap.has(punto.set)) setsMap.set(punto.set, { home: 0, away: 0 });
            const setData = setsMap.get(punto.set);
            setData.home = punto.homeScore;
            setData.away = punto.awayScore;
        }
        
        const setsGanados = { home: 0, away: 0 };
        for (const [setNum, scores] of setsMap) {
            const totalSets = setsMap.size;
            const esSetDecisivo = (totalSets === 3 && setNum === 3) || (totalSets === 5 && setNum === 5);
            const puntosNecesarios = esSetDecisivo ? 15 : 25;
            if (scores.home >= puntosNecesarios || scores.away >= puntosNecesarios) {
                if (Math.abs(scores.home - scores.away) >= 2) {
                    if (scores.home > scores.away) setsGanados.home++;
                    else setsGanados.away++;
                }
            }
        }
        
        res.json({
            success: true,
            data: {
                id: id,
                homeTeam: last.homeTeam || first.homeTeam,
                awayTeam: last.awayTeam || first.awayTeam,
                homeScore: last.homeScore,
                awayScore: last.awayScore,
                status: (last.homeScore >= 25 || last.awayScore >= 25) && Math.abs(last.homeScore - last.awayScore) >= 2 ? 'finalizado' : 'en_curso',
                setsGanados: setsGanados,
                totalPoints: points.length,
                homePoints: homePoints,
                awayPoints: awayPoints,
                homeEfficiency: points.length ? ((homePoints / points.length) * 100).toFixed(1) : 0,
                awayEfficiency: points.length ? ((awayPoints / points.length) * 100).toFixed(1) : 0,
                lastUpdate: last.timestamp,
                startDate: first.timestamp
            }
        });
    } catch(e) {
        res.status(404).json({ success: false, error: 'Partido no encontrado' });
    }
});

app.get('/api/matches/:id/points', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const set = req.query.set ? parseInt(req.query.set) : null;
        const limit = req.query.limit ? parseInt(req.query.limit) : null;
        
        let data = JSON.parse(await fs.readFile(`./data/match_${id}.json`, 'utf-8'));
        if (set) data = data.filter(p => p.set === set);
        if (limit && limit > 0) data = data.slice(-limit);
        
        res.json({ success: true, count: data.length, data: data });
    } catch(e) {
        res.status(404).json({ success: false, error: 'Datos no encontrados' });
    }
});

app.get('/api/matches/:id/points/last', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const n = req.query.n ? parseInt(req.query.n) : 10;
        const data = JSON.parse(await fs.readFile(`./data/match_${id}.json`, 'utf-8'));
        const lastPoints = data.slice(-n).reverse();
        res.json({ success: true, count: lastPoints.length, data: lastPoints });
    } catch(e) {
        res.status(404).json({ success: false, error: 'Datos no encontrados' });
    }
});

app.get('/api/matches/:id/stats', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = JSON.parse(await fs.readFile(`./data/match_${id}.json`, 'utf-8'));
        
        const points = data.filter(p => p.scorer);
        const homePoints = points.filter(p => p.scorer === 'HOME').length;
        const awayPoints = points.filter(p => p.scorer === 'AWAY').length;
        const total = points.length;
        const maxHomeRun = Math.max(...data.map(s => s.homeRun));
        const maxAwayRun = Math.max(...data.map(s => s.awayRun));
        const breaks = data.filter(s => s.event && s.event.includes('BREAK'));
        const homeBreaks = breaks.filter(b => b.event === 'BREAK_HOME').length;
        const awayBreaks = breaks.filter(b => b.event === 'BREAK_AWAY').length;
        
        const clutchPoints = data.filter(s => {
            const isSetPoint = (s.homeScore >= 24 && s.homeScore > s.awayScore) || (s.awayScore >= 24 && s.awayScore > s.homeScore);
            const isCloseGame = Math.abs(s.lead) <= 2;
            return (isSetPoint || isCloseGame) && s.scorer;
        });
        const homeClutch = clutchPoints.filter(c => c.scorer === 'HOME').length;
        const homeClutchPct = clutchPoints.length ? ((homeClutch / clutchPoints.length) * 100).toFixed(1) : 0;
        
        const phases = { EARLY: { home: 0, away: 0, total: 0 }, MID: { home: 0, away: 0, total: 0 }, LATE: { home: 0, away: 0, total: 0 } };
        data.forEach(s => {
            if (s.scorer && phases[s.phase]) {
                phases[s.phase][s.scorer === 'HOME' ? 'home' : 'away']++;
                phases[s.phase].total++;
            }
        });
        
        const homePhaseEff = {
            early: phases.EARLY.total ? (phases.EARLY.home / phases.EARLY.total * 100).toFixed(1) : 0,
            mid: phases.MID.total ? (phases.MID.home / phases.MID.total * 100).toFixed(1) : 0,
            late: phases.LATE.total ? (phases.LATE.home / phases.LATE.total * 100).toFixed(1) : 0
        };
        
        const awayPhaseEff = {
            early: phases.EARLY.total ? (phases.EARLY.away / phases.EARLY.total * 100).toFixed(1) : 0,
            mid: phases.MID.total ? (phases.MID.away / phases.MID.total * 100).toFixed(1) : 0,
            late: phases.LATE.total ? (phases.LATE.away / phases.LATE.total * 100).toFixed(1) : 0
        };
        
        res.json({
            success: true,
            data: {
                general: { totalPoints: total, homePoints, awayPoints, homeEfficiency: total ? ((homePoints / total) * 100).toFixed(1) : 0, awayEfficiency: total ? ((awayPoints / total) * 100).toFixed(1) : 0 },
                runs: { homeMax: maxHomeRun, awayMax: maxAwayRun },
                breaks: { home: homeBreaks, away: awayBreaks },
                clutch: { homePercentage: homeClutchPct, awayPercentage: (100 - homeClutchPct).toFixed(1), totalPoints: clutchPoints.length },
                phases: { home: homePhaseEff, away: awayPhaseEff }
            }
        });
    } catch(e) {
        res.status(404).json({ success: false, error: 'Datos no encontrados' });
    }
});

app.get('/api/matches/:id/sets', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = JSON.parse(await fs.readFile(`./data/match_${id}.json`, 'utf-8'));
        
        const setsMap = new Map();
        for (const punto of data) {
            if (!setsMap.has(punto.set)) setsMap.set(punto.set, { home: 0, away: 0 });
            const setData = setsMap.get(punto.set);
            setData.home = punto.homeScore;
            setData.away = punto.awayScore;
        }
        
        const sets = [];
        for (const [num, scores] of setsMap) {
            sets.push({ set: num, home: scores.home, away: scores.away, winner: scores.home > scores.away ? 'home' : 'away' });
        }
        
        res.json({ success: true, data: sets });
    } catch(e) {
        res.status(404).json({ success: false, error: 'Datos no encontrados' });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ success: true, status: 'online', version: '2.5.0', timestamp: new Date().toISOString(), endpoints: ['GET /api/matches', 'GET /api/matches/:id', 'GET /api/matches/:id/points', 'GET /api/matches/:id/points/last', 'GET /api/matches/:id/stats', 'GET /api/matches/:id/sets', 'GET /api/status'] });
});

app.get('/api/config', async (req, res) => {
    try {
        const configPath = path.join(__dirname, 'data', 'config.json');
        const data = await fs.readFile(configPath, 'utf-8');
        res.json(JSON.parse(data));
    } catch(e) {
        res.status(404).json({ error: 'Config not found' });
    }
});

app.post('/api/config', async (req, res) => {
    try {
        const { matchId } = req.body;
        if (!matchId) {
            return res.status(400).json({ error: 'matchId requerido' });
        }
        
        const configPath = path.join(__dirname, 'data', 'config.json');
        let config = {};
        try {
            const data = await fs.readFile(configPath, 'utf-8');
            config = JSON.parse(data);
        } catch(e) {}
        
        config.matchId = matchId;
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
        
        res.json({ success: true, matchId });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});
app.use(express.static('./'));

app.use('/dashboard', express.static('./dashboard'));

app.get('/', (req, res) => {
    res.redirect('/dashboard/index.html');
});

server.listen(PORT, () => {
    console.log(`

╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🏐 VOLEYINSIGHT v2.5 - SERVIDOR API + WEBSOCKET           ║
║                                                              ║
║   📡 API REST: http://localhost:${PORT}/api/status           ║
║   🔌 WebSocket: ws://localhost:${PORT}                       ║
║   🖥️Dashboard: http://localhost:${PORT}/dashboard/index.html║
║                                                               ║
╚══════════════════════════════════════════════════════════════╝
    `);
});