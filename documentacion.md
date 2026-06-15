📚 DOCUMENTACIÓN TÉCNICA COMPLETA - VOLEYINSIGHT v2.8

1. DESCRIPCIÓN GENERAL
VoleyInsight es un sistema de análisis de partidos de voleibol en tiempo real que:

- Captura datos automáticos desde la API de Metro Vóley cada 3 segundos (con WebSocket para tiempo real)
- Permite anotación manual de puntos y estadísticas individuales con atajos de teclado
- Visualiza análisis en un dashboard profesional con TRES vistas: PARTIDO, INDIVIDUALES y EVOLUCIÓN
- Exporta reportes en formato HTML con gráficos como imágenes base64 y glosario de métricas
- ANÁLISIS EVOLUTIVO: Compara múltiples partidos subiendo los reportes HTML generados
- Funciona offline con datos cacheados (Service Worker + IndexedDB)
- API REST propia para consultar datos programáticamente
- Análisis de tiempos muertos con registro manual
- Sideout% y Breakpoint% para análisis ofensivo
- Estadísticas de servicio por jugador (ACES, errores, eficiencia, total de saques)
- 🆕 SELECTOR DE PARTIDOS: Cambia entre partidos históricos desde el dashboard (funciona en PC y celular)
- 🆕 RESUSCRIPCIÓN WEBSOCKET: Al cambiar de partido, el WebSocket se resuscribe automáticamente
- 🆕 DOBLE TÚNEL: Cloudflare (dashboard) + Serveo (API) para acceso remoto desde el celular

2. ARQUITECTURA DEL SISTEMA

┌─────────────────────────────────────────────────────────────────────────────┐
│                           VOLEYINSIGHT - ARQUITECTURA                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────┐     ┌─────────────────────┐                      │
│   │   API Metro Vóley   │     │   App de Anotación  │                      │
│   │   (fuente externa)  │     │   (anotador.html)   │                      │
│   └──────────┬──────────┘     └──────────┬──────────┘                      │
│              │                           │                                  │
│              ▼                           ▼                                  │
│   ┌─────────────────────┐     ┌─────────────────────┐                      │
│   │   Tracker (Node.js) │     │   localStorage /    │                      │
│   │   (WebSocket + Polling)   │   IndexedDB         │                      │
│   └──────────┬──────────┘     └──────────┬──────────┘                      │
│              │                           │                                  │
│              ▼                           ▼                                  │
│   ┌─────────────────────┐     ┌─────────────────────┐                      │
│   │   match_XXXXX.json  │     │   timeouts_XXXXX    │                      │
│   │   full_XXXXX.json   │     │   puntos_XXXXX      │                      │
│   │                     │     │   breaks_XXXXX      │                      │
│   └──────────┬──────────┘     └──────────┬──────────┘                      │
│              │                           │                                  │
│              └─────────────┬─────────────┘                                  │
│                            ▼                                                │
│                 ┌─────────────────────────────────────┐                    │
│                 │           DASHBOARD                  │                    │
│                 │         index.html                   │                    │
│                 │                                      │                    │
│                 │  📊 VISTA PARTIDO    (en vivo)       │                    │
│                 │  👕 VISTA INDIVIDUAL (por jugador)   │                    │
│                 │  📈 VISTA EVOLUCIÓN  (comparativa)   │                    │
│                 │  🆕 SELECTOR DE PARTIDOS             │                    │
│                 │                                      │                    │
│                 │  💾 Exportar HTML   📡 Modo offline  │                    │
│                 │  ⏸️ Tiempos muertos 📊 Sideout/Break │                    │
│                 └─────────────────────────────────────┘                    │
│                            │                                                │
│                            ▼                                                │
│                 ┌─────────────────────┐                                    │
│                 │   API REST propia   │                                    │
│                 │   WebSocket Server  │                                    │
│                 │   (CORS habilitado) │                                    │
│                 └─────────────────────┘                                    │
│                            │                                                │
│                            ▼                                                │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                        TÚNELES PARA ACCESO REMOTO                    │  │
│   │   Cloudflare Tunnel → Dashboard (puerto 5500)                       │  │
│   │   Serveo Tunnel → API (puerto 3002)                                 │  │
│   │   El dashboard lee la URL de la API desde data/api_url.txt          │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

3. ESTRUCTURA DE ARCHIVOS (ACTUALIZADA)

