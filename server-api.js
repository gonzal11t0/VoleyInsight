// server-api.js - Servidor Express con API REST + WebSocket
require('dotenv').config();

const cors = require('cors');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const { version: APP_VERSION } = require('./package.json');
const MetroVoleyAPI = require('./src/services/api');
const DataRepository = require('./src/repositories/dataRepository');
const {
    readJsonRecoverable,
    writeJsonAtomic
} = require('./src/utils/atomicFile');
const {
    enriquecerPuntosManuales,
    enriquecerSnapshotsOficiales
} = require('./src/core/rotationHistory');
const {
    fusionarPlanteles,
    plantelDesdePuntos
} = require('./src/core/rosterHistory');
const {
    normalizarMatchId,
    obtenerRespaldoPartido,
    obtenerPartidosPreparados,
    guardarPartidoPreparado,
    quitarPartidoPreparado,
    validarConfiguracionPartido,
    aplicarPartidoActivo,
    finalizarPartidoActivo,
    obtenerEstadoCancha,
    obtenerEquipos,
    evaluarPreparacion
} = require('./src/core/preparationStatus');
const {
    createSessionToken,
    validatePassword,
    serializeSessionCookie,
    serializeExpiredCookie,
    readSessionFromRequest
} = require('./src/core/auth');
const { LoginGuard } = require('./src/core/loginGuard');
const { loadAuthPasswords } = require('./src/core/authConfig');
const {
    activeEvents,
    normalizeLegacyEvents,
    appendEvent,
    updateEvent,
    voidEvent,
    recoveryStatus,
    createRecoveryEvents,
    coverageBySet
} = require('./src/core/eventEngine');

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

const app = express();
const corsOptions = {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
const CONFIG_PATH = path.join(__dirname, 'data', 'config.json');
const REGLAMENTO_PATH = path.join(__dirname, 'data', 'reglamento.json');
const AUTH_SECRET_PATH = path.join(__dirname, 'data', '.auth_secret');
const CLUB_PROFILE_PATH = path.join(__dirname, 'data', 'club-profile.json');
const AUTH_PASSWORDS = loadAuthPasswords(process.env);
let authSecretPromise = null;
const loginGuard = new LoginGuard();
const puntosLocks = new Map();

async function obtenerSecretoAuth() {
    if (!authSecretPromise) {
        authSecretPromise = (async () => {
            if (process.env.VOLEY_SESSION_SECRET) return process.env.VOLEY_SESSION_SECRET;
            const existente = await fs.readFile(AUTH_SECRET_PATH, 'utf-8').catch(() => '');
            if (existente.trim()) return existente.trim();
            const generado = crypto.randomBytes(48).toString('hex');
            await fs.mkdir(path.dirname(AUTH_SECRET_PATH), { recursive: true });
            await fs.writeFile(AUTH_SECRET_PATH, `${generado}\n`, { encoding: 'utf-8', mode: 0o600 });
            return generado;
        })();
    }
    return authSecretPromise;
}

function esConexionSegura(req) {
    return req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function esDireccionLocal(value) {
    const address = String(value || '').toLowerCase();
    return address === '127.0.0.1'
        || address === '::1'
        || address === '::ffff:127.0.0.1';
}

function esSolicitudDirectaLocal({ address, headers = {} } = {}) {
    return esDireccionLocal(address)
        && !headers['cf-connecting-ip']
        && !headers['x-forwarded-for'];
}

async function cargarSesion(req) {
    return readSessionFromRequest(req, await obtenerSecretoAuth());
}

async function requireAuthenticated(req, res, next) {
    const session = await cargarSesion(req);
    if (!session) return res.status(401).json({ success: false, error: 'Iniciá sesión para continuar.' });
    req.session = session;
    next();
}

async function requireOperator(req, res, next) {
    const session = await cargarSesion(req);
    if (!session) return res.status(401).json({ success: false, error: 'Iniciá sesión como operador.' });
    if (session.role !== 'operator') {
        return res.status(403).json({ success: false, error: 'Esta acción requiere acceso de operador.' });
    }
    req.session = session;
    next();
}

app.post('/api/auth/login', async (req, res) => {
    const clientKey = String(
        req.headers['cf-connecting-ip']
        || req.headers['x-forwarded-for']
        || req.ip
        || req.socket?.remoteAddress
        || 'unknown'
    ).split(',')[0].trim();
    const guardStatus = loginGuard.status(clientKey);
    if (guardStatus.blocked) {
        const retrySeconds = Math.max(1, Math.ceil(guardStatus.retryAfterMs / 1000));
        res.setHeader('Retry-After', String(retrySeconds));
        return res.status(429).json({ success: false, error: `Demasiados intentos. Volvé a probar en ${Math.ceil(retrySeconds / 60)} minutos.` });
    }
    const role = String(req.body?.role || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!validatePassword(role, password, AUTH_PASSWORDS)) {
        loginGuard.failure(clientKey);
        return res.status(401).json({ success: false, error: 'Rol o contraseña incorrectos.' });
    }
    loginGuard.success(clientKey);
    const token = createSessionToken({ role }, await obtenerSecretoAuth());
    res.setHeader('Set-Cookie', serializeSessionCookie(token, { secure: esConexionSegura(req) }));
    res.json({ success: true, role, expiresInDays: 30 });
});

app.get('/api/auth/session', async (req, res) => {
    const session = await cargarSesion(req);
    if (!session) return res.status(401).json({ success: false, authenticated: false });
    res.json({
        success: true,
        authenticated: true,
        role: session.role,
        expiresAt: new Date(session.expiresAt).toISOString()
    });
});

app.post('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', serializeExpiredCookie({ secure: esConexionSegura(req) }));
    res.json({ success: true });
});

