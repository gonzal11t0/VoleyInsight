<p align="center">
  <img src="dashboard/logo-horizontal.png" alt="VoleyInsight" width="520">
</p>

# VoleyInsight

Sistema de análisis de voleibol en tiempo real. Se activa antes de cada partido o tira, acompaña la anotación durante el juego y genera un informe descargable al finalizar.

**Versión actual:** v3.2.3 (Actualizado: 13 de noviembre de 2026)

## Funciones principales

- Dashboard en vivo con marcador, rachas, momentum y evolución por set.
- Anotador manual optimizado para notebook y celular.
- **Soporte para categorías de 4 o 5 jugadoras** (ej. Sub-11, Sub-12) y formación estándar de 6.
- Estadísticas individuales acumuladas y separadas por set.
- Rotaciones adaptativas (1 a 6 o según cantidad de jugadoras), acumuladas o filtradas por set, con formación histórica.
- Sideout%: puntos ganados cuando el equipo recibe el saque rival.
- Breakpoint%: puntos ganados mientras el equipo tiene el saque.
- Clutch%: rendimiento en puntos críticos.
- Servicio: aces, errores y eficiencia real, sin confundir errores de ataque.
- Reporte HTML/PDF con gráficos, tablas por set y acumulado, rotaciones y glosario.
- Sincronización entre dispositivos y acceso remoto mediante Cloudflare.
- Pantalla de ingreso con selector Público/Operador y sesión de 30 días.
- Recuperación exacta de puntos omitidos, corrección individual y protección contra duplicados.
- Persistencia atómica con respaldo automático.
- **Comparación avanzada de hasta 5 informes** con análisis de evolución por partido, rotaciones y rendimiento individual.

## Análisis centrado en el equipo del club

El dashboard detecta automáticamente al equipo principal (por defecto **ATTITUDE**):

- Si ATTITUDE juega como **local**, todas las interpretaciones, insights y recomendaciones se refieren a ATTITUDE.
- Si ATTITUDE juega como **visitante**, el análisis sigue siendo de ATTITUDE, no del local.
- Si ATTITUDE **no participa** del partido, el sistema cae al equipo **LOCAL**.

Esto aplica a:
- Insights automáticos (incluye el clutch del equipo analizado).
- Bloque "Qué significan estos números".
- Bloque "Qué cambiar para el próximo partido".
- Reporte HTML descargable.
- **Comparación de informes** (métricas de equipo y jugadoras).

## Comparación de Informes

La pestaña **COMPARAR** permite cargar hasta 5 informes HTML generados por el sistema. 

- **Selección automática de equipo:** Sigue a ATTITUDE como local o visitante. Si no participa, analiza al equipo local.
- **Inclusión de parciales:** Un checkbox permite incluir informes de partidos que no han finalizado, para no perder datos en análisis en curso.
- **Métricas comparadas:** Sideout%, Breakpoint%, Clutch%, Eficiencia de Servicio, Puntos Ganados, **Errores Totales**, **Eficiencia de Ataque** y **Recepción Positiva**.
- **Análisis de Rotaciones:** Detecta automáticamente si alguna rotación específica perdió eficiencia entre partidos, advirtiendo que puede deberse a cambios de alineación.
- **Comparación individual (Jugadoras):** Cruza los nombres de las jugadoras que participaron en al menos dos de los informes cargados y muestra una tabla con su evolución en Puntos, Errores, Ataques, Bloqueos, Aces y Recepción.

## Uso operativo

El dashboard puede abrirse desde notebook o celular. El modo Público entra sin contraseña, muestra el análisis completo, pero oculta el anotador, la comparación, la descarga y la administración del partido.

## Inicio técnico

Requisitos: Node.js 18 o superior, Cloudflared y Windows 10/11.

```bash
npm install
npm test
Luego se ejecuta iniciar-partido.bat. La pantalla inicial permite verificar y seleccionar el partido sin editar data/config.json.

Antes del primer inicio, copiá .env.example como .env y configurá las variables requeridas.

Reportes
Al finalizar, el botón Guardar genera un archivo HTML independiente que conserva el marcador, sets, estadísticas de equipo e individuales. El reporte incluye un bloque de metadatos oculto (#voleyInsightReportData) que permite que ese mismo archivo sea subido a la pestaña de comparación en el futuro.

Pruebas
bash
npm test
Las pruebas cubren autenticación, eventos, persistencia, recuperación, comparativas, resúmenes de set, formaciones, rotaciones y métricas avanzadas.

Novedades v3.2.3 (13 de noviembre de 2026)
Comparación mejorada: Se agregó soporte para informes parciales (checkbox), lectura de formatos legacy y selector manual de equipo.

Nuevas métricas comparativas: Errores totales, Eficiencia de Ataque y Recepción Positiva, además del análisis de eficiencia por rotación.

Comparación individual: Nueva tabla que cruza los datos de las jugadoras (PTS, ERR, ATA, BLO, ACE, REC%) presentes en 2 o más informes.

Carga acumulativa: Los archivos ya no se reemplazan al subir un nuevo lote, se acumulan hasta un máximo de 5.

Tracker: Se corrigió un error al cerrar el proceso (generateAnalysisReport) y se silenciaron los logs de análisis en consola para mantener limpio el entorno de ejecución.

Contacto
Gonzalo · 11 5136-4852