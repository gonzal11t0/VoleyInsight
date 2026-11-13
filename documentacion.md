---

# 📚 documentacion.md actualizado

````markdown
# 📚 DOCUMENTACIÓN TÉCNICA COMPLETA — VOLEYINSIGHT v3.2.2

**Última actualización:** 12 de noviembre de 2026
**Estado:** Producción

---

## 1. DESCRIPCIÓN GENERAL

VoleyInsight es un sistema de análisis de partidos de voleibol en tiempo real que:

- Captura datos automáticos desde la API de Metro Vóley cada 3 segundos (con WebSocket para tiempo real).
- Permite anotación manual de puntos y estadísticas individuales con atajos de teclado.
- Visualiza análisis en un dashboard profesional con cuatro vistas: **PARTIDO**, **INDIVIDUALES**, **ROTACIONES** y **ANOTADOR**.
- Exporta reportes en formato HTML con gráficos como imágenes base64 y glosario de métricas.
- Permite análisis evolutivo: compara múltiples partidos subiendo los reportes HTML generados.
- Funciona offline con datos cacheados (Service Worker + IndexedDB).
- Expone una API REST propia para consultar datos programáticamente.
- Analiza tiempos muertos con registro manual y cálculo de efectividad.
- Calcula Sideout%, Breakpoint%, Clutch%, fases del set y rachas.
- Estadísticas de servicio, recepción y defensa por jugador.
- **Selector de partidos** para cambiar entre partidos históricos, activos y preparados desde el dashboard.
- **Resuscripción WebSocket** automática al cambiar de partido.
- **Túnel único** de Cloudflare publica Dashboard, API y WebSocket desde el puerto 5501.
- **Autenticación por roles** con selector Público/Operador.
- **Soporte multiformato**: Adaptado para categorías de 4 o 5 jugadoras (Sub-11, Sub-12) y 6 jugadoras.
- **Análisis centrado en el equipo principal**: detecta automáticamente ATTITUDE como local o visitante y cae a LOCAL si no participa.

### Novedades v3.2.2

- **Análisis consistente del equipo principal (ATTITUDE).** El clutch, las interpretaciones y las recomendaciones ahora siguen al equipo analizado en todos los bloques del dashboard. Antes el clutch y los textos de interpretación/recomendaciones estaban fijados al equipo LOCAL, lo que mezclaba métricas cuando ATTITUDE jugaba como visitante.
- **Reporte HTML alineado con el dashboard.** El informe descargable incluye el badge "Análisis enfocado en ATTITUDE" y suma interpretaciones de sideout y breakpoint del equipo analizado, además de las de eficiencia, rachas, breakpoints, clutch y fases.
- **Mensaje "Sin atribuir" clarificado.** Se reemplazó por **"Por error rival / recovery"**. El nuevo texto refleja que esos puntos son puntos que el equipo recibe sin acción propia: errores del rival (ataque, saque, etc.) o puntos recuperados con el botón RECUPERAR. No son errores de anotación.
- **Tracker: reset correcto al cambiar de partido.** `crearArchivoPartidoVacio()` acepta un parámetro `{ forzar: true }`. Cuando el operador activa un partido nuevo, `cambiarPartido()` lo invoca con `forzar: true` para recrear `match_NUEVOID.json` desde cero. Antes, si el archivo ya existía (de una sesión previa o intento anterior), no se sobrescribía y arrastraba el último score del partido anterior.
- **Tracker: nombres reales desde `config.json`.** Nuevo helper `obtenerNombresDesdeConfig(matchId)` que lee `homeTeam`/`awayTeam` de `data/config.json`. El archivo inicial del partido ahora se crea con `"MORON C"` / `"ATTITUDE"` en lugar de `"LOCAL"` / `"VISITANTE"`. Esto también evita que `stateProcessor.js` caiga al fallback de nombres genéricos.
- **Tracker: cache de roster reiniciado al cambiar de partido.** Se limpian `_rosterMap`, `_rosterMatchId` y `_rosterRetryAt` al cambiar de partido para no reutilizar nombres de jugadoras del partido anterior.
- **Anotador: cambiar de set ya no resetea a 0-0.** El selector de set ahora:
  - Filtra los eventos guardados del set seleccionado.
  - Reconstruye el marcador, punto, rotaciones y saque reales desde el último evento del set.
  - Al volver al set anterior, recupera sus datos.
  - Los sets nuevos sin eventos arrancan en 0-0 con rotaciones 1|1.
  - El historial visible corresponde siempre al set seleccionado.