app.use('/api', (req, res, next) => {
    if (req.path === '/status' || req.path.startsWith('/auth/') || req.path === '/webhook/point') {
        return next();
    }
    return requireAuthenticated(req, res, next);
});

async function leerJsonOpcional(filePath, fallback = null) {
    const resultado = await readJsonRecoverable(filePath, { fallback });
    return resultado.data;
}

async function escribirJsonSeguro(filePath, data) {
    await writeJsonAtomic(filePath, data);
}

async function conBloqueoPuntos(matchId, tarea) {
    const key = String(matchId);
    const anterior = puntosLocks.get(key) || Promise.resolve();
    let liberar;
    const turno = new Promise(resolve => { liberar = resolve; });
    puntosLocks.set(key, turno);
    await anterior.catch(() => {});
    try {
        return await tarea();
    } finally {
        liberar();
        if (puntosLocks.get(key) === turno) puntosLocks.delete(key);
    }
}

async function verificarPartidoMetro(matchId) {
    const api = new MetroVoleyAPI(matchId);
    api.timeoutMs = Math.min(api.timeoutMs, 8_000);
    api.retryConfig = { attempts: 1, backoffMs: 0 };
    const datos = await api.fetchUpdates();
    return {
        datos,
        cancha: obtenerEstadoCancha(datos),
        estado: {
            statusId: datos?.match?.statusId ?? null,
            currentSet: datos?.match?.currentSet ?? null,
            homeTeamSets: datos?.match?.homeTeamSets ?? 0,
            awayTeamSets: datos?.match?.awayTeamSets ?? 0
        }
    };
}

function esPartidoPendienteMetro(error) {
    return error?.statusCode === 404
        || String(error?.message || '').startsWith('Invalid API response:');
}

