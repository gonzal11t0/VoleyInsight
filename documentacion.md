📚 DOCUMENTACIÓN TÉCNICA COMPLETA — VOLEYINSIGHT v3.2.1

**Última actualización:** 6 de noviembre de 2026
**Commit vigente:** `eeee450`
**Estado:** Producción

---

## 1. DESCRIPCIÓN GENERAL

VoleyInsight es un sistema de análisis de partidos de voleibol en tiempo real que:

- Captura datos automáticos desde la API de Metro Vóley cada 3 segundos (con WebSocket para tiempo real).
- Permite anotación manual de puntos y estadísticas individuales con atajos de teclado.
- Visualiza análisis en un dashboard profesional con cuatro vistas: **PARTIDO**, **INDIVIDUALES**, **EVOLUCIÓN** y **ANOTADOR**.
- Exporta reportes en formato HTML con gráficos como imágenes base64 y glosario de métricas.
- Permite análisis evolutivo: compara múltiples partidos subiendo los reportes HTML generados.
- Funciona offline con datos cacheados (Service Worker + IndexedDB).
- Expone una API REST propia para consultar datos programáticamente.
- Analiza tiempos muertos con registro manual y cálculo de efectividad.
- Calcula Sideout%, Breakpoint%, Clutch%, fases del set y rachas.
- Estadísticas de servicio, recepción y defensa por jugador.
- **Selector de partidos** para cambiar entre partidos históricos, activos y preparados desde el dashboard (funciona en PC y celular).
- **Resuscripción WebSocket** automática al cambiar de partido.
- **Túnel único** de Cloudflare publica Dashboard, API y WebSocket desde el puerto 5501.
- **Autenticación por roles** con selector Público/Operador. Público entra sin contraseña (solo lectura); Operador requiere contraseña.

### Novedades v3.2.1

- El operador puede quitar partidos del **HISTORIAL** del selector de partido: uno por uno con "QUITAR DEL HISTORIAL" o todos con "LIMPIAR HISTORIAL". Solo se modifica la lista de `config.json`; los archivos de datos y los informes se conservan. El partido activo y los próximos no se tocan.
- El rol **Público** ya no recibe `partidosPreparados` en `/api/config`: el fixture futuro deja de ser visible sin credenciales de operador.
- **Validación estricta de `matchId` y `set`** en todos los endpoints que construyen rutas de archivo (path traversal cerrado).
- **Timeout de 5 segundos** en la descarga del HTML de Metro Vóley desde el tracker. El tracker ya no se bloquea si Metro tarda o se cuelga.
- **Cacheo robusto del roster**: si Metro devuelve el roster vacío, el tracker reintenta cada 30 segundos sin bloquear el polling.
- **Auditoría de dependencias**: `npm audit` sin vulnerabilidades `high` ni `moderate` en producción (`minimatch` queda en `nodemon`, que es dev-only).

### Novedades v3.2.0

- Pantalla de ingreso con selector Público/Operador.
- Sesión de 30 días firmada con HMAC-SHA256, cookie `HttpOnly` y `SameSite=Lax`.
- Rate limiting de login: 5 intentos fallidos cada 10 minutos, bloqueo de 15 minutos por IP.

---

## 2. ARQUITECTURA DEL SISTEMA
┌─────────────────────────────────────────────────────────────────────────────┐
│ VOLEYINSIGHT - ARQUITECTURA │
├─────────────────────────────────────────────────────────────────────────────┤
│ │
│ ┌─────────────────────┐ ┌─────────────────────┐ │
│ │ API Metro Vóley │ │ App de Anotación │ │
│ │ (fuente externa) │ │ (anotador.html) │ │
│ └──────────┬──────────┘ └──────────┬──────────┘ │
│ │ │ │
│ ▼ ▼ │
│ ┌─────────────────────┐ ┌─────────────────────┐ │
│ │ Tracker (Node.js) │ │ localStorage / │ │
│ │ (WebSocket + Polling) │ IndexedDB │ │
│ └──────────┬──────────┘ └──────────┬──────────┘ │
│ │ │ │
│ ▼ ▼ │
│ ┌─────────────────────┐ ┌─────────────────────┐ │
│ │ match_XXXXX.json │ │ timeouts_XXXXX │ │
│ │ full_XXXXX.json │ │ puntos_XXXXX │ │
│ │ court_XXXXX.json │ │ marcas_XXXXX │ │
│ │ formacion_*.json │ │ │ │
│ └──────────┬──────────┘ └──────────┬──────────┘ │
│ │ │ │
│ └─────────────┬─────────────┘ │
│ ▼ │
│ ┌─────────────────────────────────────┐ │
│ │ DASHBOARD │ │
│ │ index.html │ │
│ │ │ │
│ │ 📊 VISTA PARTIDO (en vivo) │ │
│ │ 👕 VISTA INDIVIDUAL (por jugador) │ │
│ │ 📈 VISTA EVOLUCIÓN (comparativa) │ │
│ │ 🏐 VISTA ANOTADOR (manual) │ │
│ │ 🆕 SELECTOR DE PARTIDOS │ │
│ │ │ │
│ │ 💾 Exportar HTML 📡 Modo offline │ │
│ │ ⏸️ Tiempos muertos 📊 Sideout/Break │ │
│ └─────────────────────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────┐ │
│ │ API REST propia │ │
│ │ WebSocket Server │ │
│ │ Auth (HMAC + JWT-like) │
│ └─────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ACCESO REMOTO │ │
│ │ Cloudflare Tunnel → Dashboard + API + WebSocket (puerto 5501) │ │
│ │ El frontend usa el mismo origen para todos los servicios │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │
└─────────────────────────────────────────────────────────────────────────────┘

text

---