---

## 2. ARQUITECTURA DEL SISTEMA

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VOLEYINSIGHT - ARQUITECTURA                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────┐      ┌─────────────────────┐                      │
│   │   API Metro Vóley   │      │   App de Anotación  │                      │
│   │   (fuente externa)  │      │ (vistaAnotador en   │                      │
│   │                     │      │  index.html)        │                      │
│   └──────────┬──────────┘      └──────────┬──────────┘                      │
│              │                            │                                 │
│              ▼                            ▼                                 │
│   ┌─────────────────────┐      ┌─────────────────────┐                      │
│   │  Tracker (Node.js)  │      │    localStorage /   │                      │
│   │ (WebSocket + Polling)│      │      IndexedDB      │                      │
│   └──────────┬──────────┘      └──────────┬──────────┘                      │
│              │                            │                                 │
│              ▼                            ▼                                 │
│   ┌─────────────────────┐      ┌─────────────────────┐                      │
│   │  match_XXXXX.json   │      │    timeouts_XXXXX   │                      │
│   │  full_XXXXX.json    │      │    puntos_XXXXX     │                      │
│   │  court_XXXXX.json   │      │    marcas_XXXXX     │                      │
│   │  formacion_*.json   │      │                     │                      │
│   └──────────┬──────────┘      └──────────┬──────────┘                      │
│              │                            │                                 │
│              └─────────────┬──────────────┘                                 │
│                            ▼                                                │
│   ┌───────────────────────────────────────────────────┐                     │
│   │                    DASHBOARD                      │                     │
│   │                  (index.html)                     │                     │
│   │                                                   │                     │
│   │  📊 VISTA PARTIDO (en vivo)                       │                     │
│   │  👕 VISTA INDIVIDUAL (por jugador)                │                     │
│   │  🔄 VISTA ROTACIONES (por set)                    │                     │
│   │  🏐 VISTA ANOTADOR (manual)                       │                     │
│   │  🆕 SELECTOR DE PARTIDOS                          │                     │
│   │                                                   │                     │
│   │  💾 Exportar HTML  📡 Modo offline                │                     │
│   │  ⏸️ Tiempos muertos 📊 Sideout/Breakpoint         │                     │
│   └─────────────────────────┬─────────────────────────┘                     │
│                             │                                               │
│                             ▼                                               │
│   ┌───────────────────────────────────────────────────┐                     │
│   │  API REST propia + WebSocket Server + Auth        │                     │
│   └─────────────────────────┬─────────────────────────┘                     │
│                             │                                               │
│                             ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ ACCESO REMOTO                                                       │   │
│   │ Cloudflare Tunnel → Dashboard + API + WebSocket (puerto 5501)       │   │
│   │ El frontend usa el mismo origen para todos los servicios            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
3. ESTRUCTURA DE ARCHIVOS (ACTUALIZADA)
text
VoleyInsight/
├── server-api.js                     # Servidor Express (puerto 5501): API + WebSocket + estáticos
├── index.js                          # Punto de entrada del tracker
├── iniciar-partido.bat               # Lanzador Windows (3 procesos: API, tracker, túnel)
├── package.json                      # Dependencias y scripts
├── README.md
├── documentacion.md                  # Este archivo
├── documentación comercial.md
├── patch_roster.js                   # Script de un solo uso para enriquecer partidos viejos
├── .env                              # Contraseñas locales (NO en Git)
├── .env.example
├── .gitignore
│
├── dashboard/
│   ├── index.html                    # Dashboard principal (4 pestañas + anotador integrado)
│   ├── anotador.html                 # (legacy, no usado por el dashboard actual)
│   ├── logo-horizontal.png
│   ├── logo.png
│   ├── logo-icon-192.png
│   ├── logo-icon-512.png
│   ├── favicon-64.png
│   ├── site.webmanifest
│   └── js/
│       ├── dashboard.js              # Lógica principal (selector, resuscripción WS, métricas)
│       ├── anotador.js               # (legacy, no usado por el dashboard actual)
│       ├── reporteGenerator.js       # Generación de reportes HTML
│       ├── StatsHelper.js            # Estadísticas por jugador
│       ├── rotacionHelper.js         # Cálculo de rotaciones 1-6
│       ├── metricasVoleyHelper.js    # Métricas estándar (Sideout, Breakpoint)
│       ├── partidoHelper.js          # Estado oficial del partido, sets
│       ├── comparativaHelper.js      # Comparación de informes
│       ├── setSummaryHelper.js       # Resumen automático de sets
│       ├── timeoutHelper.js          # Deduplicación de timeouts
│       ├── formacionHelper.js        # Normalización de posiciones y firma de formación
│       ├── utils.js                  # OfflineManager, SoundManager
│       └── sw.js                     # Service Worker para modo offline
│
├── src/
│   ├── core/
│   │   ├── tracker.js                # Fetch Metro cada 3s, roster HTML, WebSocket
│   │   ├── stateProcessor.js         # Procesa estados, rallies, breakpoints
│   │   ├── preparationStatus.js      # Validación de partidos y config
│   │   ├── eventEngine.js            # Normalización de eventos manuales
│   │   ├── auth.js                   # HMAC-SHA256, cookies, sesiones
│   │   ├── loginGuard.js             # Rate limiting de login
│   │   ├── authConfig.js             # Lectura de contraseñas de .env
│   │   ├── rosterHistory.js          # Fusión de planteles
│   │   ├── rotationHistory.js        # Historial de rotaciones
│   │   ├── activityStatus.js         # Detección de inactividad
│   │   └── trackerActiveState.js     # Lectura de matchId activo desde config
│   ├── services/
│   │   ├── api.js                    # Conexión con Metro Vóley (timeout + retry)
│   │   └── websocket.js              # Stub (no usado)
│   ├── analytics/
│   │   ├── performanceAnalyzer.js
│   │   └── volleyballMetrics.js
│   ├── repositories/
│   │   └── dataRepository.js
│   ├── export/
│   │   └── htmlExporter.js
│   ├── utils/
│   │   ├── atomicFile.js             # Escritura atómica + respaldos .bak
│   │   └── logger.js
│   └── config.js
│
├── data/
│   ├── config.json                   # { matchId, homeTeam, awayTeam, categoria, partidos[] }
│   ├── reglamento.json               # Configuración de sets por categoría
│   ├── club-profile.json             # Perfil del club (nombre, colores, logo)
│   ├── .auth_secret                  # Secreto HMAC (generado, permisos 0600)
│   ├── match_XXXXX.json              # Puntos del partido (automático)
│   ├── match_XXXXX.csv               # Puntos en CSV
│   ├── full_XXXXX.json               # Snapshot completo de la API
│   ├── court_XXXXX.json              # Formación actual
│   ├── formacion_inicial_XXXXX_set_N.json # Formación inicial del set N
│   ├── plantel_XXXXX.json            # Mapa dorsal → nombre
│   ├── puntos_manuales_XXXXX.json    # Puntos anotados manualmente
│   ├── analysis_XXXXX.json           # Análisis de rendimiento
│   ├── tracker_status_XXXXX.json     # Estado del tracker
│   └── informes/                     # Informes HTML importantes (no en Git)
│
└── tests/                            # 15 tests automatizados
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
4. COMPONENTES DEL SISTEMA
4.1 Tracker (Node.js)
Archivo	Función
index.js	Punto de entrada, lee config.json, maneja errores globales
src/core/tracker.js	Fetch cada 3s, procesa datos, guarda JSON, emite por WebSocket
src/services/api.js	Conexión con API de Metro Vóley con timeout y retry
src/core/stateProcessor.js	Calcula rachas, breakpoints, fases y eventos
Funcionalidades del tracker:

Monitoreo de config.json cada 5 segundos (configMonitorInterval).

Cambio automático de partido al detectar nuevo matchId.

crearArchivoPartidoVacio(matchId, { forzar }) para inicializar archivos JSON:

forzar: false (default): no sobrescribe si el archivo existe.

forzar: true: borra y recrea el archivo. Usado por cambiarPartido() para garantizar un arranque limpio.

obtenerNombresDesdeConfig(matchId): helper que lee homeTeam/awayTeam de data/config.json y los usa al crear el archivo inicial. Evita dejar "LOCAL"/"VISITANTE" genéricos.

Escucha evento WebSocket cambiar_partido y pausar_partido.

Reset de cache de roster (_rosterMap, _rosterMatchId, _rosterRetryAt) al cambiar de partido.

Descarga del HTML de Metro /matches/{id}/players para extraer nombres reales (vía data-page embebido de Inertia.js).

Timeout de 5 segundos en el fetch del roster (AbortSignal.timeout(5000)).

Reintento cada 30 segundos si el roster viene vacío.

Guarda full_*.json solo si hay formación, para no pisar el archivo con liveState: null al terminar el partido.

Guarda court_*.json y formacion_inicial_*.json para tener formación histórica por set.

4.2 Dashboard (index.html)
Sección	Contenido
Header	Marcador en tiempo real, nombres de equipos, badge de saque
Pestañas	PARTIDO / INDIVIDUALES / ROTACIONES / ANOTADOR (4 vistas)
Selector	Panel flotante con selector de partidos (cambia ID y nombres)
Vista PARTIDO	Stats grid, gráficos, dominancia por set, breakpoints, insights, timeline, servicio, Sideout% y Breakpoint%
Vista INDIVIDUALES	Filtros por set, tablas de jugadores, TOP 5, gráfico de puntos, tiempos muertos
Vista ROTACIONES	Eficiencia por rotación. Adaptativo a 4, 5 o 6 jugadoras.
Vista ANOTADOR	Anotación manual: ATAQUE, BLOQUEO, SAQUE, SAQUE MALO, ERROR, REC+, REC-, DEF+, DEF-
El anotador está integrado dentro del index.html en <div id="vistaAnotador"> y su lógica está en el script inline dentro de inicializarCancha(). El archivo dashboard/js/anotador.js es código legacy que no se ejecuta.