async function obtenerResumenPreparacion(matchId, config) {
    const fullPath = path.join(__dirname, 'data', `full_${matchId}.json`);
    const matchPath = path.join(__dirname, 'data', `match_${matchId}.json`);
    const manualPath = path.join(__dirname, 'data', `puntos_manuales_${matchId}.json`);
    const trackerPath = path.join(__dirname, 'data', `tracker_status_${matchId}.json`);
    const [fullData, snapshots, manuales, trackerStatus] = await Promise.all([
        leerJsonOpcional(fullPath),
        leerJsonOpcional(matchPath, []),
        leerJsonOpcional(manualPath, []),
        leerJsonOpcional(trackerPath)
    ]);

    let antiguedadFullMs = null;
    if (fullData) {
        try {
            const stat = await fs.stat(fullPath);
            antiguedadFullMs = Math.max(0, Date.now() - stat.mtimeMs);
        } catch (error) {}
    }

    const respaldo = obtenerRespaldoPartido(config, matchId);
    const equipos = obtenerEquipos(fullData || {}, respaldo);
    const reconocidoLocalmente = Number(fullData?.match?.id) === matchId;
    const pendienteMetro = respaldo.metroStatus === 'pending' && !reconocidoLocalmente;
    const preparacion = evaluarPreparacion({
        datosMetro: fullData,
        fullExiste: Boolean(fullData),
        antiguedadFullMs,
        trackerStatus,
        pendienteMetro
    });
    const puntosOficiales = Array.isArray(snapshots)
        ? snapshots.filter(punto => Number(punto.homeScore) + Number(punto.awayScore) > 0).length
        : 0;
    const puntosManuales = Array.isArray(manuales) ? manuales.length : 0;

    return {
        matchId,
        configurado: Number(config?.matchId) === matchId,
        equipos: {
            ...equipos,
            categoria: respaldo.categoria || null
        },
        preparacion,
        partido: {
            reconocidoLocalmente,
            metroStatus: pendienteMetro ? 'pending' : reconocidoLocalmente ? 'verified' : respaldo.metroStatus || null,
            statusId: fullData?.match?.statusId ?? null,
            currentSet: fullData?.match?.currentSet ?? null,
            homeTeamSets: fullData?.match?.homeTeamSets ?? 0,
            awayTeamSets: fullData?.match?.awayTeamSets ?? 0
        },
        datosGuardados: {
            puntosOficiales,
            puntosManuales,
            hayDatos: puntosOficiales > 0 || puntosManuales > 0
        },
        ultimaActualizacion: antiguedadFullMs === null
            ? null
            : new Date(Date.now() - antiguedadFullMs).toISOString()
    };
}

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
    const filePath = path.join(__dirname, 'data', `puntos_manuales_${matchId}.json`);
    await writeJsonAtomic(filePath, puntos, { validate: Array.isArray });
    return true;
}

async function leerPuntosManuales(matchId) {
    const filePath = path.join(__dirname, 'data', `puntos_manuales_${matchId}.json`);
    const resultado = await readJsonRecoverable(filePath, {
        fallback: [],
        validate: Array.isArray
    });
    if (resultado.recovered) {
        console.warn(`⚠️ Se recuperó puntos_manuales_${matchId}.json desde su respaldo .bak`);
    }
    return resultado.data;
}

function rutaPlantelHistorico(matchId) {
    return path.join(__dirname, 'data', `plantel_${matchId}.json`);
}

async function leerPlantelHistorico(matchId) {
    const guardado = await leerJsonOpcional(rutaPlantelHistorico(matchId), {});
    const puntos = await leerPuntosManuales(matchId);
    return fusionarPlanteles(guardado, plantelDesdePuntos(puntos));
}

async function guardarPlantelHistorico(matchId, plantel = {}) {
    const existente = await leerPlantelHistorico(matchId);
    const fusionado = fusionarPlanteles(existente, plantel);
    const documento = {
        matchId: Number(matchId),
        updatedAt: new Date().toISOString(),
        ...fusionado
    };
    await writeJsonAtomic(rutaPlantelHistorico(matchId), documento);
    return documento;
}

async function leerPuntosOficiales(matchId) {
    const repository = new DataRepository(matchId, path.join(__dirname, 'data'));
    return repository.loadJSON();
}