## 3. ESTRUCTURA DE ARCHIVOS (ACTUALIZADA)
VoleyInsight/
├── server-api.js # Servidor Express (puerto 5501): API + WebSocket + estáticos
├── index.js # Punto de entrada del tracker
├── iniciar-partido.bat # Lanzador Windows (3 procesos: API, tracker, túnel)
├── package.json # Dependencias y scripts
├── README.md
├── documentacion.md # Este archivo
├── documentación comercial.md
├── patch_roster.js # Script de un solo uso para enriquecer partidos viejos
├── .env # Contraseñas locales (NO en Git)
├── .env.example
├── .gitignore
│
├── dashboard/
│ ├── index.html # Dashboard principal (4 pestañas + selector)
│ ├── anotador.html # App de anotación manual
│ ├── logo-horizontal.png
│ ├── logo.png
│ ├── logo-icon-192.png
│ ├── logo-icon-512.png
│ ├── favicon-64.png
│ ├── site.webmanifest
│ └── js/
│ ├── dashboard.js # Lógica principal (selector, resuscripción WS, métricas)
│ ├── anotador.js # Lógica del anotador manual
│ ├── reporteGenerator.js # Generación de reportes HTML
│ ├── StatsHelper.js # Estadísticas por jugador
│ ├── rotacionHelper.js # Cálculo de rotaciones 1-6
│ ├── metricasVoleyHelper.js # Métricas estándar (Sideout, Breakpoint)
│ ├── partidoHelper.js # Estado oficial del partido, sets
│ ├── comparativaHelper.js # Comparación de informes
│ ├── setSummaryHelper.js # Resumen automático de sets
│ ├── timeoutHelper.js # Deduplicación de timeouts
│ ├── utils.js # OfflineManager, SoundManager
│ └── sw.js # Service Worker para modo offline
│
├── src/
│ ├── core/
│ │ ├── tracker.js # Fetch Metro cada 3s, roster HTML, WebSocket
│ │ ├── stateProcessor.js # Procesa estados, rallies, breakpoints
│ │ ├── preparationStatus.js # Validación de partidos y config
│ │ ├── eventEngine.js # Normalización de eventos manuales
│ │ ├── auth.js # HMAC-SHA256, cookies, sesiones
│ │ ├── loginGuard.js # Rate limiting de login
│ │ ├── authConfig.js # Lectura de contraseñas de .env
│ │ ├── rosterHistory.js # Fusión de planteles
│ │ ├── rotationHistory.js # Historial de rotaciones
│ │ └── activityStatus.js # Detección de inactividad
│ ├── services/
│ │ ├── api.js # Conexión con Metro Vóley (timeout + retry)
│ │ └── websocket.js # Stub (no usado, conexión real va por socket.io-client)
│ ├── analytics/
│ │ ├── performanceAnalyzer.js
│ │ └── volleyballMetrics.js
│ ├── repositories/
│ │ └── dataRepository.js
│ ├── export/
│ │ └── htmlExporter.js
│ ├── utils/
│ │ ├── atomicFile.js # Escritura atómica + respaldos .bak
│ │ └── logger.js
│ └── config.js
│
├── data/
│ ├── config.json # { matchId, homeTeam, awayTeam, categoria, partidos[], partidosPreparados[] }
│ ├── reglamento.json # Configuración de sets por categoría
│ ├── club-profile.json # Perfil del club (nombre, colores, logo)
│ ├── .auth_secret # Secreto HMAC (generado, permisos 0600)
│ ├── match_XXXXX.json # Puntos del partido (automático)
│ ├── match_XXXXX.csv # Puntos en CSV
│ ├── full_XXXXX.json # Snapshot completo de la API
│ ├── court_XXXXX.json # Formación actual
│ ├── formacion_inicial_XXXXX_set_N.json # Formación inicial del set N
│ ├── plantel_XXXXX.json # Mapa dorsal → nombre
│ ├── puntos_manuales_XXXXX.json # Puntos anotados manualmente
│ ├── analysis_XXXXX.json # Análisis de rendimiento
│ ├── tracker_status_XXXXX.json # Estado del tracker
│ └── informes/ # Informes HTML importantes (no en Git)
│
└── tests/ # 15 tests automatizados
├── auth.test.mjs
├── authConfig.test.cjs
├── loginGuard.test.cjs
├── eventEngine.test.cjs
├── persistenceSafety.test.cjs
├── rotationState.test.cjs
├── trackerActiveState.test.cjs
├── formacionHelper.test.mjs
├── rotacionHelper.test.mjs
├── metricasVoleyHelper.test.mjs
├── reportConsistency.test.mjs
├── comparativaHelper.test.mjs
├── setSummaryHelper.test.mjs
├── timeoutHelper.test.mjs
├── partidoStatus.test.mjs
└── preparationStatus.test.mjs

text

---

## 4. COMPONENTES DEL SISTEMA

### 4.1 Tracker (Node.js)

| Archivo | Función |
|---|---|
| `index.js` | Punto de entrada, lee `config.json`, maneja errores globales |
| `src/core/tracker.js` | Fetch cada 3s, procesa datos, guarda JSON, emite por WebSocket |
| `src/services/api.js` | Conexión con API de Metro Vóley con timeout y retry |
| `src/core/stateProcessor.js` | Calcula rachas, breakpoints, fases y eventos |

**Funcionalidades del tracker:**

- Monitoreo de `config.json` cada 5 segundos (`configMonitorInterval`).
- Cambio automático de partido al detectar nuevo `matchId`.
- Método `crearArchivoPartidoVacio()` para inicializar archivos JSON.
- Escucha evento WebSocket `cambiar_partido` y `pausar_partido`.
- Descarga del HTML de Metro `/matches/{id}/players` para extraer nombres reales (vía `data-page` embebido de Inertia.js).
- **Timeout de 5 segundos** en el fetch del roster (`AbortSignal.timeout(5000)`).
- **Reintento cada 30 segundos** si el roster viene vacío (Metro tarda ~4 min en generarlo la primera vez).
- Guarda `full_*.json` **solo si hay formación**, para no pisar el archivo con `liveState: null` al terminar el partido.
- Guarda `court_*.json` y `formacion_inicial_*.json` para tener formación histórica por set.

**Comandos:**