Funciones clave en dashboard.js:

obtenerEquipoAnalisis(): detecta ATTITUDE como local o visitante, o cae a LOCAL si no participa. Es el punto único que define a quién se analiza.

setupSelectorPartido(): maneja el cambio de partido con resuscripción WebSocket.

limpiarDatosPartidoEspecifico(matchId): limpia localStorage del partido.

verificarConsistenciaYLimpiar(): detecta y corrige mezcla de datos.

Ping keepalive cada 25 segundos (para mantener túneles activos).

updateDashboard(): además de calcular y renderizar métricas, guarda en la instancia homeClutchPct, awayClutchPct, sideoutHomePct, sideoutAwayPct, breakpointHomePct, breakpointAwayPct, homePhaseEff y awayPhaseEff para que los métodos de interpretación puedan consultarlos sin recalcular.

updateInsightsList(): usa el clutch del equipo analizado (this.homeClutchPct o this.awayClutchPct) según obtenerEquipoAnalisis().

updateInterpretations(): pivotea todo sobre esLocal y usa las métricas del equipo analizado (eficiencia, rachas, breakpoints, clutch, sideout, breakpoint, fases, servicio).

updateRecommendations(): mismo patrón que interpretaciones.

saveAsHTML(): genera el reporte HTML siguiendo al equipo analizado, incluye badge "Análisis enfocado en ATTITUDE" y suma interpretaciones de sideout y breakpoint.