async function reconciliarPuntosManuales(matchId, puntos, { persistir = true, oficiales = null } = {}) {
    const historialOficial = oficiales || await leerPuntosOficiales(matchId);
    const normalizados = normalizeLegacyEvents(puntos, { matchId });
    const activos = activeEvents(normalizados);
    const resultado = enriquecerPuntosManuales(activos, historialOficial);
    const enriquecidos = new Map(resultado.puntos.map(punto => [punto.eventId, punto]));
    const todos = normalizados.map(punto => enriquecidos.get(punto.eventId) || punto);
    const requierePersistencia = resultado.cambios > 0
        || normalizados.some((punto, index) => punto.eventId !== puntos[index]?.eventId);
    if (persistir && requierePersistencia) await guardarPuntosManuales(matchId, todos);
    return {
        ...resultado,
        puntos: activeEvents(todos),
        todos
    };
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


app.post('/api/puntos', requireOperator, async (req, res) => {
    try {
        const { matchId, punto } = req.body;
        if (!matchId || !punto) {
            return res.status(400).json({ success: false, error: 'Faltan datos: matchId y punto son requeridos' });
        }

        const operacion = await conBloqueoPuntos(matchId, async () => {
            const puntos = normalizeLegacyEvents(await leerPuntosManuales(matchId), { matchId });
            const agregado = appendEvent(puntos, punto, { matchId, source: 'manual' });
            if (agregado.duplicate) return { agregado, duplicate: true };
            const oficiales = await leerPuntosOficiales(matchId);
            const resultado = await reconciliarPuntosManuales(matchId, agregado.events, {
                persistir: false,
                oficiales
            });
            await guardarPuntosManuales(matchId, resultado.todos);
            const puntoGuardado = resultado.todos.find(item => item.eventId === agregado.event.eventId) || agregado.event;
            return { agregado, resultado, puntoGuardado, duplicate: false };
        });
        if (operacion.duplicate) {
            return res.status(200).json({
                success: true,
                duplicate: true,
                message: 'El punto ya estaba guardado; no se duplicó.',
                data: operacion.agregado.event
            });
        }
        const puntoGuardado = operacion.puntoGuardado;
        try {
            await guardarPlantelHistorico(matchId, plantelDesdePuntos([puntoGuardado]));
        } catch (errorPlantel) {
            console.warn('⚠️ El punto se guardó, pero no se pudo actualizar el plantel histórico:', errorPlantel.message);
        }

        emitPuntoManual(matchId, puntoGuardado);

        res.json({
            success: true,
            message: puntoGuardado?.sincronizacionOficial === 'confirmada'
                ? 'Punto guardado y sincronizado con Metro'
                : 'Punto guardado; esperando sincronización oficial',
            reconciliado: puntoGuardado?.sincronizacionOficial === 'confirmada',
            data: puntoGuardado
        });
    } catch (e) {
        console.error('Error en POST /api/puntos:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/plantel/:matchId', async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId, 10);
        if (!Number.isInteger(matchId) || matchId <= 0) {
            return res.status(400).json({ success: false, error: 'Match ID inválido' });
        }
        const plantel = await leerPlantelHistorico(matchId);
        res.json({ success: true, data: plantel });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/plantel/:matchId', requireOperator, async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId, 10);
        if (!Number.isInteger(matchId) || matchId <= 0) {
            return res.status(400).json({ success: false, error: 'Match ID inválido' });
        }
        const plantel = await guardarPlantelHistorico(matchId, req.body || {});
        res.json({ success: true, data: plantel });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/puntos/:matchId', async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId);
        const resultado = await conBloqueoPuntos(matchId, async () => {
            const puntos = await leerPuntosManuales(matchId);
            return reconciliarPuntosManuales(matchId, puntos);
        });
        res.json({
            success: true,
            count: resultado.puntos.length,
            data: resultado.puntos,
            sincronizacion: {
                pendientes: resultado.pendientes,
                conflictos: resultado.conflictos
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/puntos/:matchId/recovery', async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId, 10);
        const set = Math.max(1, parseInt(req.query.set, 10) || 1);
        const puntos = normalizeLegacyEvents(await leerPuntosManuales(matchId), { matchId });
        const oficiales = await leerPuntosOficiales(matchId);
        res.json({
            success: true,
            data: recoveryStatus(puntos, oficiales, set),
            coverage: coverageBySet(puntos, oficiales)
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/puntos/:matchId/recovery', requireOperator, async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId, 10);
        const set = Math.max(1, Number(req.body?.set) || 1);
        const operacion = await conBloqueoPuntos(matchId, async () => {
            const puntos = normalizeLegacyEvents(await leerPuntosManuales(matchId), { matchId });
            const oficiales = await leerPuntosOficiales(matchId);
            const recuperacion = createRecoveryEvents(puntos, oficiales, {
                matchId,
                set,
                homeRotation: req.body?.rotacionLocal,
                awayRotation: req.body?.rotacionVisitante
            });
            if (!recuperacion.created.length) return { recuperacion, oficiales, reconciliado: null };
            const reconciliado = await reconciliarPuntosManuales(matchId, recuperacion.events, {
                persistir: false,
                oficiales
            });
            await guardarPuntosManuales(matchId, reconciliado.todos);
            return { recuperacion, oficiales, reconciliado };
        });
        const { recuperacion, oficiales, reconciliado } = operacion;
        if (!recuperacion.created.length) {
            return res.json({ success: true, created: 0, data: recuperacion.status });
        }
        recuperacion.created.forEach(event => emitPuntoManual(matchId, event));
        res.json({
            success: true,
            created: recuperacion.created.length,
            data: recoveryStatus(reconciliado.todos, oficiales, set),
            points: recuperacion.created
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.patch('/api/puntos/:matchId/:eventId', requireOperator, async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId, 10);
        const camposPermitidos = [
            'equipo',
            'equipoAnota',
            'accion',
            'jugador',
            'jugadorNombre'
        ];
        const cambiosSeguros = Object.fromEntries(
            Object.entries(req.body || {}).filter(([campo]) => camposPermitidos.includes(campo))
        );
        const operacion = await conBloqueoPuntos(matchId, async () => {
            const puntos = normalizeLegacyEvents(await leerPuntosManuales(matchId), { matchId });
            const resultado = updateEvent(puntos, req.params.eventId, cambiosSeguros, { actor: 'operator' });
            if (!resultado.found) return { found: false };
            const oficiales = await leerPuntosOficiales(matchId);
            const reconciliado = await reconciliarPuntosManuales(matchId, resultado.events, {
                persistir: false,
                oficiales
            });
            await guardarPuntosManuales(matchId, reconciliado.todos);
            const actualizado = reconciliado.todos.find(item => item.eventId === req.params.eventId) || resultado.event;
            return { found: true, actualizado };
        });
        if (!operacion.found) return res.status(404).json({ success: false, error: 'Punto no encontrado.' });
        const actualizado = operacion.actualizado;
        io.to(`match:${matchId}`).emit('punto_actualizado', actualizado);
        res.json({ success: true, data: actualizado });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/puntos/:matchId/:eventId', requireOperator, async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId, 10);
        const operacion = await conBloqueoPuntos(matchId, async () => {
            const puntos = normalizeLegacyEvents(await leerPuntosManuales(matchId), { matchId });
            const resultado = voidEvent(puntos, req.params.eventId, { actor: 'operator' });
            if (!resultado.found) return { found: false };
            await guardarPuntosManuales(matchId, resultado.events);
            return { found: true };
        });
        if (!operacion.found) return res.status(404).json({ success: false, error: 'Punto no encontrado.' });
        io.to(`match:${matchId}`).emit('punto_anulado', { eventId: req.params.eventId });
        res.json({ success: true, message: 'Punto anulado sin afectar el resto del partido.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});


io.use(async (socket, next) => {
    try {
        if (esSolicitudDirectaLocal({ address: socket.handshake.address, headers: socket.handshake.headers })
            && socket.handshake.auth?.internalTracker === true) {
            socket.data.session = { role: 'tracker', local: true };
            return next();
        }
        const session = readSessionFromRequest(
            { headers: { cookie: socket.handshake.headers.cookie || '' } },
            await obtenerSecretoAuth()
        );
        if (!session) return next(new Error('UNAUTHORIZED'));
        socket.data.session = session;
        next();
    } catch (error) {
        next(new Error('UNAUTHORIZED'));
    }
});

io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);
    
    socket.on('subscribe', async (matchId) => {
        if (socket.matchId && connectedClients.has(socket.matchId)) {
            connectedClients.get(socket.matchId).delete(socket);
            socket.leave(`match:${socket.matchId}`);
        }
        socket.matchId = matchId;
        socket.join(`match:${matchId}`);
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
        const targetMatchId = matchId || socket.matchId;
        if (connectedClients.has(targetMatchId)) {
            connectedClients.get(targetMatchId).delete(socket);
            if (connectedClients.get(targetMatchId).size === 0) {
                connectedClients.delete(targetMatchId);
            }
        }
        if (targetMatchId) socket.leave(`match:${targetMatchId}`);
        if (!matchId || Number(matchId) === Number(socket.matchId)) socket.matchId = null;
        console.log(`📡 Cliente ${socket.id} desuscrito de partido ${targetMatchId}`);
    });
    
    socket.on('ping_keepalive', () => {});

    socket.on('partido_sin_actividad', (estado) => {
        if (!['operator', 'tracker'].includes(socket.data.session?.role)) return;
        const matchId = estado?.matchId;
        if (!matchId || !connectedClients.has(matchId)) return;
        connectedClients.get(matchId).forEach(client => {
            client.emit('partido_sin_actividad', estado);
        });
    });
    
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
    if (!esSolicitudDirectaLocal({ address: req.socket?.remoteAddress, headers: req.headers })) {
        return res.status(403).json({ success: false, error: 'Webhook disponible solo para el tracker local.' });
    }
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
        data = enriquecerSnapshotsOficiales(data);
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
        const data = enriquecerSnapshotsOficiales(
            JSON.parse(await fs.readFile(`./data/match_${id}.json`, 'utf-8'))
        );
        const lastPoints = data.slice(-n).reverse();
        res.json({ success: true, count: lastPoints.length, data: lastPoints });
    } catch(e) {
        res.status(404).json({ success: false, error: 'Datos no encontrados' });
    }
});

app.get('/api/matches/:id/stats', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = enriquecerSnapshotsOficiales(
            JSON.parse(await fs.readFile(`./data/match_${id}.json`, 'utf-8'))
        );
        
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
    res.json({ success: true, status: 'online', version: APP_VERSION, timestamp: new Date().toISOString(), endpoints: ['GET /api/matches', 'GET /api/matches/:id', 'GET /api/matches/:id/points', 'GET /api/matches/:id/points/last', 'GET /api/matches/:id/stats', 'GET /api/matches/:id/sets', 'GET /api/status', 'GET /api/preparation', 'POST /api/preparation/verify', 'POST /api/preparation/queue', 'DELETE /api/preparation/queue/:id', 'DELETE /api/preparation/active'] });
});

app.get('/api/config', async (req, res) => {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        res.json(JSON.parse(data));
    } catch(e) {
        res.status(404).json({ error: 'Config not found' });
    }
});

app.get('/api/preparation', requireOperator, async (req, res) => {
    try {
        const config = await leerJsonOpcional(CONFIG_PATH, {});
        const matchId = normalizarMatchId(req.query.matchId || config.matchId);
        if (!matchId) {
            return res.status(400).json({ success: false, error: 'Ingresá un Match ID válido.' });
        }
        const resumen = await obtenerResumenPreparacion(matchId, config);
        res.json({
            success: true,
            version: APP_VERSION,
            configuredMatchId: normalizarMatchId(config.matchId),
            partidoActivo: obtenerRespaldoPartido(config, config.matchId),
            partidos: config.partidos || [],
            partidosPreparados: obtenerPartidosPreparados(config),
            ...resumen
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/preparation/verify', requireOperator, async (req, res) => {
    const matchId = normalizarMatchId(req.body?.matchId);
    if (!matchId) {
        return res.status(400).json({ success: false, error: 'Ingresá un Match ID válido.' });
    }
    try {
        const config = await leerJsonOpcional(CONFIG_PATH, {});
        const verificacion = await verificarPartidoMetro(matchId);
        const respaldo = obtenerRespaldoPartido(config, matchId);
        res.json({
            success: true,
            verified: true,
            matchId,
            equipos: {
                ...obtenerEquipos(verificacion.datos, respaldo),
                categoria: respaldo.categoria || null
            },
            cancha: verificacion.cancha,
            estado: verificacion.estado,
            message: verificacion.cancha.completa
                ? 'Partido reconocido y formación disponible.'
                : 'Partido reconocido. La formación todavía puede estar pendiente.'
        });
    } catch (error) {
        const pendienteMetro = esPartidoPendienteMetro(error);
        const status = pendienteMetro ? 404 : 503;
        res.status(status).json({
            success: false,
            verified: false,
            matchId,
            canConfigureManually: pendienteMetro,
            error: pendienteMetro
                ? `Metro todavía no habilitó los datos en vivo del partido ${matchId}. Si el enlace público es correcto, podés prepararlo manualmente.`
                : `No se pudo consultar Metro Vóley: ${error.message}`
        });
    }
});

app.post('/api/preparation/queue', requireOperator, async (req, res) => {
    const matchId = normalizarMatchId(req.body?.matchId);
    if (!matchId) {
        return res.status(400).json({ success: false, error: 'Ingresá un Match ID válido.' });
    }
    try {
        const config = await leerJsonOpcional(CONFIG_PATH, {});
        const activeMatchId = normalizarMatchId(config.matchId);
        if (matchId === activeMatchId) {
            return res.status(409).json({
                success: false,
                error: `El partido ${matchId} ya es el partido activo.`
            });
        }

        let verificacion = null;
        let pendienteMetro = false;
        let sinVerificar = false;
        let avisoMetro = null;
        try {
            verificacion = await verificarPartidoMetro(matchId);
        } catch (error) {
            pendienteMetro = esPartidoPendienteMetro(error);
            sinVerificar = !pendienteMetro;
            avisoMetro = pendienteMetro
                ? 'Metro todavía no habilitó la planilla; el partido quedó preparado.'
                : `No se pudo comprobar Metro en este momento: ${error.message}`;
        }

        const respaldo = obtenerRespaldoPartido(config, matchId);
        const equiposMetro = verificacion
            ? obtenerEquipos(verificacion.datos, respaldo)
            : obtenerEquipos({}, respaldo);
        const reglamento = await leerJsonOpcional(REGLAMENTO_PATH, {});
        const validacion = validarConfiguracionPartido({
            matchId,
            homeTeam: req.body?.homeTeam || equiposMetro.homeTeam,
            awayTeam: req.body?.awayTeam || equiposMetro.awayTeam,
            categoria: req.body?.categoria || respaldo.categoria,
            categoriasPermitidas: reglamento?.reglamento?.categorias || {}
        });
        if (!validacion.valida) {
            return res.status(400).json({ success: false, error: validacion.errores.join(' ') });
        }

        const metroStatus = verificacion
            ? 'verified'
            : pendienteMetro
                ? 'pending'
                : sinVerificar
                    ? 'unverified'
                    : 'unverified';
        const partido = {
            id: validacion.matchId,
            homeTeam: validacion.homeTeam,
            awayTeam: validacion.awayTeam,
            categoria: validacion.categoria,
            metroStatus
        };
        const configActualizada = guardarPartidoPreparado(config, partido);
        await escribirJsonSeguro(CONFIG_PATH, configActualizada);

        res.json({
            success: true,
            partido,
            activeMatchId,
            partidosPreparados: obtenerPartidosPreparados(configActualizada),
            warning: avisoMetro,
            trackerChanged: false
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/preparation/queue/:id', requireOperator, async (req, res) => {
    const matchId = normalizarMatchId(req.params.id);
    if (!matchId) {
        return res.status(400).json({ success: false, error: 'Ingresá un Match ID válido.' });
    }
    try {
        const config = await leerJsonOpcional(CONFIG_PATH, {});
        const estabaPreparado = obtenerPartidosPreparados(config)
            .some(partido => partido.id === matchId);
        if (!estabaPreparado) {
            return res.status(404).json({ success: false, error: 'Ese partido no está en la lista de preparados.' });
        }
        const configActualizada = quitarPartidoPreparado(config, matchId);
        await escribirJsonSeguro(CONFIG_PATH, configActualizada);
        res.json({
            success: true,
            removedMatchId: matchId,
            activeMatchId: normalizarMatchId(config.matchId),
            partidosPreparados: obtenerPartidosPreparados(configActualizada),
            trackerChanged: false
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/preparation/active', requireOperator, async (req, res) => {
    try {
        const config = await leerJsonOpcional(CONFIG_PATH, {});
        const matchId = normalizarMatchId(config.matchId);
        if (!matchId) {
            return res.status(404).json({ success: false, error: 'No hay un partido activo para finalizar.' });
        }
        const configActualizada = finalizarPartidoActivo(config);
        await escribirJsonSeguro(CONFIG_PATH, configActualizada);
        io.emit('pausar_partido', { matchId, source: 'preparation-panel' });
        res.json({
            success: true,
            finalizedMatchId: matchId,
            activeMatchId: null,
            partidosPreparados: obtenerPartidosPreparados(configActualizada),
            preservedPreviousData: true,
            trackerPaused: true
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/config', requireOperator, async (req, res) => {
    const matchId = normalizarMatchId(req.body?.matchId);
    if (!matchId) {
        return res.status(400).json({ success: false, error: 'matchId inválido' });
    }
    try {
        const config = await leerJsonOpcional(CONFIG_PATH, {});
        const permitirSinVerificar = req.body?.allowUnverified === true
            || req.body?.allowPending === true;
        const anteriorMatchId = normalizarMatchId(config.matchId);
        let verificacion = null;
        let pendienteMetro = false;
        let sinVerificar = false;
        let avisoMetro = null;
        if (anteriorMatchId !== matchId || config.metroStatus !== 'verified') {
            try {
                verificacion = await verificarPartidoMetro(matchId);
            } catch (error) {
                if (!permitirSinVerificar) throw error;
                pendienteMetro = esPartidoPendienteMetro(error);
                sinVerificar = !pendienteMetro;
                avisoMetro = pendienteMetro
                    ? 'Metro todavía no habilitó la planilla; el partido quedó preparado.'
                    : `No se pudo comprobar Metro en este momento: ${error.message}`;
            }
        }
        const respaldo = obtenerRespaldoPartido(config, matchId);
        const equiposMetro = verificacion
            ? obtenerEquipos(verificacion.datos, respaldo)
            : obtenerEquipos({}, respaldo);
        let homeTeam = String(req.body.homeTeam || equiposMetro.homeTeam || 'LOCAL').trim();
        let awayTeam = String(req.body.awayTeam || equiposMetro.awayTeam || 'VISITANTE').trim();
        let categoria = String(req.body.categoria || respaldo.categoria || '').trim();

        const reglamento = await leerJsonOpcional(REGLAMENTO_PATH, {});
        const validacion = validarConfiguracionPartido({
            matchId,
            homeTeam,
            awayTeam,
            categoria,
            categoriasPermitidas: reglamento?.reglamento?.categorias || {}
        });
        if (!validacion.valida) {
            return res.status(400).json({
                success: false,
                pendingMetro: pendienteMetro,
                error: validacion.errores.join(' ')
            });
        }
        ({ homeTeam, awayTeam, categoria } = validacion);

        const metroStatus = verificacion
            ? 'verified'
            : pendienteMetro
                ? 'pending'
                : sinVerificar
                    ? 'unverified'
                    : config.metroStatus || 'unverified';
        const configActualizada = aplicarPartidoActivo(config, {
            matchId,
            homeTeam,
            awayTeam,
            categoria,
            metroStatus
        });

        await escribirJsonSeguro(CONFIG_PATH, configActualizada);
        if (anteriorMatchId !== matchId) {
            io.emit('cambiar_partido', { matchId, source: 'preparation-panel' });
        }
        res.json({
            success: true,
            matchId,
            previousMatchId: anteriorMatchId,
            homeTeam,
            awayTeam,
            categoria: categoria || null,
            verified: metroStatus === 'verified',
            pendingMetro: pendienteMetro,
            unverified: metroStatus === 'unverified',
            metroStatus,
            warning: avisoMetro,
            trackerNotified: anteriorMatchId !== matchId,
            preservedPreviousData: true
        });
    } catch(error) {
        const status = error.statusCode === 404 ? 404 : 503;
        res.status(status).json({
            success: false,
            error: error.statusCode === 404
                ? `Metro Vóley no encontró el partido ${matchId}. No se modificó la configuración.`
                : `No se pudo verificar el partido. No se modificó la configuración: ${error.message}`
        });
    }
});

app.get('/api/club-profile', async (req, res) => {
    const profile = await leerJsonOpcional(CLUB_PROFILE_PATH, {});
    res.json({
        success: true,
        data: {
            clubName: String(profile.clubName || 'VoleyInsight'),
            mainTeam: String(profile.mainTeam || 'ATTITUDE'),
            logoUrl: String(profile.logoUrl || '/dashboard/logo-horizontal.png'),
            primaryColor: String(profile.primaryColor || '#5b6ee1'),
            secondaryColor: String(profile.secondaryColor || '#7c3aed')
        }
    });
});

app.put('/api/club-profile', requireOperator, async (req, res) => {
    const cleanColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : null;
    const profile = {
        clubName: String(req.body?.clubName || 'VoleyInsight').trim().slice(0, 80),
        mainTeam: String(req.body?.mainTeam || 'ATTITUDE').trim().slice(0, 80),
        logoUrl: String(req.body?.logoUrl || '/dashboard/logo-horizontal.png').trim().slice(0, 500),
        primaryColor: cleanColor(req.body?.primaryColor) || '#5b6ee1',
        secondaryColor: cleanColor(req.body?.secondaryColor) || '#7c3aed',
        updatedAt: new Date().toISOString()
    };
    await escribirJsonSeguro(CLUB_PROFILE_PATH, profile);
    res.json({ success: true, data: profile });
});

app.use('/data', requireAuthenticated, express.static('./data', { dotfiles: 'deny' }));

app.use('/dashboard', express.static('./dashboard'));

app.get('/', (req, res) => {
    res.redirect('/dashboard/index.html');
});

server.listen(PORT, () => {
    console.log(`

╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🏐 VOLEYINSIGHT v${APP_VERSION} - SERVIDOR API + WEBSOCKET         ║
║                                                              ║
║   📡 API REST: http://localhost:${PORT}/api/status           ║
║   🔌 WebSocket: ws://localhost:${PORT}                       ║
║   🖥️Dashboard: http://localhost:${PORT}/dashboard/index.html║
║                                                               ║
╚══════════════════════════════════════════════════════════════╝
    `);
});
