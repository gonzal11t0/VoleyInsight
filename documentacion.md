📚 DOCUMENTACIÓN ACTUALIZADA - VOLEYINSIGHT v2.6
1. DESCRIPCIÓN GENERAL
VoleyInsight es un sistema de análisis de partidos de voleibol en tiempo real que:

Captura datos automáticos desde la API de Metro Vóley cada 3 segundos (con WebSocket para tiempo real)

Permite anotación manual de puntos y estadísticas individuales con atajos de teclado

Visualiza análisis en un dashboard profesional con dos vistas: PARTIDO e INDIVIDUALES

Exporta reportes en formato HTML con gráficos como imágenes base64 y glosario de métricas

Funciona offline con datos cacheados (Service Worker + IndexedDB)

API REST propia para consultar datos programáticamente

Análisis de tiempos muertos con registro manual

Sideout% y Breakpoint% para análisis ofensivo

Estadísticas de servicio por jugador (ACES, errores, eficiencia, total de saques)

2. ARQUITECTURA DEL SISTEMA
text
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
│                 ┌─────────────────────┐                                    │
│                 │     DASHBOARD       │                                    │
│                 │   index.html        │                                    │
│                 │                     │                                    │
│                 │  📊 VISTA PARTIDO   │                                    │
│                 │  👕 VISTA INDIVIDUAL│                                    │
│                 │  💾 Exportar HTML   │                                    │
│                 │  📡 Modo offline    │                                    │
│                 │  ⏸️ Tiempos muertos │                                    │
│                 │  📊 Sideout/Breakpoint                                   │
│                 └─────────────────────┘                                    │
│                            │                                                │
│                            ▼                                                │
│                 ┌─────────────────────┐                                    │
│                 │   API REST propia   │                                    │
│                 │   WebSocket Server  │                                    │
│                 └─────────────────────┘                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
3. ESTRUCTURA DE ARCHIVOS
text
voley/
├── dashboard/
│   ├── index.html              # Dashboard principal (con skeleton loading)
│   ├── anotador.html           # App de anotación manual
│   ├── favicon.ico             # Favicon
│   ├── icon.png                # Icono
│   └── js/
│       ├── reporteGenerator.js # Generación de reportes HTML
│       ├── sw.js               # Service Worker para modo offline
│       └── dashboard.js        # Backup (no usado)
├── data/
│   ├── config.json             # { matchId, homeTeam, awayTeam }
│   ├── match_*.json            # Puntos del partido (automático)
│   ├── full_*.json             # Datos completos de API
│   ├── jugadores_*.json        # Puntos anotados manualmente
│   ├── timeouts_*.json         # Tiempos muertos (localStorage)
│   └── breaks_*.json           # Breaks (localStorage)
├── src/
│   ├── core/
│   │   ├── tracker.js          # Lógica principal del tracker
│   │   └── stateProcessor.js   # Procesamiento de estados
│   ├── services/
│   │   └── api.js              # Conexión con API Metro Vóley
│   └── analytics/
│       ├── performanceAnalyzer.js  # Análisis de rendimiento
│       └── volleyballMetrics.js    # Métricas de voleibol
├── server-api.js               # Servidor Express (puerto 3002) con API REST y WebSocket
├── index.js                    # Punto de entrada del tracker
└── iniciar-partido.bat         # Lanzador automático (Windows)
4. COMPONENTES DEL SISTEMA
4.1 Tracker (Node.js)
Archivo	Función
index.js	Punto de entrada, lee config.json, maneja errores globales
src/core/tracker.js	Lógica principal: fetch cada 3s, procesa datos, guarda JSON, WebSocket
src/services/api.js	Conexión con API de Metro Vóley con timeout y retry
src/core/stateProcessor.js	Calcula rachas, breaks, fases, eventos
Comandos:

bash
npm start          # Iniciar tracker
npm run watch      # Monitor en vivo (terminal)
4.2 Dashboard (index.html)
Sección	Contenido
Header	Marcador en tiempo real, nombres de equipos, badge de saque
Pestañas	PARTIDO / INDIVIDUALES
Selector histórico	Busca partidos anteriores por ID
Vista PARTIDO	Stats grid (8 métricas), gráficos (4), dominancia por set, puntos de quiebre, insights, timeline, servicio, Sideout%, Breakpoint%
Vista INDIVIDUALES	Filtros por set, tablas de jugadores (con estadísticas de servicio), TOP 5, gráfico de puntos, análisis de tiempos muertos
Panel flotante	Estado del sistema, hora último punto, alertas de colapso, botón modo offline
Botones funcionales:

Botón	Función
📊 PARTIDO / 👕 INDIVIDUALES	Cambiar vista
💾 Guardar	Exportar reporte HTML con gráficos
🔄 Actualizar	Recargar datos manualmente
🔊 Sonidos	Activar/desactivar sonidos
⏱️ Selector de refresco	2s, 3s, 5s, 10s
📡 Modo offline	Forzar uso de datos cacheados
4.3 App de Anotación (anotador.html)
Pantalla	Función
Configuración	Armar equipos (agregar/eliminar números, marcar líberos)
Anotación	Seleccionar equipo → seleccionar jugador → seleccionar acción → confirmar punto
Acciones disponibles:

Acción	¿Necesita jugador?	Qué pasa
ATAQUE	✅ Sí	Punto para tu equipo
BLOQUEO	✅ Sí	Punto para tu equipo
ACE	✅ Sí	Punto para tu equipo (stats de servicio)
ERROR	✅ Sí	Punto para el otro equipo (stats de servicio)
ERROR_RIVAL	❌ No (botón especial)	Punto para tu equipo
OTRO	✅ Sí	Punto para tu equipo
TIMEOUT	❌ No (botón especial)	Registra tiempo muerto
BREAK	❌ No (botón especial)	Registra break (rompe saque rival)
Atajos de teclado:

Tecla	Acción	Tecla	Acción
Q	LOCAL	W	VISITANTE
A	ATAQUE	S	BLOQUEO
D	ACE	F	ERROR_RIVAL
R	ERROR	B	BREAK
T	TIMEOUT	H	OTRO
Enter	Confirmar	Z	Deshacer
X	Sin asistencia	0-9	Seleccionar jugador
+/-	Navegar jugador		
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
4.5 WebSocket en Tiempo Real
Característica	Descripción
Conexión	Persistente entre dashboard y servidor
Eventos	new_point cuando hay un nuevo punto
Suscripción	Por matchId
Fallback	Vuelve a polling (3s) si WebSocket falla
4.6 Modo Offline
Componente	Función
Service Worker (sw.js)	Cache de archivos estáticos
OfflineManager	Guarda datos en IndexedDB
ConnectionManager	Detecta cambios de conexión
Botón "Modo offline"	Fuerza uso de datos cacheados
4.7 Análisis de Tiempos Muertos
Característica	Descripción
Registro	Botón "⏸️ TIMEOUT" o tecla "T" en el anotador
Persistencia	Guardado en localStorage (timeouts_${matchId})
Análisis	Compara eficiencia 5 puntos antes vs 5 después
Visualización	Sección en INDIVIDUALES con lista de timeouts
Métricas	Total timeouts, efectividad, mejora promedio
4.8 Sideout% y Breakpoint%
Métrica	Definición	Fórmula
Sideout%	Puntos anotados cuando se TIENE el saque	(Puntos con saque propio / Total saques) × 100
Breakpoint%	Puntos anotados cuando NO se tiene el saque	(Puntos sin saque / Total recepciones) × 100
5. FLUJO DE DATOS
text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUJO DE DATOS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. TRACKER                                                                 │
│     ├── Fetch a API Metro Vóley cada 3 segundos                             │
│     ├── Procesa snapshot (rachas, breaks, eventos)                          │
│     ├── Emite punto por WebSocket al servidor                               │
│     └── Guarda en data/match_XXXXX.json y full_XXXXX.json                   │
│                                                                             │
│  2. SERVIDOR API + WEBSOCKET                                                │
│     ├── Recibe puntos por WebSocket o webhook                               │
│     ├── Reenvía puntos a todos los dashboards conectados                    │
│     └── Sirve archivos estáticos y API REST                                 │
│                                                                             │
│  3. DASHBOARD                                                               │
│     ├── Conecta por WebSocket para recibir puntos en tiempo real            │
│     ├── Lee data/config.json (ID, nombres equipos)                          │
│     ├── Lee data/match_XXXXX.json (puntos del partido)                      │
│     ├── Lee data/full_XXXXX.json (nombres de jugadores)                     │
│     ├── Lee localStorage (puntos manuales, timeouts, breaks)                │
│     ├── Guarda datos en IndexedDB para modo offline                         │
│     ├── Calcula Sideout% y Breakpoint%                                      │
│     └── Actualiza interfaz inmediatamente con WebSocket o cada 3s (fallback)│
│                                                                             │
│  4. APP DE ANOTACIÓN                                                        │
│     ├── Configura equipos (números, líberos)                                │
│     ├── Anota puntos (jugador, acción, asistencia)                          │
│     ├── Registra tiempos muertos con botón "⏸️ TIMEOUT"                     │
│     ├── Registra breaks con botón "⚡ BREAK"                                 │
│     ├── Guarda en localStorage automáticamente                              │
│     └── Exporta a JSON manualmente con botón                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
6. CONFIGURACIÓN
6.1 Archivo data/config.json
json
{
  "matchId": 156816,
  "homeTeam": "CAIT B",
  "awayTeam": "ATTITUDE"
}
Campo	Descripción
matchId	ID del partido en Metro Vóley
homeTeam	Nombre del equipo LOCAL
awayTeam	Nombre del equipo VISITANTE
6.2 Archivo .env
env
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
Break	Punto anotado sin estar sacando	Eficiencia en recepción y contraataque
Eficiencia	(Puntos propios / Puntos totales) × 100	Control general del partido
Clutch	% de puntos ganados en momentos críticos (set point o diferencia ≤2)	Temple bajo presión
Fase	EARLY (1-10), MID (11-20), LATE (21+)	Rendimiento por momento del set
Momentum	Diferencia de puntos en últimos 5 puntos	Quién viene dominando
Sets	25 puntos (diferencia 2) / Set decisivo: 15 puntos	Regla oficial de voleibol
Eficiencia Servicio	(Aces - Errores) / Total saques × 100	Efectividad del saque
Sideout%	(Puntos con saque propio / Total saques) × 100	Eficiencia ofensiva con saque
Breakpoint%	(Puntos sin saque / Total recepciones) × 100	Capacidad de romper saque rival
8. EVENTOS Y SONIDOS
Evento	Sonido	Frecuencia
Punto LOCAL	Tono agudo	880 Hz
Punto VISITANTE	Tono grave	440 Hz
Fin del partido	Fanfarria 3 notas	523-659-783 Hz
9. LANZAMIENTO DEL SISTEMA
9.1 Usando iniciar-partido.bat (Windows)
batch
iniciar-partido.bat
Abre automáticamente:

Servidor API + WebSocket (puerto 3002)

Tracker (terminal)

Servidor web (puerto 5500)

Dashboard en navegador

App de anotación en navegador

9.2 Manualmente
bash
# Terminal 1 - Servidor API + WebSocket
node server-api.js

# Terminal 2 - Tracker
npm start

# Terminal 3 - Servidor web
npx serve . -p 5500

# Navegador
http://localhost:5500/dashboard/index.html
http://localhost:5500/dashboard/anotador.html
10. URLs IMPORTANTES
Recurso	URL local
Dashboard	http://localhost:5500/dashboard/index.html
Anotador	http://localhost:5500/dashboard/anotador.html
API Status	http://localhost:3002/api/status
API Matches	http://localhost:3002/api/matches
WebSocket	ws://localhost:3002
Datos	http://localhost:5500/data/match_XXXXX.json
11. FORMATOS DE ARCHIVO
11.1 match_XXXXX.json (puntos del partido)
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
11.2 jugadores_XXXXX.json (estadísticas manuales)
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
11.3 timeouts_XXXXX (localStorage)
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
11.4 breaks_XXXXX (localStorage)
json
[{
  "timestamp": "2026-04-23T20:35:00.000Z",
  "set": 2,
  "equipo": "LOCAL",
  "tipo": "break",
  "marcador": "14-13"
}]
12. DEPENDENCIAS
json
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

Chart.js ^4.4.0

TailwindCSS

Socket.IO ^4.7.2