actualizarVistaIndividuales(): el resumen por equipo muestra Atribuidos: X · Por error rival / recovery: Y · Equipo: Z.

cargarFormacionDesdeBackend(): descarga el HTML de Metro, extrae data-page, cruza por matchTeamPlayerId, y enriquece el court antes de procesar.

actualizarResumenUltimoSet(): solo muestra el cartel de ganador cuando Metro confirma el fin del set.

Funciones clave en el script inline del index.html (inicializarCancha()):

cargarConfiguracion(): lee config.json y aplica nombres reales.

cargarJugadoresDesdeAPI(): consulta full_*.json, extrae posiciones y normaliza.

cargarPuntosDesdeAPI(): carga los eventos manuales del partido.

guardarPuntoEnAPI(punto): envía el evento a /api/puntos.

renderizarCancha(): dibuja los 6 jugadores por lado con posiciones.

renderizarHistorial() / renderizarPuntosApi(): muestran los últimos puntos del set actual.

Selector de set corregido: al cambiar de set filtra los eventos del set seleccionado y reconstruye marcador, punto, rotaciones y saque desde el último evento. Si el set no tiene eventos, arranca en 0-0 con rotaciones 1|1.

revisarRecuperacion() / recuperarPuntosPendientes(): cartel de "Hay puntos sin registrar" con botón RECUPERAR.

4.3 API REST Propia
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
/api/matches/:id/points	GET	✅	Todos los puntos
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
4.4 WebSocket en Tiempo Real
Característica	Descripción
Conexión	Persistente entre dashboard y servidor
Auth	Requiere sesión válida o internalTracker: true desde localhost
Eventos	new_point, punto_manual, punto_actualizado, punto_anulado, partido_terminado, partido_sin_actividad
Suscripción	Por matchId (subscribe / unsubscribe)
Ping keepalive	Evento ping_keepalive cada 25 segundos
Fallback	Vuelve a polling (3s) si WebSocket falla
4.5 Túnel para acceso remoto
Servicio	Puerto	Comando	URL
Cloudflare	5501 (sistema completo)	cloudflared tunnel --url http://localhost:5501	https://xxxx.trycloudflare.com
El dashboard, la API REST y el WebSocket comparten la misma URL.

5. FLUJO DE DATOS
text
1. TRACKER
   ├── Fetch a API Metro Vóley cada 3 segundos
   ├── Fetch al HTML de /players para nombres reales (timeout 5s)
   ├── Procesa snapshot (rachas, breakpoints, eventos)
   ├── Emite punto por WebSocket al servidor
   ├── Guarda en data/match_XXXXX.json y full_XXXXX.json
   ├── Guarda court_XXXXX.json y formacion_inicial_*.json
   └── Monitorea data/config.json cada 5 segundos

2. SERVIDOR API + WEBSOCKET
   ├── Valida sesión (HMAC-SHA256, cookie HttpOnly, SameSite=Lax)
   ├── Aplica rate limiting en login
   ├── Recibe puntos por WebSocket o webhook
   ├── Reenvía puntos a todos los dashboards conectados
   ├── Sirve archivos estáticos y API REST
   ├── Valida matchId/set antes de construir rutas de archivo
   └── Filtra partidosPreparados para el rol público

3. DASHBOARD (PC - localhost)
   ├── Conecta WebSocket a localhost:5501
   ├── Lee data/config.json, match_*.json, full_*.json
   ├── Calcula Sideout% y Breakpoint%
   ├── Detecta equipo analizado (ATTITUDE o LOCAL)
   └── Selector de partidos: cambia ID, nombres y datos