```bash
npm start          # Iniciar tracker (también npm run tracker)
npm run watch      # Monitor en vivo (nodemon)
4.2 Dashboard (index.html)
Sección	Contenido
Header	Marcador en tiempo real, nombres de equipos, badge de saque
Pestañas	PARTIDO / INDIVIDUALES / EVOLUCIÓN / ANOTADOR (4 vistas)
Selector	Panel flotante con selector de partidos (cambia ID y nombres)
Vista PARTIDO	Stats grid (8 métricas), gráficos (4), dominancia por set, breakpoints, insights, timeline, servicio, Sideout% y Breakpoint%
Vista INDIVIDUALES	Filtros por set, tablas de jugadores (servicio, recepción, defensa), TOP 5, gráfico de puntos, tiempos muertos
Vista EVOLUCIÓN	Subida de reportes HTML, análisis comparativo, tabla evolutiva, gráfico de tendencias
Vista ANOTADOR	Anotación manual: ATAQUE, BLOQUEO, SAQUE, SAQUE MALO, ERROR, REC+, REC-, DEF+, DEF-
Botones funcionales:

Botón	Función
📊 PARTIDO / 👕 INDIVIDUALES / 📈 EVOLUCIÓN / 🏐 ANOTADOR	Cambiar vista
💾 Guardar	Exportar reporte HTML con gráficos
🔄 Actualizar	Recargar datos manualmente
🔊 Sonidos	Activar/desactivar sonidos
⏱️ Selector de refresco	5s, 10s, 15s
📡 Modo offline	Forzar uso de datos cacheados
🗑️ QUITAR DE PRÓXIMOS	Quitar partido preparado
🗑️ QUITAR DEL HISTORIAL	Quitar partido del historial
🧹 LIMPIAR HISTORIAL	Vaciar historial (excepto activo)
🏁 FINALIZAR ACTIVO	Cerrar partido activo (tracker queda en espera)
Funciones clave en dashboard.js:

obtenerUrlApi(): usa el mismo origen desde el que se abrió el dashboard.

setupSelectorPartido(): maneja el cambio de partido con resuscripción WebSocket.

limpiarDatosPartidoEspecifico(matchId): limpia localStorage del partido.

verificarConsistenciaYLimpiar(): detecta y corrige mezcla de datos.

Ping keepalive cada 25 segundos (para mantener túneles activos).

obtenerEquipoAnalisis(): detecta ATTITUDE y analiza siempre a ese equipo (o LOCAL).

cargarRosterDesdeHTML() (en tracker.js): descarga el HTML de Metro, extrae data-page, cruza por matchTeamPlayerId, y enriquece el court antes de procesar.

4.3 App de Anotación (anotador.html)
Pantalla	Función
Configuración	Armar equipos (agregar/eliminar números, marcar líberos)
Anotación	Seleccionar equipo → jugador → acción → confirmar punto
Acciones disponibles:

Acción	¿Necesita jugador?	Qué pasa
ATAQUE	✅ Sí	Punto para tu equipo
BLOQUEO	✅ Sí	Punto para tu equipo
SAQUE	✅ Sí	Punto para tu equipo (stats de servicio)
SAQUE MALO	✅ Sí	Punto para el otro equipo (error de saque)
ERROR	✅ Sí	Punto para el otro equipo (error de ataque/genérico)
REC+	✅ Sí	Registra recepción positiva (NO suma punto)
REC-	✅ Sí	Registra recepción negativa (NO suma punto)
DEF+	✅ Sí	Registra defensa positiva (NO suma punto)
DEF-	✅ Sí	Registra defensa negativa (NO suma punto)
TIMEOUT	❌ No	Registra tiempo muerto
MARCAR CLAVE	❌ No	Guarda observación manual sin alterar métricas automáticas
Atajos de teclado:

Tecla	Acción	Tecla	Acción
Q	LOCAL	W	VISITANTE
1	ATAQUE	2	BLOQUEO
3	SAQUE	4	SAQUE MALO
5	REC+	6	REC-
7	DEF+	8	DEF-
9	ERROR	B	MARCAR CLAVE
T	TIMEOUT	Enter	Confirmar
Z	Deshacer	0-9	Seleccionar jugador
+ / -	Navegar jugador		
4.4 API REST Propia
Todos los endpoints requieren sesión válida excepto los marcados con ❌.

Endpoint	Método	Auth	Descripción
/api/status	GET	❌	Estado del servidor
/api/auth/login	POST	❌	Login Público/Operador
/api/auth/session	GET	✅	Datos de la sesión activa
/api/auth/logout	POST	❌	Cerrar sesión
/api/config	GET	✅	Configuración (sin partidosPreparados para público)
/api/config	POST	operator	Actualizar partido activo
/api/club-profile	GET	✅	Perfil del club
/api/club-profile	PUT	operator	Actualizar perfil
/api/matches	GET	✅	Lista todos los partidos
/api/matches/:id	GET	✅	Datos generales del partido
/api/matches/:id/points	GET	✅	Todos los puntos (?set=2)
/api/matches/:id/points/last?n=10	GET	✅	Últimos N puntos
/api/matches/:id/stats	GET	✅	Estadísticas resumidas
/api/matches/:id/sets	GET	✅	Resultados por set
/api/formacion/:matchId/:set	GET	✅	Formación inicial del set
/api/court/:matchId	GET	✅	Court actual
/api/plantel/:matchId	GET	✅	Mapa dorsal → nombre
/api/plantel/:matchId	POST	operator	Actualizar plantel
/api/puntos	POST	operator	Guardar punto manual
/api/puntos/:matchId	GET	✅	Puntos manuales reconciliados
/api/puntos/:matchId/recovery	GET	✅	Estado de recuperación
/api/puntos/:matchId/recovery	POST	operator	Crear eventos de recuperación
/api/puntos/:matchId/:eventId	PATCH	operator	Corregir evento
/api/puntos/:matchId/:eventId	DELETE	operator	Anular evento
/api/preparation	GET	operator	Estado de preparación
/api/preparation/verify	POST	operator	Verificar partido en Metro
/api/preparation/queue	POST	operator	Preparar partido
/api/preparation/queue/:id	DELETE	operator	Quitar de preparados
/api/preparation/history	DELETE	operator	Limpiar historial
/api/preparation/history/:id	DELETE	operator	Quitar partido del historial
/api/preparation/active	DELETE	operator	Finalizar partido activo
/api/webhook/point	POST	local only	Webhook del tracker
4.5 WebSocket en Tiempo Real
Característica	Descripción
Conexión	Persistente entre dashboard y servidor
Auth	Requiere sesión válida (cookie) o internalTracker: true desde localhost
Eventos	new_point, punto_manual, punto_actualizado, punto_anulado, partido_terminado, partido_sin_actividad
Suscripción	Por matchId (subscribe / unsubscribe)
Cambio de partido	Evento cambiar_partido (tracker) y resuscripción manual (dashboard)
Ping keepalive	Evento ping_keepalive cada 25 segundos
Fallback	Vuelve a polling (3s) si WebSocket falla
Resuscripción en el dashboard:

javascript
if (this.socket) {
    if (this.socket.connected) {
        this.socket.emit('unsubscribe', idAnterior);
        this.socket.emit('subscribe', nuevoId);
    } else {
        this.socket.connect();
        this.socket.once('connect', () => {
            this.socket.emit('subscribe', nuevoId);
        });
    }
}
4.6 CORS en server-api.js
javascript
const corsOptions = {
    origin: true,   // Permite cualquier origen (útil para túneles)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

// Socket.IO con CORS
const io = socketIo(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST'],
        credentials: true,
        transports: ['polling', 'websocket']
    }
});
Nota de seguridad: origin: true con credentials: true es aceptable en este caso porque la cookie de sesión tiene SameSite=Lax, lo que bloquea requests cross-origin con credenciales. La combinación origin: true + SameSite=Lax está auditada y no permite CSRF.

4.7 Túnel para acceso remoto
Servicio	Puerto	Comando	URL
Cloudflare	5501 (sistema completo)	cloudflared tunnel --url http://localhost:5501	https://xxxx.trycloudflare.com
El dashboard, la API REST y el WebSocket comparten la misma URL.

5. FLUJO DE DATOS
text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUJO DE DATOS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. TRACKER                                                                 │
│     ├── Fetch a API Metro Vóley cada 3 segundos                             │
│     ├── Fetch al HTML de /players para nombres reales (timeout 5s)          │
│     ├── Procesa snapshot (rachas, breakpoints, eventos)                     │
│     ├── Emite punto por WebSocket al servidor                               │
│     ├── Guarda en data/match_XXXXX.json y full_XXXXX.json                   │
│     ├── Guarda court_XXXXX.json y formacion_inicial_*.json                  │
│     └── Monitorea data/config.json cada 5 segundos                          │
│                                                                             │
│  2. SERVIDOR API + WEBSOCKET                                                │
│     ├── Valida sesión (HMAC-SHA256, cookie HttpOnly, SameSite=Lax)          │
│     ├── Aplica rate limiting en login                                       │
│     ├── Recibe puntos por WebSocket o webhook                               │
│     ├── Reenvía puntos a todos los dashboards conectados                    │
│     ├── Sirve archivos estáticos y API REST                                 │
│     ├── Valida matchId/set antes de construir rutas de archivo              │
│     └── Filtra partidosPreparados para el rol público                       │
│                                                                             │
│  3. DASHBOARD (PC - localhost)                                              │
│     ├── Conecta WebSocket a localhost:5501                                  │
│     ├── Lee data/config.json, match_*.json, full_*.json                     │
│     ├── Calcula Sideout% y Breakpoint%                                      │
│     └── Selector de partidos: cambia ID, nombres y datos                    │
│                                                                             │
│  4. DASHBOARD (Celular - remoto)                                            │
│     ├── Conecta WebSocket al mismo origen publicado por Cloudflare          │
│     ├── Lee data/config.json, match_*.json a través del túnel               │
│     ├── Selector: envía POST a la API y resuscribe WebSocket                │
│     └── Ping keepalive cada 25 segundos                                     │
│                                                                             │
│  5. APP DE ANOTACIÓN                                                        │
│     ├── Configura equipos (números, líberos)                                │
│     ├── Anota puntos (jugador, acción, asistencia)                          │
│     ├── Registra tiempos muertos y marcas manuales                          │
│     └── Guarda en localStorage y exporta a JSON                             │
│                                                                             │
│  6. ANÁLISIS EVOLUTIVO                                                      │
│     ├── Usuario sube reportes HTML generados previamente                    │
│     ├── Sistema extrae métricas clave de cada reporte                       │
│     └── Genera tabla comparativa y gráfico de tendencias                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
6. CONFIGURACIÓN
6.1 Archivo data/config.json
json
{
  "matchId": 260314,
  "homeTeam": "L.HERAS B",
  "awayTeam": "ATTITUDE",
  "categoria": "sub-16",
  "metroStatus": "verified",
  "partidos": [
    { "id": 77702, "homeTeam": "L.HERAS B", "awayTeam": "ATTITUDE", "categoria": "sub-16" }
  ],
  "partidosPreparados": []
}
Campo	Descripción
matchId	ID del partido actual en Metro Vóley
homeTeam	Nombre del equipo LOCAL
awayTeam	Nombre del equipo VISITANTE
categoria	Categoría del partido (ej: "sub-19", "mayores")
metroStatus	verified / pending / unverified
partidos	Historial de partidos disponibles en el selector
partidosPreparados	Próximos partidos ya configurados (no visible al público)
6.2 Archivo data/reglamento.json
json
{
  "reglamento": {
    "categorias": {
      "sub-19": { "max_sets": 3, "sets_para_ganar": 2, "puntos_por_set": 25, "set_decisivo_puntos": 15 },
      "mayores": { "max_sets": 5, "sets_para_ganar": 3, "puntos_por_set": 25, "set_decisivo_puntos": 15 },
      "sub-16": { "max_sets": 3, "sets_para_ganar": 2, "puntos_por_set": 25, "set_decisivo_puntos": 15 },
      "sub-13": { "max_sets": 3, "sets_para_ganar": 2, "puntos_por_set": 25, "set_decisivo_puntos": 15 }
    }
  }
}
Atención: si reglamento.json falta o la categoría no está definida, el dashboard usa valores por defecto (maxSets: 3, setsParaGanar: 2), lo que puede dar mal el "partido terminado" en categorías que juegan al mejor de 5.

6.3 Archivo .env
env
PORT=5501
VOLEY_OPERATOR_PASSWORD=<contraseña privada del operador>   # obligatoria
VOLEY_PUBLIC_PASSWORD=<contraseña de referencia>            # requerida al arrancar, ya no se usa para login
VOLEY_SESSION_SECRET=<opcional; si falta, se genera aleatorio en data/.auth_secret>
LOCAL_SERVER_URL=http://localhost:5501
POLL_INTERVAL_MS=3000
SAVE_INTERVAL_MS=10000
API_BASE_URL=https://metrovoley.com.ar/api/matches
API_TIMEOUT_MS=10000
API_RETRY_ATTEMPTS=3
API_RETRY_BACKOFF_MS=1000
LOG_LEVEL=info
.env está en .gitignore y nunca debe subirse al repositorio.

6.4 Túnel
bash
# Publica Dashboard, API REST y WebSocket
cloudflared tunnel --url http://localhost:5501
7. MÉTRICAS CALCULADAS
Métrica	Cálculo	Qué indica
Racha	Puntos consecutivos del mismo equipo	Dominio momentáneo
Breakpoint ganado	Punto anotado mientras el equipo saca	Producción de saque, bloqueo y defensa
Eficiencia	(Puntos propios / Puntos totales) × 100	Control general del partido
Clutch	% de puntos ganados en momentos críticos (set point o diferencia ≤2)	Temple bajo presión
Fase	EARLY (1-10), MID (11-20), LATE (21+)	Rendimiento por momento del set
Momentum	Diferencia de puntos en últimos 5 puntos	Quién viene dominando
Sets	Según reglamento por categoría (25/15 pts, diferencia 2)	Regla oficial de voleibol
Eficiencia Servicio	(SAQUE - Errores) / Total saques × 100	Efectividad del saque
Sideout%	(Puntos ganados al recibir / Total recepciones) × 100	Recepción y primer ataque
Breakpoint%	(Puntos ganados con saque propio / Total saques) × 100	Presión de saque y bloqueo-defensa
Eficiencia Recepción	(REC+ / Total Recepciones) × 100	Calidad de recepción de saque
Eficiencia Defensa	(DEF+ / Total Defensas) × 100	Calidad defensiva
8. EVENTOS Y SONIDOS
Evento	Sonido	Frecuencia
Punto LOCAL	Tono agudo	880 Hz
Punto VISITANTE	Tono grave	440 Hz
Fin del partido	Fanfarria 3 notas	523-659-783 Hz
9. LANZAMIENTO DEL SISTEMA
9.1 Usando iniciar-partido.bat (Windows)
batch
@echo off
title VoleyInsight - Sistema Completo
color 0A
chcp 65001 >nul
cd /d "%~dp0"
taskkill /f /im cloudflared.exe >nul 2>&1

echo [1/3] Iniciando API + Dashboard + WebSocket...
start "API Server" cmd /k "node server-api.js"
timeout /t 3 /nobreak >nul

echo [2/3] Iniciando tracker...
start "Tracker" cmd /k "npm run tracker"
timeout /t 3 /nobreak >nul

echo [3/3] Iniciando Cloudflare Tunnel...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:5501"
timeout /t 5 /nobreak >nul

echo ========================================
echo    🚀 SISTEMA ACTIVO
echo ========================================
echo.
echo 📱 Dashboard (compartir): mirá la ventana "Cloudflare Tunnel"
echo.
pause
9.2 Manualmente
bash
# Terminal 1 - Servidor API + WebSocket
node server-api.js

# Terminal 2 - Tracker
npm run tracker

# Terminal 3 - Cloudflare Tunnel
cloudflared tunnel --url http://localhost:5501

# Navegador (local)
http://localhost:5501/dashboard/index.html
http://localhost:5501/dashboard/anotador.html
9.3 Cómo apagar
Ctrl+C en cada una de las 3 ventanas (API, tracker, túnel). El sistema queda listo para el próximo arranque.

Importante: si editás server-api.js o tracker.js mientras corren, Node no recarga el archivo. Siempre Ctrl+C y reinicio después de cambios.

10. URLS IMPORTANTES
Recurso	URL local	URL remota (túnel)
Dashboard	http://localhost:5501/dashboard/index.html	https://xxxx.trycloudflare.com/dashboard/index.html
Anotador	http://localhost:5501/dashboard/anotador.html	https://xxxx.trycloudflare.com/dashboard/anotador.html
API Status	http://localhost:5501/api/status	https://xxxx.trycloudflare.com/api/status
API Config	http://localhost:5501/api/config	https://xxxx.trycloudflare.com/api/config
WebSocket	ws://localhost:5501	wss://xxxx.trycloudflare.com (con Socket.IO)
Acceso: la pantalla inicial tiene un selector Público/Operador. Público crea la sesión (30 días) sin contraseña. Operador pide la contraseña de VOLEY_OPERATOR_PASSWORD, con límite de intentos fallidos.

11. SEGURIDAD
11.1 Autenticación
HMAC-SHA256 para firmar sesiones (src/core/auth.js).

Cookie voleyinsight_session: HttpOnly, SameSite=Lax, 30 días de duración.

Secreto de sesión: crypto.randomBytes(48) en data/.auth_secret (permisos 0600). Si VOLEY_SESSION_SECRET está en .env, se usa ese.

Comparaciones con crypto.timingSafeEqual para evitar timing attacks.

11.2 Rate limiting
5 intentos fallidos cada 10 minutos → bloqueo de 15 minutos por IP.

El rol Público no consume intentos (se loguea sin contraseña).

11.3 Separación de roles
Público: solo lectura. No puede anotar, cambiar partidos, borrar eventos, finalizar partidos, ni ver el fixture de próximos partidos.

Operador: acceso completo.

11.4 Validación de parámetros
Todos los endpoints que construyen rutas de archivo validan matchId y set como enteros positivos antes de acceder al disco:

javascript
const matchId = parseInt(req.params.matchId, 10);
if (!Number.isInteger(matchId) || matchId <= 0) {
    return res.status(400).json({ success: false, error: 'Match ID inválido' });
}
Esto cierra la puerta a path traversal (por ejemplo, GET /api/court/..%2Fconfig devuelve 400 y no lee config.json).

11.5 Timeout en llamadas externas
Fetch al HTML de Metro: AbortSignal.timeout(5000).

Fetch a la API de Metro: timeout configurable + retry con backoff.

11.6 Persistencia atómica
Todos los archivos de datos se escriben con writeJsonAtomic:

Escritura a archivo temporal con fsync.

Validación de sintaxis del contenido serializado.

Reemplazo con rename (o rename + rename con recuperación en Windows).

Respaldo .bak previo del archivo anterior.

Si un archivo queda corrupto, readJsonRecoverable lo recupera automáticamente desde su .bak.

11.7 Filtrado de datos sensibles
/api/config no expone partidosPreparados al rol público.

/data/ está protegido por requireAuthenticated y dotfiles: 'deny' (bloquea .auth_secret y .env).

.env está en .gitignore.

.gitignore cubre data/campeonato oficial/, data/**/*.html, data/**/*.pdf, Preview/reportes/, *.bak, cookies*.txt.

11.8 Auditoría de dependencias
npm audit se corre antes de cada release.

Estado actual: solo minimatch con severidad moderate en nodemon (dev-only). No correr npm audit fix --force porque degradaría nodemon a 1.0.2.

12. FORMATOS DE ARCHIVO
12.1 match_XXXXX.json (puntos del partido)
json
[{
  "timestamp": "2026-04-23T20:00:33.338Z",
  "set": 1,
  "homeTeam": "CAIT B",
  "awayTeam": "ATTITUDE",
  "homeScore": 1,
  "awayScore": 3,
  "scorer": null,
  "serving": "HOME",
  "homeRun": 0,
  "awayRun": 0,
  "lead": -2,
  "phase": "EARLY",
  "event": "POINT"
}]
12.2 puntos_manuales_XXXXX.json (estadísticas manuales)
json
[{
  "timestamp": "2026-04-23T20:30:50.398Z",
  "set": 1,
  "punto": 1,
  "equipo": "LOCAL",
  "equipoAnota": "LOCAL",
  "jugador": 7,
  "accion": "ATAQUE",
  "asistencia": 4,
  "marcadorAntes": "0-0",
  "marcadorDespues": "1-0"
}]
12.3 formacion_inicial_XXXXX_set_N.json
json
{
  "local": [
    { "numero": 3, "nombre": "Tomás Alessandro Visciglia" },
    { "numero": 10, "nombre": "Mateo Cayetano Visciglia" }
  ],
  "visitante": [
    { "numero": 2, "nombre": "Gonzalo Veiguela" }
  ]
}
12.4 timeouts_XXXXX (localStorage)
json
[{
  "id": "timeout_1745436789000",
  "timestamp": "2026-04-23T20:30:00.000Z",
  "set": 2,
  "equipo": "LOCAL",
  "marcador": "12-10",
  "puntosAntes": { "local": 2, "rival": 3, "total": 5 },
  "puntosDespues": { "local": 4, "rival": 1, "total": 5 },
  "eficienciaAntes": 40,
  "eficienciaDespues": 80,
  "mejora": 40,
  "efectividad": "positiva"
}]
12.5 marcas_XXXXX (localStorage)
json
[{
  "timestamp": "2026-04-23T20:35:00.000Z",
  "set": 2,
  "equipo": "LOCAL",
  "tipo": "momento_clave",
  "marcador": "14-13"
}]
13. DEPENDENCIAS
Backend (Node.js)
json
{
  "dependencies": {
    "cors": "^2.8.6",
    "dotenv": "^16.4.5",
    "express": "^5.2.1",
    "socket.io": "^4.7.2",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
Frontend (CDN)
Chart.js ^4.4.0

TailwindCSS

Socket.IO ^4.7.2

Túnel
cloudflared (para Dashboard, API y WebSocket)

14. REQUISITOS TÉCNICOS
Requisito	Mínimo
Node.js	18.0.0 o superior (probado con v22.22.2)
Navegador	Moderno (Chrome, Firefox, Edge)
Sistema operativo	Windows, Linux, macOS
Puertos	5501 (API, Dashboard y WebSocket)
Conexión	Internet (para API Metro Vóley y túnel)
Túneles	Cloudflared instalado
15. ESTADÍSTICAS DE SERVICIO POR JUGADOR
Columna	Descripción
🏐 SAQUE	Puntos directos de saque del jugador
❌ ERR SERV	Errores de servicio del jugador
📊 EFI SERV%	Eficiencia = (SAQUE - Errores) / Total saques × 100
🏐 TOT SERV	Total de saques realizados
Colores en EFI SERV%:

🟢 Verde: Eficiencia positiva (>10%) — Excelente

🟡 Amarillo: Eficiencia neutra (0% a 10%) — Regular

🔴 Rojo: Eficiencia negativa (<0%) — Necesita mejorar

16. ESTADÍSTICAS DE RECEPCIÓN Y DEFENSA POR JUGADOR
Columna	Descripción
📥 REC	Recepciones positivas / Totales de recepción
REC%	Eficiencia = (REC+ / Total Recepciones) × 100
🛡️ DEF	Defensas positivas / Totales de defensa
DEF%	Eficiencia = (DEF+ / Total Defensas) × 100
Colores en REC% y DEF%:

🟢 Verde: Eficiencia >60% — Excelente

🟡 Amarillo: Eficiencia 40-60% — Regular

🔴 Rojo: Eficiencia <40% — Necesita mejorar

17. ANÁLISIS DE TIEMPOS MUERTOS
Métrica	Descripción
Total Timeouts	Cantidad de timeouts registrados
Efectivos	Timeouts con mejora >20% después
Mejora promedio	Promedio de mejora en eficiencia
Efectividad	Positiva (>20%), Neutra (±20%), Negativa (<-20%)
18. SIDEOUT% Y BREAKPOINT%
Métrica	Qué indica
Sideout% > 60%	Buena recepción y eficacia del primer ataque
Sideout% < 40%	Problemas para recuperar el saque al recibir
Breakpoint% > 40%	Buena producción mientras el equipo saca
Breakpoint% < 20%	Poca presión de saque o baja eficacia de bloqueo-defensa
19. ANÁLISIS EVOLUTIVO — GUÍA DE USO
19.1 ¿Para qué sirve?
Seguir la evolución del equipo a lo largo de múltiples partidos.

Identificar tendencias (mejora o empeoramiento) en métricas clave.

Detectar fortalezas consistentes y debilidades recurrentes.

Tomar decisiones basadas en datos sobre qué aspectos entrenar.

19.2 ¿Cómo se usa?
Guardar reportes: después de cada partido, hacer clic en "💾 Guardar" en el dashboard. Se descarga un HTML.

Subir reportes: ir a la pestaña "📈 EVOLUCIÓN" → arrastrar o seleccionar hasta 5 archivos HTML guardados.

Analizar: hacer clic en "📊 ANALIZAR EVOLUCIÓN".

Qué muestra:

Resumen ejecutivo: texto claro sobre la tendencia general.

Fortalezas: métricas donde el equipo destaca (verde).

Debilidades: métricas a mejorar (rojo).

Tabla evolutiva: comparación numérica partido a partido.

Gráfico de tendencias: visualización de la evolución.

19.3 Interpretación de colores
Color	Significado
🟢 Verde	Métrica excelente (Sideout >60%, Breakpoint >40%, Clutch >60%, Efi Servicio >10%)
🟡 Amarillo	Métrica regular (dentro de rangos normales)
🔴 Rojo	Métrica a mejorar (por debajo del umbral deseado)
20. SELECTOR DE PARTIDOS
20.1 ¿Cómo funciona?
El selector de partidos permite cambiar entre diferentes partidos sin modificar manualmente config.json. Tiene 3 grupos:

PARTIDO ACTIVO: el que está corriendo ahora.

PRÓXIMOS PARTIDOS: partidos preparados anticipadamente.

HISTORIAL: partidos jugados anteriormente.

20.2 Requisitos
El túnel de Cloudflare publicando el puerto 5501.

CORS configurado con origin: true en server-api.js.

20.3 Flujo del selector
El usuario selecciona un partido del desplegable.

El dashboard guarda el ID anterior y actualiza this.matchId.

Limpia localStorage del partido anterior.

Envía POST /api/config para actualizar config.json.

Resuscribe el WebSocket: unsubscribe(idAnterior) + subscribe(nuevoId).

Recarga los datos del nuevo partido (match_nuevoId.json).

20.4 Botones del selector
Botón	Función
📋 CARGAR PARTIDO	Cambiar a un partido del historial
✅ ACTIVAR PREPARADO	Activar un partido de la cola de preparados
🗑️ QUITAR DE PRÓXIMOS	Quitar un partido preparado
🗑️ QUITAR DEL HISTORIAL	Quitar un partido del historial (no borra archivos)
🧹 LIMPIAR HISTORIAL	Vaciar historial (excepto activo)
🏁 FINALIZAR ACTIVO	Cerrar partido activo, tracker queda en espera
20.5 Limpieza automática de localStorage
limpiarPartidosAnteriores(): al cargar, borra datos de partidos que no son el actual.

limpiarDatosPartidoEspecifico(matchId): borra todas las claves de un partido específico.

verificarConsistenciaYLimpiar(): detecta mezcla de datos y limpia automáticamente.

21. LIMITACIONES ACTUALES
Limitación	Descripción
Un solo partido	El tracker solo puede seguir un partido a la vez
Dependencia externa	Requiere que Metro Vóley tenga el partido (para datos automáticos)
Sin base de datos	Los datos se guardan en archivos JSON
Acceso público abierto	Cualquiera con la URL entra como Público sin contraseña (solo lectura)
POST a la API en celular	Puede fallar si el túnel de Cloudflare no está activo
Roster de Metro tarda ~4 min	La primera vez que se consulta un partido, Metro tarda en generar el roster
Saltos de marcador ambiguos	Si los dos equipos anotan entre dos consultas, el sistema no inventa el orden
22. SOLUCIÓN DE PROBLEMAS COMUNES
Problema	Causa	Solución
SyntaxError: Unexpected end of input	Falta cerrar una llave, paréntesis o bloque	node --check archivo.js muestra el archivo. Buscar duplicaciones de app.get(...)
Tracker se cierra	Error no manejado	Revisar tracker.log, verificar manejadores en index.js
Dashboard no muestra datos	match_*.json no existe o está vacío	Verificar que el tracker esté corriendo
No se ven nombres de jugadores	Roster no generado aún por Metro	Esperar 4 minutos o arrancar el tracker 10-15 min antes
Error 404 en JSON	El partido no empezó o el ID es incorrecto	Verificar ID en config.json
Puerto 5501 en uso	Otro proceso usando el puerto	netstat -ano | findstr :5501 y matar el proceso, o cambiar PORT en .env
Gráficos no cargan	Problema en stateProcessor.js	Verificar los datos de entrada
Sets no se muestran	La API devuelve datos en match.sets	Verificar la estructura de la respuesta
Modo offline no funciona	Service Worker no registrado	Verificar sw.js y que IndexedDB esté disponible
WebSocket no conecta	server-api.js no está corriendo o sesión inválida	Verificar que el servidor esté activo y volver a loguearse
Sideout/Breakpoint no se ven	IDs incorrectos en HTML	Verificar los labels en index.html
Análisis evolutivo no muestra datos	Reportes HTML no válidos	Asegurar que sean generados por VoleyInsight
Selector no cambia nombres	No se actualiza matchId en el dashboard	Verificar config.json y que el servidor esté activo
Mezcla de nombres con puntos de otro partido	localStorage residual	El dashboard limpia automáticamente los datos viejos
WebSocket no se resuscribe	Cliente no envía unsubscribe/subscribe	setupSelectorPartido() ya lo maneja
El tracker no cambia de partido	No monitorea config.json	tracker.js incluye configMonitorInterval cada 5s
El celular no ve el selector	CORS bloquea la petición	Verificar origin: true en server-api.js
El túnel de Cloudflare se cae	Conexión inactiva	Reiniciar cloudflared
findstr no encuentra un string con tildes	Code page de CMD no coincide con UTF-8	Buscar sin tildes: findstr /C:"ID inv" en vez de "inválido"
Los cambios no se aplican	El servidor sigue con el código viejo en memoria	Ctrl+C + reiniciar node server-api.js o npm run tracker
.env no se lee	Archivo malformado o clave faltante	Verificar VOLEY_OPERATOR_PASSWORD y VOLEY_PUBLIC_PASSWORD
git check-ignore no reporta un archivo	El archivo está trackeado en el índice	Hacer git rm --cached archivo o commitear el borrado
23. TIPS PARA ENTRENADORES
Usá la pestaña EVOLUCIÓN después de 3 o más partidos para ver tendencias reales.

Sideout% > 60% = estás resolviendo bien cuando recibís. <45% = revisar recepción y primer ataque.

Breakpoint% > 40% = el saque propio y el sistema de bloqueo-defensa generan puntos.

Clutch% bajo (<40%) = entrená definición de sets y manejo de presión.

Eficiencia de servicio negativa = muchos errores de saque. Priorizá efectividad sobre potencia.

REC% bajo (<40%) = problema en recepción de saque. Trabajar técnica y posicionamiento.

DEF% bajo (<40%) = problema en defensa. Revisar sistema defensivo y cobertura.

Guardá TODOS los reportes para poder hacer análisis evolutivo a fin de temporada.

Compará partidos para ver si las mejoras que entrenaste realmente aparecen en los números.

24. CONTACTO Y SOPORTE
Recurso	Descripción
Configuración	data/config.json (cambiar ID, nombres y categoría)
Reglamento	data/reglamento.json (configurar sets por categoría)
URL de la API	Mismo origen que el dashboard
Logs	tracker.log (en carpeta raíz)
Datos	Carpeta data/ (todos los JSON)
Reportes exportados	Se guardan donde el usuario elija
API Docs	http://localhost:5501/api/status
Contacto	Gonzalo · 11 5136-4852
25. RESUMEN DE ESTADO
text
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   🏐 VOLEYINSIGHT v3.2.1                                                    ║
║   Commit vigente: eeee450                                                    ║
║                                                                              ║
║   ✅ Dashboard 100% funcional (4 vistas + selector)                          ║
║   ✅ Tracker 100% funcional (con monitor de config.json y roster HTML)       ║
║   ✅ Anotador 100% funcional (con atajos de teclado)                         ║
║   ✅ Reporte HTML con gráficos y glosario                                    ║
║   ✅ API REST propia                                                         ║
║   ✅ WebSocket en tiempo real (con resuscripción)                            ║
║   ✅ Modo offline                                                            ║
║   ✅ Tiempos muertos                                                         ║
║   ✅ Sideout% + Breakpoint%                                                  ║
║   ✅ Estadísticas de servicio, recepción y defensa por jugador               ║
║   ✅ Análisis evolutivo (comparativa de partidos)                            ║
║   ✅ Selector de partidos (PC y celular)                                     ║
║   ✅ Túnel único Cloudflare                                                  ║
║   ✅ Limpieza automática de localStorage                                     ║
║   ✅ Ping keepalive para túneles                                             ║
║   ✅ Insights siempre para ATTITUDE (o LOCAL)                                ║
║   ✅ Glosario mejorado con ejemplos                                          ║
║   ✅ Autenticación por roles (Público/Operador)                              ║
║   ✅ Sesión HMAC-SHA256, cookie HttpOnly + SameSite=Lax                      ║
║   ✅ Rate limiting de login (5 intentos / 10 min)                            ║
║   ✅ Validación de matchId numérico en todos los endpoints                   ║
║   ✅ Path traversal cerrado en /api/formacion y /api/court                   ║
║   ✅ Timeout de 5s en fetch del roster de Metro                              ║
║   ✅ Reintento de roster vacío cada 30s                                      ║
║   ✅ /api/config sin partidosPreparados para público                         ║
║   ✅ npm audit sin high/moderate en producción                               ║
║   ✅ 15/15 tests automatizados pasando                                       ║
║                                                                              ║
║   🚀 LISTO PARA PRODUCCIÓN                                                   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
Documentación generada: 6 de noviembre de 2026
Versión del sistema: VoleyInsight v3.2.1
Commit vigente: eeee450
Estado: Producción

Novedades de esta versión:

Selector de partidos con separación de roles (Público/Operador).

Gestión de partidos activos, preparados e historial.

Sesión firmada con HMAC-SHA256, cookie HttpOnly + SameSite=Lax, rate limiting de login.

Validación estricta de matchId/set en todos los endpoints que construyen rutas de archivo.

Timeout de 5 segundos en fetch del roster de Metro, con reintento cada 30 segundos si el roster viene vacío.

/api/config filtra partidosPreparados para el rol público.

.gitignore consolidado con protección de datos personales.

Auditoría de seguridad completa: npm audit sin high/moderate en producción.

---

## 26. PENDIENTES Y ESTADO ACTUAL

**Base vigente:** v3.2.1 · commit `eeee450`

### Cerrado (6 de noviembre de 2026)
-  **Formación por rotación visible en PC y celular.** Causa: los JSON `formacion_inicial_*` no traen campo `posicion`; se normaliza en `obtenerJugadoresEnRotacion` (asigna `posicion = index + 1` si falta). Se agregaron además `guardarCacheJSON` como método, no-reset de `formacionInicialPorSet` entre llamadas a `loadData`, y `Promise.all` + `AbortSignal.timeout(8000)` en `cargarFormacionDesdeBackend`.
-  **"Últimos 10 puntos" del informe** verificado en el partido del 5/11 (suma 10, no 9).
-  **`guardarCacheJSON` ausente** en `dashboard.js`. Antes del fix, `localStorage` nunca guardaba la formación. Bug latente que afectaba a todos los dispositivos.

### Pendientes (no urgentes, no bloquean)
-  **4 puntos manuales de más en Set 1 del partido 241350** (43 manuales vs 39 oficiales). Solo afecta individuales del Set 1 y el acumulado. Rotaciones y métricas de equipo salen de Metro y están correctas.
-  **Log "Estado actual enviado: X-Y" en `server-api.js`** con el partido ya cerrado. Revisar el handler de `subscribe` para confirmar si es estado cacheado o logs viejos.
-  **Rotaciones Sub-18 desincronizadas.** Detectado en el informe del 08/08/2026 (53-53 en rotaciones vs 56-59 en marcador). Sin verificar si sigue.

