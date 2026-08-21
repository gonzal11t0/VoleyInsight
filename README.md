<p align="center">
  <img src="dashboard/logo-horizontal.png" alt="VoleyInsight" width="520">
</p>

# VoleyInsight

Sistema de análisis de voleibol en tiempo real. Se activa antes de cada partido o tira, acompaña la anotación durante el juego y genera un informe descargable al finalizar.

## Funciones principales

- Dashboard en vivo con marcador, rachas, momentum y evolución por set.
- Anotador manual optimizado para notebook y celular.
- Estadísticas individuales acumuladas y separadas por set.
- Rotaciones 1 a 6, acumuladas o filtradas por set, con formación histórica.
- Sideout%: puntos ganados cuando el equipo recibe el saque rival.
- Breakpoint%: puntos ganados mientras el equipo tiene el saque.
- Clutch%: rendimiento en puntos críticos.
- Servicio: aces, errores y eficiencia real, sin confundir errores de ataque.
- Reporte HTML/PDF con gráficos, tablas por set y acumulado, rotaciones y glosario.
- Sincronización entre dispositivos y acceso remoto mediante Cloudflare.
- Acceso protegido por contraseña con roles Operador y Público y sesión de 30 días.
- Recuperación exacta de puntos omitidos, corrección individual y protección contra duplicados.
- Persistencia atómica con respaldo automático para puntos manuales e historial oficial.
- Comparación de hasta cinco informes siguiendo automáticamente al equipo principal.
- Gestión de partidos activos y próximos sin editar archivos JSON.
- Soporte offline para recursos ya cargados.

## Uso operativo

La instalación, configuración de Node.js, puertos, Cloudflare y archivos técnicos forman parte de la preparación del sistema y pueden quedar a cargo del operador de VoleyInsight. El entrenador o club no necesita editar código para usar el servicio durante un partido.

El dashboard puede abrirse desde notebook o celular. El modo Público muestra el análisis completo, pero oculta el anotador, la comparación, la descarga y la administración del partido.

## Inicio técnico

Requisitos: Node.js 18 o superior, Cloudflared y Windows 10/11.

```bash
npm install
npm test
```

Luego se ejecuta `iniciar-partido.bat`. La pantalla inicial permite verificar y
seleccionar el partido sin editar `data/config.json`. Si Metro todavía no habilitó
la planilla en vivo, el partido puede prepararse anticipadamente ingresando el ID,
los dos equipos y una categoría válida.

Antes del primer inicio, copiá `.env.example` como `.env` y configurá allí las
contraseñas privadas de Operador y Público. El archivo `.env` queda únicamente en
el equipo de trabajo y Git no lo publica. Las claves distinguen mayúsculas de
minúsculas.

## Reportes

Al finalizar, el botón **Guardar** genera un archivo independiente que conserva:

- marcador y sets;
- estadísticas del equipo e individuales;
- acumulado y detalle por set;
- Sideout, Breakpoint, Clutch y servicio;
- rotaciones y formaciones disponibles;
- gráficos e interpretación de métricas.

## Pruebas

```bash
npm test
```

Las pruebas cubren autenticación, eventos, persistencia y respaldos, recuperación, comparativas, resúmenes de set, formaciones, filtros, rotaciones, Sideout/Breakpoint y reconstrucción de saltos de marcador.

## Contacto

Gonzalo · 11 5136-4852