4. DASHBOARD (Celular - remoto)
   ├── Conecta WebSocket al mismo origen publicado por Cloudflare
   ├── Lee data/config.json, match_*.json a través del túnel
   ├── Selector: envía POST a la API y resuscribe WebSocket
   └── Ping keepalive cada 25 segundos

5. APP DE ANOTACIÓN (integrada en index.html)
   ├── Configura equipos (números, líberos)
   ├── Anota puntos (jugador, acción, asistencia)
   ├── Registra tiempos muertos y marcas manuales
   ├── Persiste en /api/puntos
   ├── Cambiar de set: carga el estado real del set seleccionado
   └── Guarda en localStorage y exporta a JSON

6. ANÁLISIS EVOLUTIVO
   ├── Usuario sube reportes HTML generados previamente
   ├── Sistema extrae métricas clave de cada reporte
   └── Genera tabla comparativa y gráfico de tendencias
6. CONFIGURACIÓN
6.1 Archivo data/config.json
json
{
  "matchId": 260045,
  "homeTeam": "MORON C",
  "awayTeam": "ATTITUDE",
  "categoria": "sub_16",
  "metroStatus": "verified",
  "partidos": [
    { "id": 77702, "homeTeam": "L.HERAS B", "awayTeam": "ATTITUDE", "categoria": "sub-16" }
  ],
  "partidosPreparados": []
}
6.2 Archivo data/reglamento.json
json
{
  "reglamento": {
    "version": "FMV 2025-2028",
    "categorias": {
      "sub_11": { "nombre": "Sub-11", "max_sets": 3, "puntos_por_set": 25, "set_decisivo_puntos": 15, "sets_para_ganar": 2 },
      "sub_12": { "nombre": "Sub-12", "max_sets": 3, "puntos_por_set": 25, "set_decisivo_puntos": 15, "sets_para_ganar": 2 },
      "sub_13": { "nombre": "Sub-13", "max_sets": 3, "puntos_por_set": 25, "set_decisivo_puntos": 15, "sets_para_ganar": 2 },
      "sub_14": { "nombre": "Sub-14", "max_sets": 3, "puntos_por_set": 25, "set_decisivo_puntos": 15, "sets_para_ganar": 2 },
      "sub_15": { "nombre": "Sub-15", "max_sets": 3, "puntos_por_set": 25, "set_decisivo_puntos": 15, "sets_para_ganar": 2 },
      "sub_16": { "nombre": "Sub-16", "max_sets": 3, "puntos_por_set": 25, "set_decisivo_puntos": 15, "sets_para_ganar": 2 },
      "sub_17": { "nombre": "Sub-17", "max_sets": 3, "puntos_por_set": 25, "set_decisivo_puntos": 15, "sets_para_ganar": 2 },
      "sub_18": { "nombre": "Sub-18", "max_sets": 5, "puntos_por_set": 25, "set_decisivo_puntos": 15, "sets_para_ganar": 3 },
      "sub_19": { "nombre": "Sub-19", "max_sets": 3, "puntos_por_set": 25, "set_decisivo_puntos": 15, "sets_para_ganar": 2 },
      "sub_21": { "nombre": "Sub-21", "max_sets": 3, "puntos_por_set": 25, "set_decisivo_puntos": 15, "sets_para_ganar": 2 },
      "mayores": { "nombre": "Mayores", "max_sets": 5, "puntos_por_set": 25, "set_decisivo_puntos": 15, "sets_para_ganar": 3 }
    },
    "reglas_generales": {
      "diferencia_minima": 2,
      "cantidad_maxima_de_sets": 5,
      "puntos_minimos_set_normal": 25,
      "puntos_minimos_set_decisivo": 15
    }
  }
}
6.3 Archivo .env
env
PORT=5501
VOLEY_OPERATOR_PASSWORD=<contraseña privada del operador>   # obligatoria
VOLEY_PUBLIC_PASSWORD=<contraseña de referencia>            # requerida al arrancar
VOLEY_SESSION_SECRET=<opcional>
LOCAL_SERVER_URL=http://localhost:5501
POLL_INTERVAL_MS=3000
SAVE_INTERVAL_MS=10000
API_BASE_URL=https://metrovoley.com.ar/api/matches
API_TIMEOUT_MS=10000
API_RETRY_ATTEMPTS=3
API_RETRY_BACKOFF_MS=1000
LOG_LEVEL=info
7. MÉTRICAS CALCULADAS
Métrica	Cálculo	Qué indica
Racha	Puntos consecutivos del mismo equipo	Dominio momentáneo
Breakpoint ganado	Punto anotado mientras el equipo saca	Producción de saque, bloqueo y defensa
Eficiencia	(Puntos propios / Puntos totales) × 100	Control general del partido
Clutch	% de puntos ganados en momentos críticos	Temple bajo presión
Fase	EARLY (1-10), MID (11-20), LATE (21+)	Rendimiento por momento del set
Momentum	Diferencia de puntos en últimos 5 puntos	Quién viene dominando
Sets	Según reglamento por categoría	Regla oficial de voleibol
Eficiencia Servicio	(SAQUE - Errores) / Total saques × 100	Efectividad del saque
Sideout%	(Puntos ganados al recibir / Total recepciones) × 100	Recepción y primer ataque
Breakpoint%	(Puntos ganados con saque propio / Total saques) × 100	Presión de saque y bloqueo-defensa
Eficiencia Recepción	(REC+ / Total Recepciones) × 100	Calidad de recepción de saque
Eficiencia Defensa	(DEF+ / Total Defensas) × 100	Calidad defensiva
Nota sobre el equipo analizado: todas las métricas se calculan para ambos equipos, pero los bloques de insights, interpretaciones y recomendaciones muestran las del equipo analizado (obtenerEquipoAnalisis()): ATTITUDE si juega de local o visitante, o LOCAL si ATTITUDE no participa.

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
9.3 Cómo apagar
Ctrl+C en cada una de las 3 ventanas (API, tracker, túnel). El sistema queda listo para el próximo arranque.