voley/
├── dashboard/
│   ├── index.html              # Dashboard principal (3 pestañas + selector)
│   ├── anotador.html           # App de anotación manual
│   ├── logo.png                # Logo del sistema
│   └── js/
│       ├── dashboard.js        # Lógica principal (incluye selector y resuscripción WS)
│       ├── anotador.js         # Lógica del anotador manual
│       ├── reporteGenerator.js # Generación de reportes HTML
│       ├── statsHelper.js      # Estadísticas por jugador
│       ├── utils.js            # Utilidades (OfflineManager, SoundManager)
│       └── sw.js               # Service Worker para modo offline
├── data/
│   ├── config.json             # { matchId, homeTeam, awayTeam, categoria, partidos[] }
│   ├── reglamento.json         # Configuración de sets por categoría
│   ├── api_url.txt             # 🆕 URL del túnel de Serveo (API)
│   ├── match_*.json            # Puntos del partido (automático)
│   ├── full_*.json             # Datos completos de API
│   ├── jugadores_*.json        # Puntos anotados manualmente
│   ├── timeouts_*.json         # Tiempos muertos (localStorage)
│   └── breaks_*.json           # Breaks (localStorage)
├── src/
│   ├── core/
│   │   ├── tracker.js          # Lógica principal del tracker (con monitor de config.json)
│   │   └── stateProcessor.js   # Procesamiento de estados
│   ├── services/
│   │   └── api.js              # Conexión con API Metro Vóley
│   └── analytics/
│       ├── performanceAnalyzer.js  # Análisis de rendimiento
│       └── volleyballMetrics.js    # Métricas de voleibol
├── server-api.js               # Servidor Express (puerto 3002) con CORS y WebSocket
├── index.js                    # Punto de entrada del tracker
└── iniciar-partido.bat         # Lanzador automático (Windows) con dos túneles

4. COMPONENTES DEL SISTEMA

4.1 Tracker (Node.js) - ACTUALIZADO
Archivo	Función
index.js	Punto de entrada, lee config.json, maneja errores globales
src/core/tracker.js	Lógica principal: fetch cada 3s, procesa datos, guarda JSON, WebSocket
src/services/api.js	Conexión con API de Metro Vóley con timeout y retry
src/core/stateProcessor.js	Calcula rachas, breaks, fases, eventos

🆕 Nuevas funcionalidades en tracker.js:
- Monitoreo de config.json cada 5 segundos (configMonitorInterval)
- Cambio automático de partido al detectar nuevo matchId
- Método crearArchivoPartidoVacio() para inicializar archivos JSON
- Escucha evento WebSocket 'cambiar_partido'

Comandos:
npm start          # Iniciar tracker
npm run watch      # Monitor en vivo (terminal)

4.2 Dashboard (index.html) - ACTUALIZADO
Sección	Contenido
Header	Marcador en tiempo real, nombres de equipos, badge de saque
Pestañas	PARTIDO / INDIVIDUALES / EVOLUCIÓN (3 vistas)
🆕 Selector	Panel flotante con selector de partidos (cambia ID y nombres)
Vista PARTIDO	Stats grid (8 métricas), gráficos (4), dominancia por set, puntos de quiebre, insights, timeline, servicio, Sideout%, Breakpoint%
Vista INDIVIDUALES	Filtros por set, tablas de jugadores (con estadísticas de servicio), TOP 5, gráfico de puntos, análisis de tiempos muertos
Vista EVOLUCIÓN	Subida de reportes HTML, análisis comparativo, tabla evolutiva, gráfico de tendencias

Botones funcionales:
Botón	Función
📊 PARTIDO / 👕 INDIVIDUALES / 📈 EVOLUCIÓN	Cambiar vista
💾 Guardar	Exportar reporte HTML con gráficos
🔄 Actualizar	Recargar datos manualmente
🔊 Sonidos	Activar/desactivar sonidos
⏱️ Selector de refresco	2s, 3s, 5s, 10s
📡 Modo offline	Forzar uso de datos cacheados

🆕 Funciones en dashboard.js:
- obtenerUrlApi(): Lee la URL de la API desde data/api_url.txt
- setupSelectorPartido(): Maneja el cambio de partido con resuscripción WebSocket
- limpiarDatosPartidoEspecifico(matchId): Limpia localStorage del partido
- verificarConsistenciaYLimpiar(): Detecta y corrige mezcla de datos
- Ping keepalive cada 25 segundos (para mantener túneles activos)