13. REQUISITOS TÉCNICOS
Requisito	Mínimo
Node.js	18.0.0 o superior
Navegador	Moderno (Chrome, Firefox, Edge)
Sistema operativo	Windows, Linux, macOS
Puertos	3002 (API/WebSocket), 5500 (dashboard)
Conexión	Internet (para API Metro Vóley) - Opcional para modo offline
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
17. LIMITACIONES ACTUALES
Limitación	Descripción
Un solo partido	El tracker solo puede seguir un partido a la vez
Dependencia externa	Requiere que Metro Vóley tenga el partido (para datos automáticos)
Anotación manual	Los puntos se exportan manualmente (no automático al servidor)
Sin base de datos	Los datos se guardan en archivos JSON
Sin autenticación	Cualquiera con la URL puede ver el dashboard
18. SOLUCIÓN DE PROBLEMAS COMUNES
Problema	Solución
Tracker se cierra	Agregar manejadores de errores en index.js
Dashboard no muestra datos	Verificar que match_*.json existe y tiene datos
No se ven nombres de jugadores	Esperar a que la API devuelva court (al inicio del set)
Error 404 en JSON	El partido no empezó o el ID es incorrecto
Puerto 3002 en uso	Cambiar puerto en server-api.js
Gráficos no cargan	Verificar stateProcessor.js original
Sets no se muestran	La API devuelve datos en match.sets
Modo offline no funciona	Verificar que sw.js esté registrado y IndexedDB disponible
WebSocket no conecta	Verificar que server-api.js esté corriendo
Skeleton no se oculta	Verificar timeout de seguridad en constructor
Sideout/Breakpoint no se ven	Verificar IDs correctos (Label) en HTML
19. MEJORAS IMPLEMENTADAS (32)
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
25	Botón ERROR_RIVAL	✅
26	Reporte UX/UI mejorado	✅
27	API REST propia	✅
28	Modo offline	✅
29	Análisis tiempos muertos	✅
30	WebSocket	✅
31	Sideout% + Breakpoint%	✅
32	Skeleton loading	✅
20. MEJORAS PENDIENTES (4 - Opcionales)
#	Mejora	Tiempo	Dificultad
33	Autenticación	2h	Media
34	Múltiples partidos simultáneos	4h	Alta
35	Base de datos	3h	Alta
36	Compartir reporte	1.5h	Media
21. PLAN DE ACCIÓN COMERCIAL
Fase 1: Testeo real
Asistir a un partido del club de tu hermana

Anotar puntos manualmente durante el partido

Generar reporte al finalizar

Solicitar feedback al entrenador

Fase 2: Definición de precios
Modalidad	Precio sugerido
Autogestión (mensual)	
30.000
−
30.000−70.000 ARS
Con operador (por partido)	
25.000
−
25.000−50.000 ARS
Anual (autogestión)	$400.000 ARS/año
Multiequipo	$600.000 ARS/año
Fase 3: Escalar (con clientes pagos)
Migrar a servidor en la nube (Render o Railway, gratis o ~$5-10 USD/mes)

Comprar dominio (voleyinsight.com.ar, ~$10 USD/año)

Automatizar cambio de ID/nombres desde el dashboard

22. PREGUNTAS PARA HACER AL ENTRENADOR
¿Entendiste las métricas? ¿Cuál te pareció más útil?

¿El reporte te dio información que no tenías viendo el partido?

¿Qué cambiarías o agregarías?

¿Cuánto estarías dispuesto a pagar por esto por mes?

¿Lo usarías solo para primera o también para inferiores?

¿Te interesaría que analice al próximo rival (si está en MetroVóley)?

23. CONTACTO Y SOPORTE
Recurso	Descripción
Configuración	data/config.json (cambiar ID y nombres)
Logs	tracker.log (en carpeta raíz)
Datos	Carpeta data/ (todos los JSON)
Reportes exportados	Se guardan donde el usuario elija
API Docs	http://localhost:3002/api/status
24. RESUMEN DE ESTADO
text
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🏐 VOLEYINSIGHT v2.6                                       ║
║                                                              ║
║   ✅ 32 mejoras implementadas                                ║
║   ✅ Dashboard 100% funcional                                ║
║   ✅ Tracker 100% funcional                                  ║
║   ✅ Anotador 100% funcional                                 ║
║   ✅ Reporte HTML con gráficos y glosario                    ║
║   ✅ API REST propia                                         ║
║   ✅ Modo offline                                            ║
║   ✅ Tiempos muertos                                         ║
║   ✅ WebSocket en tiempo real                                ║
║   ✅ Sideout% + Breakpoint%                                  ║
║   ✅ Estadísticas de servicio por jugador                    ║
║                                                              ║
║   🚀 LISTO PARA PRODUCCIÓN                                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
Documentación generada: 28 de Abril 2026
Versión del sistema: VoleyInsight v2.6
Estado: Producción - 32/36 mejoras implementadas (89%)