10. SEGURIDAD
Autenticación: HMAC-SHA256 para firmar sesiones (src/core/auth.js). Cookie voleyinsight_session: HttpOnly, SameSite=Lax, 30 días.

Rate limiting: 5 intentos fallidos cada 10 minutos → bloqueo de 15 minutos por IP.

Separación de roles: Público (solo lectura) vs Operador (acceso completo).

Validación de parámetros: Todos los endpoints validan matchId y set como enteros positivos (cierra path traversal).

Timeouts: Fetch al HTML de Metro con AbortSignal.timeout(5000).

Persistencia atómica: Escritura a archivo temporal con fsync, validación de sintaxis y reemplazo con .bak previo.

Filtrado de datos: /api/config no expone partidosPreparados al público.

11. ANÁLISIS DE TIEMPOS MUERTOS Y SIDEOUT/BREAKPOINT
Métrica	Descripción
Total Timeouts	Cantidad de timeouts registrados
Efectivos	Timeouts con mejora >20% después
Mejora promedio	Promedio de mejora en eficiencia
Sideout% > 60%	Buena recepción y eficacia del primer ataque
Breakpoint% > 40%	Buena producción mientras el equipo saca
12. SOLUCIÓN DE PROBLEMAS COMUNES
Problema	Causa	Solución
SyntaxError: Unexpected end of input	Falta cerrar una llave o bloque	node --check archivo.js para identificar el error.
No se ven nombres de jugadores	Roster no generado aún por Metro	Esperar 4 minutos o arrancar el tracker 10-15 min antes.
Error 404 en JSON	El partido no empezó o el ID es incorrecto	Verificar ID en config.json.
Puerto 5501 en uso	Otro proceso usando el puerto	netstat -ano | findstr :5501 y matar el proceso.
El celular no ve la formación	Caché del navegador o falta de datos	Recargar con Ctrl+Shift+R. Verificar que formacion_inicial_*.json exista.
El tracker no cambia de partido	No monitorea config.json	tracker.js incluye configMonitorInterval cada 5s.
findstr no encuentra tildes	Code page de CMD no coincide con UTF-8	Buscar sin tildes: findstr /C:"ID inv".
Los cambios no se aplican	El servidor sigue con el código viejo en memoria	Ctrl+C + reiniciar node server-api.js o npm run tracker.
Al cambiar de partido, el marcador arrastra datos del anterior	Archivo match_NUEVOID.json existía de una sesión previa	En v3.2.2, cambiarPartido() lo resetea con forzar: true. Si ves el problema en una versión anterior, borrá el match_*.json del nuevo partido manualmente antes de activarlo.
El anotador muestra 0-0 al cambiar de set	Bug de v3.2.1 y anteriores	En v3.2.2, el selector de set reconstruye el estado real. Si persistís en la versión vieja, evitá cambiar de set durante el partido.
13. CONTACTO Y SOPORTE
Contacto: Gonzalo · 11 5136-4852