4.3 App de Anotación (anotador.html) - ACTUALIZADO
Pantalla	Función
Configuración	Armar equipos (agregar/eliminar números, marcar líberos)
Anotación	Seleccionar equipo → seleccionar jugador → seleccionar acción → confirmar punto

Acciones disponibles:
Acción	¿Necesita jugador?	Qué pasa
ATAQUE	✅ Sí	Punto para tu equipo
BLOQUEO	✅ Sí	Punto para tu equipo
ACE	✅ Sí	Punto para tu equipo (stats de servicio)
ERROR	✅ Sí	Punto para el otro equipo (stats de servicio)
FALTA	✅ Sí	Punto para el otro equipo (nueva acción unificada)
OTRO	✅ Sí	Punto para tu equipo
TIMEOUT	❌ No	Registra tiempo muerto
BREAK	❌ No	Registra break (rompe saque rival)

Atajos de teclado:
Tecla	Acción	Tecla	Acción
Q	LOCAL	W	VISITANTE
A	ATAQUE	S	BLOQUEO
D	ACE	R	ERROR
B	BREAK	T	TIMEOUT
H	OTRO	Enter	Confirmar
Z	Deshacer	0-9	Seleccionar jugador
+ / -	Navegar jugador		

4.4 API REST Propia
Endpoint	Método	Descripción
/api/status	GET	Estado del servidor
/api/matches	GET	Lista todos los partidos
/api/matches/:id	GET	Datos generales del partido
/api/matches/:id/points	GET	Todos los puntos (filtro ?set=2)
/api/matches/:id/points/last?n=10	GET	Últimos N puntos
/api/matches/:id/stats	GET	Estadísticas resumidas
/api/matches/:id/sets	GET	Resultados por set
/api/webhook/point	POST	Webhook para puntos en tiempo real
/api/config	GET	Lee config.json
/api/config	POST	Actualiza config.json

4.5 WebSocket en Tiempo Real - ACTUALIZADO
Característica	Descripción
Conexión	Persistente entre dashboard y servidor
Eventos	new_point cuando hay un nuevo punto
Suscripción	Por matchId (subscribe / unsubscribe)
🆕 Cambio de partido	Evento 'cambiar_partido' (tracker) y resuscripción manual (dashboard)
🆕 Ping keepalive	Evento 'ping_keepalive' cada 25 segundos
Fallback	Vuelve a polling (3s) si WebSocket falla

🆕 Resuscripción en el dashboard:
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