Configuración: data/config.json (cambiar ID, nombres y categoría).

Reglamento: data/reglamento.json (configurar sets por categoría).

Logs: tracker.log (en carpeta raíz).

API Docs: http://localhost:5501/api/status

14. ESTADO ACTUAL Y NOVEDADES RECIENTES
Base vigente: v3.2.2 · Commit actual (12 de noviembre de 2026)

Cerrado (12 de noviembre de 2026)
✅ Análisis consistente de ATTITUDE como local o visitante. Se corrigieron updateInsightsList, updateInterpretations y updateRecommendations en dashboard.js. Antes el clutch y los bloques de interpretación/recomendaciones estaban fijados al equipo LOCAL. Ahora todas las métricas siguen a obtenerEquipoAnalisis(). updateDashboard guarda homeClutchPct/awayClutchPct/sideoutHomePct/sideoutAwayPct/breakpointHomePct/breakpointAwayPct/homePhaseEff/awayPhaseEff en la instancia para que los métodos de render puedan consultarlos.

✅ Reporte HTML alineado. saveAsHTML() incluye el badge "Análisis enfocado en ATTITUDE" y suma interpretaciones de sideout y breakpoint del equipo analizado.

✅ Mensaje "Sin atribuir" clarificado. En la pestaña INDIVIDUALES se reemplazó por "Por error rival / recovery". El texto refleja dos casos legítimos que no son errores de anotación: errores del rival (el equipo recibe el punto sin acción propia) y recovery (puntos oficiales de Metro recuperados sin jugador).

✅ Tracker: reset correcto al cambiar de partido. crearArchivoPartidoVacio(matchId, { forzar }) con forzar: true desde cambiarPartido(). Garantiza que el archivo del nuevo partido arranca limpio.

✅ Tracker: nombres reales desde config. Nuevo helper obtenerNombresDesdeConfig(matchId). El INICIO del archivo se crea con "MORON C" / "ATTITUDE" en lugar de "LOCAL" / "VISITANTE".

✅ Tracker: reset de cache de roster al cambiar de partido. Se limpian _rosterMap, _rosterMatchId, _rosterRetryAt.

✅ Anotador: cambiar de set ya no resetea a 0-0. El selector de set filtra los eventos del set seleccionado y reconstruye marcador, punto, rotaciones y saque desde el último evento. Si el set no tiene eventos, arranca en 0-0.

Cerrado (7 de noviembre de 2026)
✅ Soporte para Sub-12 y categorías de 4/5 jugadoras.

✅ Corrección del resumen de sets (falsos positivos).

✅ Actualización de reglamento.json.

Cerrado (6 de noviembre de 2026)
✅ Formación por rotación visible en PC y celular.

✅ "Últimos 10 puntos" verificado en el partido del 5/11.