4.6 CORS en server-api.js - NUEVO
const corsOptions = {
    origin: true,   // Permite cualquier origen (útil para túneles)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

4.7 Túneles para acceso remoto - NUEVO
Servicio	Puerto	Comando	URL
Cloudflare	5500 (dashboard)	cloudflared tunnel --url http://localhost:5500	https://xxxx.trycloudflare.com
Serveo	3002 (API)	ssh -R 80:localhost:3002 serveo.net	https://yyyy.serveo.net

El dashboard lee la URL de la API desde data/api_url.txt:
https://yyyy.serveo.net

5. FLUJO DE DATOS (ACTUALIZADO)

┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUJO DE DATOS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. TRACKER                                                                 │
│     ├── Fetch a API Metro Vóley cada 3 segundos                             │
│     ├── Procesa snapshot (rachas, breaks, eventos)                          │
│     ├── Emite punto por WebSocket al servidor                               │
│     ├── Guarda en data/match_XXXXX.json y full_XXXXX.json                   │
│     └── 🆕 Monitorea data/config.json cada 5 segundos                       │
│                                                                             │
│  2. SERVIDOR API + WEBSOCKET                                                │
│     ├── Recibe puntos por WebSocket o webhook                               │
│     ├── Reenvía puntos a todos los dashboards conectados                    │
│     ├── Sirve archivos estáticos y API REST                                 │
│     └── 🆕 Configuración CORS (origin: true)                                │
│                                                                             │
│  3. DASHBOARD (PC - localhost)                                              │
│     ├── Conecta WebSocket a localhost:3002                                  │
│     ├── Lee data/config.json, match_*.json, full_*.json                     │
│     ├── Calcula Sideout% y Breakpoint%                                      │
│     └── 🆕 Selector de partidos: cambia ID, nombres y datos                 │
│                                                                             │
│  4. DASHBOARD (Celular - remoto)                                            │
│     ├── Conecta WebSocket a la URL de Serveo (desde api_url.txt)            │
│     ├── Lee data/config.json, match_*.json a través del túnel               │
│     ├── 🆕 Selector: envía POST a la API y resuscribe WebSocket             │
│     └── 🆕 Ping keepalive cada 25 segundos                                  │
│                                                                             │
│  5. APP DE ANOTACIÓN                                                        │
│     ├── Configura equipos (números, líberos)                                │
│     ├── Anota puntos (jugador, acción, asistencia)                          │
│     ├── Registra tiempos muertos y breaks                                   │
│     └── Guarda en localStorage y exporta a JSON                             │
│                                                                             │
│  6. ANÁLISIS EVOLUTIVO                                                      │
│     ├── Usuario sube reportes HTML generados previamente                    │
│     ├── Sistema extrae métricas clave de cada reporte                       │
│     └── Genera tabla comparativa y gráfico de tendencias                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

6. CONFIGURACIÓN

6.1 Archivo data/config.json (ACTUALIZADO)
{
  "matchId": 260314,
  "homeTeam": "L.HERAS B",
  "awayTeam": "ATTITUDE",
  "categoria": "sub-16",
  "partidos": [
    { "id": 77702, "homeTeam": "L.HERAS B", "awayTeam": "ATTITUDE" }
  ]
}

Campo	Descripción
matchId	ID del partido actual en Metro Vóley
homeTeam	Nombre del equipo LOCAL
awayTeam	Nombre del equipo VISITANTE
categoria	Categoría del partido (ej: "sub-19", "mayores")
partidos	Lista de partidos disponibles en el selector

6.2 Archivo data/reglamento.json
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

6.3 Archivo data/api_url.txt (NUEVO)
Contiene la URL del túnel de Serveo para la API, por ejemplo:
https://59204d76bd84656e-181-24-199-174.serveousercontent.com

6.4 Archivo .env
POLL_INTERVAL_MS=3000
SAVE_INTERVAL_MS=10000
API_BASE_URL=https://metrovoley.com.ar/api/matches
API_TIMEOUT_MS=10000
API_RETRY_ATTEMPTS=3
API_RETRY_BACKOFF_MS=1000
LOG_LEVEL=info

6.5 Túneles (NUEVO)
# Terminal 1 - Cloudflare (Dashboard)
cloudflared tunnel --url http://localhost:5500

# Terminal 2 - Serveo (API)
ssh -R 80:localhost:3002 serveo.net

7. MÉTRICAS CALCULADAS
Métrica	Cálculo	Qué indica
Racha	Puntos consecutivos del mismo equipo	Dominio momentáneo
Break	Punto anotado sin estar sacando	Eficiencia en recepción y contraataque
Eficiencia	(Puntos propios / Puntos totales) × 100	Control general del partido
Clutch	% de puntos ganados en momentos críticos (set point o diferencia ≤2)	Temple bajo presión
Fase	EARLY (1-10), MID (11-20), LATE (21+)	Rendimiento por momento del set
Momentum	Diferencia de puntos en últimos 5 puntos	Quién viene dominando
Sets	Según reglamento por categoría (25/15 pts, diferencia 2)	Regla oficial de voleibol
Eficiencia Servicio	(Aces - Errores) / Total saques × 100	Efectividad del saque
Sideout%	(Puntos con saque propio / Total saques) × 100	Eficiencia ofensiva con saque
Breakpoint%	(Puntos sin saque / Total recepciones) × 100	Capacidad de romper saque rival

8. EVENTOS Y SONIDOS
Evento	Sonido	Frecuencia
Punto LOCAL	Tono agudo	880 Hz
Punto VISITANTE	Tono grave	440 Hz
Fin del partido	Fanfarria 3 notas	523-659-783 Hz

9. LANZAMIENTO DEL SISTEMA

9.1 Usando iniciar-partido.bat (Windows) - ACTUALIZADO
@echo off
title VoleyInsight - Sistema Completo
color 0A
chcp 65001 >nul
cd /d "%~dp0"
taskkill /f /im cloudflared.exe >nul 2>&1
taskkill /f /im ssh.exe >nul 2>&1

echo [1/5] Iniciando servidor local...
start "Servidor Local" cmd /k "npx serve . -p 5500"
timeout /t 3 /nobreak >nul

echo [2/5] Iniciando API server...
start "API Server" cmd /k "node server-api.js"
timeout /t 3 /nobreak >nul

echo [3/5] Iniciando tracker...
start "Tracker" cmd /k "npm run tracker"
timeout /t 3 /nobreak >nul

echo [4/5] Iniciando Cloudflare Tunnel...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:5500"
timeout /t 5 /nobreak >nul

echo [5/5] Iniciando Serveo Tunnel (API)...
start "Serveo API" cmd /k "ssh -R 80:localhost:3002 serveo.net"
timeout /t 8 /nobreak >nul

echo ========================================
echo    🚀 SISTEMA ACTIVO
echo ========================================
echo.
echo 📱 Dashboard (compartir): mirá la ventana "Cloudflare Tunnel"
echo 🔌 API URL (copiar a data/api_url.txt): mirá la ventana "Serveo API"
echo.
pause

9.2 Manualmente
# Terminal 1 - Servidor API + WebSocket
node server-api.js

# Terminal 2 - Tracker
npm start

# Terminal 3 - Servidor web
npx serve . -p 5500

# Terminal 4 - Cloudflare Tunnel
cloudflared tunnel --url http://localhost:5500

# Terminal 5 - Serveo Tunnel
ssh -R 80:localhost:3002 serveo.net

# Navegador (local)
http://localhost:5500/dashboard/index.html
http://localhost:5500/dashboard/anotador.html

10. URLs IMPORTANTES
Recurso	URL local	URL remota (túnel)
Dashboard	http://localhost:5500/dashboard/index.html	https://xxxx.trycloudflare.com/dashboard/index.html
Anotador	http://localhost:5500/dashboard/anotador.html	https://xxxx.trycloudflare.com/dashboard/anotador.html
API Status	http://localhost:3002/api/status	https://yyyy.serveo.net/api/status
API Config	http://localhost:3002/api/config	https://yyyy.serveo.net/api/config
WebSocket	ws://localhost:3002	wss://yyyy.serveo.net (con Socket.IO)

11. FORMATOS DE ARCHIVO

11.1 match_XXXXX.json (puntos del partido)
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

11.2 jugadores_XXXXX.json (estadísticas manuales)
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

11.3 timeouts_XXXXX (localStorage)
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

11.4 breaks_XXXXX (localStorage)
[{
  "timestamp": "2026-04-23T20:35:00.000Z",
  "set": 2,
  "equipo": "LOCAL",
  "tipo": "break",
  "marcador": "14-13"
}]

12. DEPENDENCIAS

Backend (Node.js):
{
  "dependencies": {
    "cors": "^2.8.6",
    "dotenv": "^16.4.5",
    "express": "^5.2.1",
    "socket.io": "^4.7.2",
    "socket.io-client": "^4.7.2"
  }
}

Frontend (CDN):
- Chart.js ^4.4.0
- TailwindCSS
- Socket.IO ^4.7.2

Túneles:
- cloudflared (para el dashboard)
- ssh (para Serveo, incluido en Windows 10/11)

13. REQUISITOS TÉCNICOS
Requisito	Mínimo
Node.js	18.0.0 o superior
Navegador	Moderno (Chrome, Firefox, Edge)
Sistema operativo	Windows, Linux, macOS
Puertos	3002 (API/WebSocket), 5500 (dashboard)
Conexión	Internet (para API Metro Vóley y túneles)
Túneles	Cloudflared instalado, Windows 10/11 (cliente SSH incluido)

14. ESTADÍSTICAS DE SERVICIO POR JUGADOR
Columna	Descripción
🎯 ACES	Puntos directos de saque del jugador
❌ ERR SERV	Errores de servicio del jugador
📊 EFI SERV%	Eficiencia de servicio = (Aces - Errores) / Total saques × 100
🏐 TOT SERV	Total de saques realizados

Colores en EFI SERV%:
🟢 Verde: Eficiencia positiva (>10%) - Excelente
🟡 Amarillo: Eficiencia neutra (0% a 10%) - Regular
🔴 Rojo: Eficiencia negativa (<0%) - Necesita mejorar

15. ANÁLISIS DE TIEMPOS MUERTOS
Métrica	Descripción
Total Timeouts	Cantidad de timeouts registrados
Efectivos	Timeouts con mejora >20% después
Mejora promedio	Promedio de mejora en eficiencia
Efectividad	Positiva (>20%), Neutra (±20%), Negativa (<-20%)

16. SIDEOUT% Y BREAKPOINT%
Métrica	Qué indica
Sideout% > 60%	Excelente eficiencia ofensiva con saque propio
Sideout% < 40%	Problemas cuando se tiene el saque
Breakpoint% > 40%	Buena capacidad de romper saque rival
Breakpoint% < 20%	Dificultad para anotar sin saque

17. ANÁLISIS EVOLUTIVO - GUÍA DE USO

17.1 ¿Para qué sirve?
El análisis evolutivo permite a entrenadores y analistas:
- Seguir la evolución del equipo a lo largo de múltiples partidos
- Identificar tendencias (mejora o empeoramiento) en métricas clave
- Detectar fortalezas consistentes y debilidades recurrentes
- Tomar decisiones basadas en datos sobre qué aspectos entrenar

17.2 ¿Cómo se usa?
1. Guardar reportes: Después de cada partido, hacer clic en "💾 Guardar" en el dashboard. Se descargará un archivo HTML.
2. Subir reportes: Ir a la pestaña "📈 EVOLUCIÓN" → arrastrar o seleccionar los archivos HTML guardados.
3. Analizar: Hacer clic en "📊 ANALIZAR EVOLUCIÓN".

Qué muestra:
- Resumen ejecutivo: texto claro sobre la tendencia general
- Fortalezas: métricas donde el equipo destaca (verde)
- Debilidades: métricas a mejorar (rojo)
- Tabla evolutiva: comparación numérica partido a partido
- Gráfico de tendencias: visualización de la evolución

17.3 Interpretación de colores en la tabla
Color	Significado
🟢 Verde	Métrica excelente (Sideout >60%, Breakpoint >40%, Clutch >60%, Efi Servicio >10%)
🟡 Amarillo	Métrica regular (dentro de rangos normales)
🔴 Rojo	Métrica a mejorar (por debajo del umbral deseado)

17.4 Ejemplo práctico
Un equipo juega 4 partidos en un mes. El entrenador guarda el reporte HTML después de cada partido. Al final del mes, sube los 4 reportes a la pestaña EVOLUCIÓN y puede ver visualmente cómo mejoró (o empeoró) el Sideout%, Breakpoint% y Clutch% a lo largo de los partidos.

18. SELECCIONADOR DE PARTIDOS (SELECTOR) - NUEVA SECCIÓN

18.1 ¿Cómo funciona?
El selector de partidos permite cambiar entre diferentes partidos sin modificar manualmente config.json.

18.2 Requisitos para que funcione en el celular:
- data/api_url.txt debe contener la URL del túnel de Serveo (API)
- El túnel de Serveo debe estar corriendo (ssh -R 80:localhost:3002 serveo.net)
- CORS configurado con origin: true en server-api.js

18.3 Flujo del selector:
1. El usuario selecciona un partido del desplegable
2. El dashboard guarda el ID anterior y actualiza this.matchId
3. Limpia localStorage del partido anterior
4. Envía POST a /api/config para actualizar config.json (opcional, puede fallar)
5. Resuscribe el WebSocket: unsubscribe(idAnterior) + subscribe(nuevoId)
6. Recarga los datos del nuevo partido (match_nuevoId.json)

18.4 Resuscripción WebSocket (código):
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

18.5 Limpieza automática de localStorage:
- limpiarPartidosAnteriores(): Al cargar, borra datos de partidos que no son el actual
- limpiarDatosPartidoEspecifico(matchId): Borra todas las claves de un partido específico
- verificarConsistenciaYLimpiar(): Detecta mezcla de datos y limpia automáticamente

19. LIMITACIONES ACTUALES
Limitación	Descripción
Un solo partido	El tracker solo puede seguir un partido a la vez
Dependencia externa	Requiere que Metro Vóley tenga el partido (para datos automáticos)
Anotación manual	Los puntos se guardan en localStorage (no automático al servidor)
Sin base de datos	Los datos se guardan en archivos JSON
Sin autenticación	Cualquiera con la URL puede ver el dashboard
POST a la API en celular	Puede fallar si el túnel de Serveo no es accesible (no afecta la visualización)

20. SOLUCIÓN DE PROBLEMAS COMUNES (ACTUALIZADA)

| Problema | Causa | Solución |
|----------|-------|----------|
| Tracker se cierra | Error no manejado | Agregar manejadores de errores en index.js |
| Dashboard no muestra datos | match_*.json no existe o está vacío | Verificar que el tracker esté corriendo |
| No se ven nombres de jugadores | La API no devuelve court | Esperar a que el partido empiece (court aparece después del inicio) |
| Error 404 en JSON | El partido no empezó o el ID es incorrecto | Verificar ID en config.json |
| Puerto 3002 en uso | Otro proceso usando el puerto | Cambiar puerto en server-api.js |
| Gráficos no cargan | Problema en stateProcessor.js | Verificar los datos de entrada |
| Sets no se muestran | La API devuelve datos en match.sets | Verificar la estructura de la respuesta |
| Modo offline no funciona | Service Worker no registrado | Verificar sw.js y que IndexedDB esté disponible |
| WebSocket no conecta | server-api.js no está corriendo | Verificar que el servidor esté activo |
| Skeleton no se oculta | Timeout de seguridad | Verificar el constructor |
| Sideout/Breakpoint no se ven | IDs incorrectos en HTML | Verificar los labels en index.html |
| Análisis evolutivo no muestra datos | Reportes HTML no válidos | Asegurar que sean generados por VoleyInsight |
| 🆕 Selector no cambia nombres | No se actualiza matchId en el dashboard | Verificar que api_url.txt exista y tenga la URL correcta |
| 🆕 Error "Error al cambiar partido en el servidor" | POST a /api/config falla | Verificar túnel de Serveo y CORS; el error no bloquea el selector |
| 🆕 Mezcla de nombres con puntos de otro partido | localStorage residual | El dashboard limpia automáticamente los datos viejos |
| 🆕 WebSocket no se resuscribe | Cliente no envía unsubscribe/subscribe | La función setupSelectorPartido() ya lo maneja |
| 🆕 El tracker no cambia de partido | No monitorea config.json | tracker.js incluye configMonitorInterval cada 5s |
| 🆕 El celular no ve el selector | CORS bloquea la petición | Configurar origin: true en server-api.js |
| 🆕 El túnel de Serveo se cae | Conexión inactiva | Agregar ping keepalive cada 25s |

21. MEJORAS IMPLEMENTADAS (TODAS)

#	Mejora	Estado
1	Refresco configurable	✅
2	Indicador de conexión	✅
3	Vista móvil responsive	✅
4	Reporte HTML con gráficos	✅
5	Sets oficiales (25/15 pts)	✅
6	Badge de saque	✅
7	Detección partido finalizado	✅
8	Reconexión automática tracker	✅
9	Selector partidos históricos	✅
10	Tooltips informativos	✅
11	Sonidos	✅
12	Atajos teclado anotador	✅
13	Glosario de métricas	✅
14	Hora último punto	✅
15	Menú hamburguesa móvil	✅
16	Limpieza header	✅
17	Estadísticas servicio equipo	✅
18	Selector rápido acciones	✅
19	Animaciones	✅
20	Detección de colapsos	✅
21	Selector de set manual	✅
22	Reset marcador al cambiar set	✅
23	Corrección suma puntos	✅
24	Estadísticas servicio por jugador	✅
25	Botón ERROR_RIVAL (reemplazado por FALTA)	✅
26	Reporte UX/UI mejorado	✅
27	API REST propia	✅
28	Modo offline	✅
29	Análisis tiempos muertos	✅
30	WebSocket	✅
31	Sideout% + Breakpoint%	✅
32	Skeleton loading	✅
33	Análisis evolutivo (comparativa de partidos)	✅
34	Selector de partidos funcional en celular	✅
35	Resuscripción manual de WebSocket al cambiar de partido	✅
36	Limpieza automática de localStorage (evita mezcla de datos)	✅
37	Lectura de api_url.txt para URL dinámica de la API	✅
38	Ping keepalive cada 25 segundos para mantener túneles activos	✅
39	CORS configurado (origin: true)	✅
40	Doble túnel: Cloudflare (dashboard) + Serveo (API)	✅

22. MEJORAS PENDIENTES (OPCIONALES)
#	Mejora	Tiempo	Dificultad
41	Autenticación de usuarios	2h	Media
42	Múltiples partidos simultáneos (tracker multicliente)	4h	Alta
43	Base de datos (SQLite o PostgreSQL)	3h	Alta
44	Dominio propio con Cloudflare (subdominios fijos)	2h	Media

23. PLAN DE ACCIÓN COMERCIAL

Fase 1: Testeo real
- Asistir a un partido del club
- Anotar puntos manualmente durante el partido
- Generar reporte al finalizar
- Probar análisis evolutivo con múltiples partidos del mismo equipo
- Solicitar feedback al entrenador

Fase 2: Definición de precios
Modalidad	Precio sugerido
Autogestión (mensual)	$30.000 - $70.000 ARS
Con operador (por partido)	$25.000 - $50.000 ARS
Anual (autogestión)	$400.000 ARS/año
Multiequipo	$600.000 ARS/año

Fase 3: Escalar (con clientes pagos)
- Migrar a servidor en la nube (Render o Railway, gratis o ~$5-10 USD/mes)
- Comprar dominio (voleyinsight.com.ar, ~$10 USD/año)
- Automatizar cambio de ID/nombres desde el dashboard
- Configurar Cloudflare con subdominios fijos (api.voleyinsight.com.ar, dashboard.voleyinsight.com.ar)

24. PREGUNTAS PARA HACER AL ENTRENADOR
- ¿Entendiste las métricas? ¿Cuál te pareció más útil?
- ¿El análisis evolutivo te ayuda a ver la progresión del equipo?
- ¿El reporte te dio información que no tenías viendo el partido?
- ¿Qué cambiarías o agregarías?
- ¿Cuánto estarías dispuesto a pagar por esto por mes?
- ¿Lo usarías solo para primera o también para inferiores?
- ¿Te interesaría que analice al próximo rival (si está en MetroVóley)?
- ¿Te gustaría recibir un informe mensual con la evolución de todas las métricas?

25. TIPS PARA ENTRENADORES (Cómo aprovechar VoleyInsight)
- Usá la pestaña EVOLUCIÓN después de 3 o más partidos para ver tendencias reales
- Sideout% > 60% = estás dominando cuando sacás. <45% = problema con tu saque o ataque
- Breakpoint% > 40% = tu recepción y contraataque funcionan bien
- Clutch% bajo (<40%) = entrená definición de sets y manejo de presión
- Eficiencia de servicio negativa = muchos errores de saque. Priorizá efectividad sobre potencia
- Guardá TODOS los reportes para poder hacer análisis evolutivo a fin de temporada
- Compará partidos para ver si las mejoras que entrenaste realmente aparecen en los números

26. CONTACTO Y SOPORTE
Recurso	Descripción
Configuración	data/config.json (cambiar ID, nombres y categoría)
Reglamento	data/reglamento.json (configurar sets por categoría)
URL de la API	data/api_url.txt (actualizar cuando cambie el túnel de Serveo)
Logs	tracker.log (en carpeta raíz)
Datos	Carpeta data/ (todos los JSON)
Reportes exportados	Se guardan donde el usuario elija
API Docs	http://localhost:3002/api/status

27. RESUMEN DE ESTADO

╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   🏐 VOLEYINSIGHT v2.8                                                       ║
║                                                                              ║
║   ✅ 40 mejoras implementadas (90%)                                          ║
║   ✅ Dashboard 100% funcional (3 vistas + selector)                          ║
║   ✅ Tracker 100% funcional (con monitor de config.json)                     ║
║   ✅ Anotador 100% funcional (con atajos de teclado)                         ║
║   ✅ Reporte HTML con gráficos y glosario                                    ║
║   ✅ API REST propia (con CORS)                                              ║
║   ✅ Modo offline                                                            ║
║   ✅ Tiempos muertos                                                         ║
║   ✅ WebSocket en tiempo real (con resuscripción)                            ║
║   ✅ Sideout% + Breakpoint%                                                  ║
║   ✅ Estadísticas de servicio por jugador                                    ║
║   ✅ Análisis evolutivo (comparativa de partidos)                            ║
║   ✅ SELECTOR DE PARTIDOS (funciona en celular)                              ║
║   ✅ DOBLE TÚNEL (Cloudflare + Serveo)                                       ║
║   ✅ LIMPIEZA AUTOMÁTICA DE LOCALSTORAGE                                     ║
║   ✅ PING KEEPALIVE PARA TÚNELES                                             ║
║                                                                              ║
║   🚀 LISTO PARA PRODUCCIÓN                                                   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

Documentación generada: Junio 2026
Versión del sistema: VoleyInsight v2.8
Estado: Producción - 40/44 mejoras implementadas (90%)
Novedades principales: Selector de partidos funcional en celular, doble túnel (Cloudflare + Serveo), resuscripción WebSocket, 
limpieza automática de localStorage, ping keepalive, CORS configurado.