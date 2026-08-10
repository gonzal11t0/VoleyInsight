// dashboard/js/dashboard.js
import { OfflineManager, SoundManager } from './utils.js';
import { ReporteGenerator } from './reporteGenerator.js';
import {
    calcularStatsPorJugador, actualizarTablaConStats, renderizarSoloNombres,
    renderizarTop5ConNombres, renderizarGraficoPuntos, calcularEstadisticasServicio,
    generarTablaHTMLSimple, resumirPuntosEquipo, renderizarTarjetasMoviles
} from './StatsHelper.js';
import {
    calcularRotacionesPorEquipo,
    obtenerStatsRotacion as obtenerStatsRotacionHelper,
    rotarFormacion,
    filtrarPuntosPorSet,
    seleccionarPuntosParaRotaciones
} from './rotacionHelper.js';
import { calcularMetricasRally, resumirUltimosPuntos } from './metricasVoleyHelper.js';
import {
    evaluarEstadoPartido,
    extraerEstadoOficial,
    isSetTerminado as isSetTerminadoHelper
} from './partidoHelper.js';
import {
    calcularTendencias,
    crearReporteLegacy,
    generarConclusiones,
    numeroONull,
    prepararComparativa,
    reporteDesdeMetadata
} from './comparativaHelper.js';

export class VolleyballDashboard {
    constructor() {
        this.timeouts = [];
        this.socket = null;
        this.useWebSocket = true;
        this.data = [];
        this.charts = {};
        this.matchId = null;
        this.homeTeamName = "LOCAL";
        this.awayTeamName = "VISITANTE";
        this.soundManager = new SoundManager();
        this.lastPointCount = 0;
        this.matchEnded = false;
        this.partidoTerminado = false;
        this.estadoOficialPartido = null;
        this.vistaActual = 'partido';
        this.filtroSet = 'all';
        this.filtroRotaciones = 'all';
        this.puntosJugadores = [];
        this.chartPuntosJugadores = null;
        this.jugadoresLocal = {};
        this.jugadoresVisitante = {};
        this.formacionInicialPorSet = {};
        this.reportesCargados = [];
        this.chartEvolucion = null;
        this.refreshInterval = null;
        this.ultimoPuntoSonido = null;
        this.categoria = null;
        this.reglamento = null;
        this.configSets = { maxSets: 3, setsParaGanar: 2, puntosSetNormal: 25, puntosSetDecisivo: 15 };
        this.offlineMode = false;
        this.chartRotaciones = null;
        this.puntosManualesInterval = null;
        this.livePanelInterval = null;
        this.socketKeepAliveInterval = null;
        this.keepAliveInterval = null;
        window.dashboard = this;

        this.setupEventListeners();
        this.setupModalEvents();
        this.setupPwaInstall();

        this.mostrarSkeleton(true);
        setTimeout(() => this.mostrarSkeleton(false), 5000);

        document.body.addEventListener('click', () => {
            if (this.soundManager.audioContext && this.soundManager.audioContext.state === 'suspended') {
                this.soundManager.audioContext.resume();
                this.mostrarFeedbackPartido('🔊 Sonidos activados', 'success');
            }
        }, { once: true });

        this.cargarReglamento().then(() => {
            this.cargarConfiguracion().then(() => {
                this.aplicarConfiguracionSets();
                this.connectWebSocket();
                this.loadData();
                this.setupRefreshIntervalSelector();
                this.startConnectionMonitor();
                this.setupLivePanel();
                this.setupPanelMinimizable();
                this.cargarListaPartidos();
                this.setupSelectorPartido();
                this.cargarPuntosJugadores();
                this.setupTabs();
                this.setupFiltrosSets();
                this.setupFiltrosRotaciones();
                this.setupReportUpload();
                this.startAutoRefreshPuntos();
                this.actualizarSets();
            });
        });

        this.keepAliveInterval = setInterval(async () => {
            try {
                await fetch('/keepalive');
            } catch (e) {}
        }, 25000);
    } 

    

    destruirGrafico(canvasId, chartKey) {
        if (this.charts[chartKey]) {
            this.charts[chartKey].destroy();
            this.charts[chartKey] = null;
        }
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const parent = canvas.parentNode;
            if (parent) {
                const newCanvas = document.createElement('canvas');
                newCanvas.id = canvasId;
                newCanvas.className = canvas.className;
                parent.replaceChild(newCanvas, canvas);
            }
        }
    }

    setupModalEvents() {
        const modal = document.getElementById('modalRotacion');
        const cerrarBtn = document.getElementById('modalRotacionCerrar');
        
        this.cerrarModalRotacion = () => {
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        };
        
        if (cerrarBtn) {
            cerrarBtn.addEventListener('click', this.cerrarModalRotacion);
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.cerrarModalRotacion();
                }
            });
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                this.cerrarModalRotacion();
            }
        });
    }

    async obtenerUrlApi() {
        const url = window.location.origin;
        return url;
    }


    async cargarPuntosJugadores() {
        try {
            const apiUrl = await this.obtenerUrlApi();
            const response = await fetch(`${apiUrl}/api/puntos/${this.matchId}`);
            if (response.ok) {
                const data = await response.json();
                this.puntosJugadores = data.data || [];
                this.actualizarVistaIndividuales();
                return;
            }
            if (Object.keys(this.jugadoresLocal).length === 0) {
                const nombresLocal = localStorage.getItem(`jugadores_${this.matchId}_local`);
                if (nombresLocal) {
                    this.jugadoresLocal = JSON.parse(nombresLocal);
                }
                const nombresVisitante = localStorage.getItem(`jugadores_${this.matchId}_visitante`);
                if (nombresVisitante) {
                    this.jugadoresVisitante = JSON.parse(nombresVisitante);
                }
                this.actualizarVistaIndividuales();
            }
        } catch (e) {
            console.log('Error cargando puntos manuales:', e);
        }
        this.puntosJugadores = [];
        this.actualizarVistaIndividuales();
    }


    async recargarPuntosManuales() {
        try {
            const apiUrl = await this.obtenerUrlApi();
            const response = await fetch(`${apiUrl}/api/puntos/${this.matchId}`);
            if (response.ok) {
                const data = await response.json();
                this.puntosJugadores = data.data || [];
                this.actualizarVistaIndividuales();
            }
        } catch (e) {
            console.log('Error recargando puntos manuales:', e);
        }
    }


    startAutoRefreshPuntos() {
        if (this.puntosManualesInterval) clearInterval(this.puntosManualesInterval);
        this.puntosManualesInterval = setInterval(() => {
            this.recargarPuntosManuales();
        }, 10000);
    }

    async connectWebSocket() {
        if (!this.useWebSocket) return;
        try {
            const apiUrl = await this.obtenerUrlApi();
            this.socket = io(apiUrl, { transports: ['polling', 'websocket'], reconnection: true });
            
            this.socket.on('connect', () => {
                this.socket.emit('subscribe', this.matchId);
                this.mostrarFeedbackPartido('📡 Conexión en tiempo real activada');
            });

            this.socket.on('partido_terminado', () => {
                console.log('🏁 Se recibió una notificación de final; verificando el estado oficial...');
                this.loadData();
            });

            this.socket.on('partido_sin_actividad', (estado) => {
                const segundos = estado?.secondsWithoutPoints || 120;
                console.log(`⏸️ Sin puntos durante ${segundos}s; el seguimiento continúa`);
                this.mostrarFeedbackPartido('⏸️ Pausa sin puntos. El seguimiento continúa.');
            });

            this.socket.on('punto_manual', (punto) => {
                console.log('📝 Punto manual recibido:', punto);
                this.recargarPuntosManuales();
            });
            
            this.socket.on('new_point', () => {
                this.loadData();
            });
            
            this.socket.on('disconnect', () => this.mostrarFeedbackPartido('⚠️ Cambiando a modo polling'));
            
            if (this.socketKeepAliveInterval) clearInterval(this.socketKeepAliveInterval);
            this.socketKeepAliveInterval = setInterval(() => {
                if (this.socket && this.socket.connected) this.socket.emit('ping_keepalive');
            }, 25000);
        } catch (e) {
            console.log('WebSocket no disponible, usando polling');
            this.useWebSocket = false;
        }
    }


    limpiarDOMCompletamente() {
        const elementos = ['homeScore', 'awayScore', 'tablaLocalBody', 'tablaVisitanteBody', 'maxRunHome', 'maxRunAway',
            'breaksHome', 'breaksAway', 'efficiencyHome', 'efficiencyAway', 'totalPoints', 'clutchHome',
            'serviceAcesHome', 'serviceErrorsHome', 'serviceEfficiencyHome', 'serviceAcesAway', 'serviceErrorsAway',
            'serviceEfficiencyAway', 'sideoutLocalLabel', 'sideoutVisitanteLabel', 'breakpointLocalLabel',
            'breakpointVisitanteLabel', 'setsList', 'breakPointsList', 'timeline', 'insightsList',
            'metricInterpretations', 'actionableRecommendations', 'setDominance'
        ];
        elementos.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.tagName === 'DIV') el.innerHTML = id.includes('set') ? '<div class="text-gray-500 text-xs">Cargando sets...</div>' : '';
                else if (el.tagName === 'SPAN' || el.tagName === 'TD') el.textContent = '0';
                else if (el.tagName === 'TD') el.textContent = '';
                else el.textContent = '0';
            }
        });
        ['sideoutBarLocal', 'breakpointBarLocal', 'clutchBarHome', 'clutchBarAway'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.width = '0%';
        });
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) { this.charts[key].destroy();
                this.charts[key] = null; }
        });
    }

    async cargarListaPartidos() {
        try {
            const response = await fetch('/data/config.json');
            if (response.ok) {
                const config = await response.json();
                this.listaPartidos = config.partidos || [];
                const selector = document.getElementById('partidoSelector');
                if (selector && this.listaPartidos.length > 0) {
                    selector.innerHTML = this.listaPartidos.map(p =>
                        `<option value="${p.id}" ${p.id == this.matchId ? 'selected' : ''}>${p.id} - ${p.homeTeam} vs ${p.awayTeam}</option>`
                    ).join('');
                }
            }
        } catch (e) { console.log('Error cargando lista de partidos'); }
    }

    setupPanelMinimizable() {
        const panelContent = document.getElementById('panelContent');
        const toggleBtn = document.getElementById('togglePanelBtn');
        const panelHeader = document.getElementById('panelHeader');
        if (!panelContent || !toggleBtn) return;
        const preferenciaGuardada = localStorage.getItem('panelMinimizado');
        const estaMinimizado = preferenciaGuardada === 'true' || (preferenciaGuardada === null && window.innerWidth <= 480);
        const aplicarEstado = (minimizado) => {
            panelContent.style.display = minimizado ? 'none' : 'block';
            toggleBtn.innerHTML = minimizado ? '+' : '−';
            document.getElementById('coachPanel')?.classList.toggle('panel-minimizado', minimizado);
        };
        aplicarEstado(estaMinimizado);
        const toggle = () => {
            if (panelContent.style.display === 'none') {
                aplicarEstado(false);
                localStorage.setItem('panelMinimizado', 'false');
            } else {
                aplicarEstado(true);
                localStorage.setItem('panelMinimizado', 'true');
            }
        };
        toggleBtn.addEventListener('click', (e) => { e.stopPropagation();
            toggle(); });
        if (panelHeader) {
            panelHeader.addEventListener('click', (e) => {
                if (e.target === toggleBtn) return;
                toggle();
            });
        }
    }

    setupSelectorPartido() {
        const btn = document.getElementById('cargarPartidoBtn');
        const selector = document.getElementById('partidoSelector');
        if (!btn || !selector) return;
        btn.addEventListener('click', async () => {
            const nuevoId = parseInt(selector.value);
            if (!nuevoId || nuevoId == this.matchId) {
                this.mostrarFeedbackPartido('⚠️ Ya estás en ese partido');
                return;
            }
            const partido = this.listaPartidos?.find(p => p.id === nuevoId);
            const descripcion = partido
                ? `${partido.homeTeam} vs ${partido.awayTeam}`
                : `Match ID ${nuevoId}`;
            if (!window.confirm(`¿Cambiar a ${descripcion}?\n\nLos datos del partido actual se conservarán.`)) return;
            btn.disabled = true;
            btn.textContent = '🔎 VERIFICANDO EN METRO…';
            try {
                const apiUrl = await this.obtenerUrlApi();
                const response = await fetch(`${apiUrl}/api/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        matchId: nuevoId,
                        homeTeam: partido?.homeTeam,
                        awayTeam: partido?.awayTeam,
                        categoria: partido?.categoria
                    })
                });
                const resultado = await response.json();
                if (!response.ok) throw new Error(resultado.error || 'Error al actualizar config.json');
                this.mostrarFeedbackPartido(`✅ Cambiando a ${descripcion}. Los datos anteriores se conservaron.`);
                sessionStorage.removeItem('voleyinsight_acceso_local_v2');
                setTimeout(() => window.location.reload(), 700);
            } catch (e) {
                console.error('Error actualizando config.json:', e);
                this.mostrarFeedbackPartido(`❌ ${e.message}`);
                btn.disabled = false;
                btn.textContent = '📋 CARGAR PARTIDO';
            }
        });
    }

    setupReportUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('reportFilesInput');
        const analizarBtn = document.getElementById('analizarComparativaBtn');
        const equipoSelector = document.getElementById('equipoCompararSelector');
        if (!uploadArea) return;
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault();
            uploadArea.classList.add('border-primary', 'bg-primary/10'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('border-primary', 'bg-primary/10'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-primary', 'bg-primary/10');
            const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.html'));
            this.procesarReportes(files);
        });
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.html'));
            this.procesarReportes(files);
            e.target.value = '';
        });
        analizarBtn.addEventListener('click', () => this.generarAnalisisComparativo());
        equipoSelector?.addEventListener('change', () => this.actualizarEstadoComparativa());
    }

    async procesarReportes(files) {
        const reportList = document.getElementById('reportList');
        if (!reportList) return;
        this.reportesCargados = [];
        reportList.innerHTML = '';
        document.getElementById('analisisResultados')?.classList.add('hidden');
        if (!files.length) {
            const vacio = document.createElement('div');
            vacio.className = 'text-sm text-amber-400';
            vacio.textContent = 'Seleccioná archivos HTML de informes VoleyInsight.';
            reportList.appendChild(vacio);
        }
        for (const file of files) {
            try {
                const text = await file.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                const datos = this.extraerDatosDeReporte(doc, file.name);
                if (datos) {
                    this.reportesCargados.push(datos);
                    this.agregarItemReporte(reportList, datos, file.name);
                } else {
                    this.agregarItemReporte(reportList, null, file.name, '❌ No es un informe VoleyInsight compatible.');
                }
            } catch (e) {
                console.error('Error procesando archivo:', file.name, e);
                this.agregarItemReporte(reportList, null, file.name, '❌ No se pudo leer el archivo.');
            }
        }
        this.actualizarEstadoComparativa();
    }

    agregarItemReporte(contenedor, reporte, nombreArchivo, error = '') {
        const item = document.createElement('div');
        item.className = `flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 rounded-lg p-2 ${error ? 'bg-red-900/30' : 'bg-gray-800'}`;
        const detalle = document.createElement('div');
        detalle.className = 'min-w-0';
        const titulo = document.createElement('div');
        titulo.className = `text-sm truncate ${error ? 'text-red-300' : 'text-gray-100'}`;
        titulo.textContent = reporte?.nombrePartido || nombreArchivo;
        const fecha = document.createElement('div');
        fecha.className = 'text-xs text-gray-500';
        fecha.textContent = reporte?.fecha || nombreArchivo;
        detalle.append(titulo, fecha);
        const estado = document.createElement('span');
        estado.className = 'text-xs shrink-0';
        if (error) {
            estado.classList.add('text-red-400');
            estado.textContent = error;
        } else if (!reporte.metricasCompatibles) {
            estado.classList.add('text-amber-400');
            estado.textContent = '⚠ Formato anterior · no incluido';
        } else if (reporte.estado === 'partial') {
            estado.classList.add('text-amber-400');
            estado.textContent = '🟡 Partido parcial · no incluido';
        } else if (reporte.estado === 'unknown') {
            estado.classList.add('text-amber-300');
            estado.textContent = '🟡 Final no verificable';
        } else {
            estado.classList.add('text-green-400');
            estado.textContent = '✓ Listo para comparar';
        }
        item.append(detalle, estado);
        contenedor.appendChild(item);
    }

    extraerDatosDeReporte(doc, nombreArchivo) {
        try {
            const metadataElem = doc.querySelector('#voleyInsightReportData');
            if (metadataElem) {
                try {
                    const reporte = reporteDesdeMetadata(JSON.parse(metadataElem.textContent || '{}'), nombreArchivo);
                    if (reporte) return reporte;
                } catch (e) {
                    console.warn('Metadatos de comparación inválidos:', nombreArchivo, e.message);
                }
            }
            const contenedorReporte = doc.querySelector('.container');
            const pareceVoleyInsight = Boolean(
                contenedorReporte &&
                (doc.title.includes('VoleyInsight') || doc.body?.textContent?.includes('VoleyInsight'))
            );
            if (!pareceVoleyInsight) return null;
            const fechaElem = doc.querySelector('.date');
            const statCards = doc.querySelectorAll('.stat-card');
            const fecha = fechaElem ? fechaElem.textContent.replace('📅', '').trim() : '';
            let homeTeam = '';
            let awayTeam = '';
            let resultado = '';
            const teamScores = doc.querySelectorAll('.team-score');
            if (teamScores.length >= 2) {
                const homeNameElem = teamScores[0].querySelector('.team-name');
                const awayNameElem = teamScores[1].querySelector('.team-name');
                const homeScoreElem = teamScores[0].querySelector('.score-number');
                const awayScoreElem = teamScores[1].querySelector('.score-number');
                homeTeam = homeNameElem?.textContent?.trim() || '';
                awayTeam = awayNameElem?.textContent?.trim() || '';
                resultado = `${homeScoreElem?.textContent?.trim() || '0'} - ${awayScoreElem?.textContent?.trim() || '0'}`;
            }
            if (!homeTeam || !awayTeam) return null;
            let efficiencyHome = null;
            let efficiencyAway = null;
            let clutchHome = null;
            statCards.forEach(card => {
                const label = card.querySelector('.stat-label')?.textContent || '';
                const numValue = numeroONull(parseFloat(card.querySelector('.stat-value')?.textContent || ''));
                const labelNormalizado = label.toUpperCase();
                if (labelNormalizado.includes('EFICIENCIA') && labelNormalizado.includes(homeTeam.toUpperCase())) efficiencyHome = numValue;
                else if (labelNormalizado.includes('EFICIENCIA') && labelNormalizado.includes(awayTeam.toUpperCase())) efficiencyAway = numValue;
                if (labelNormalizado.includes('BAJO PRESIÓN') || labelNormalizado.includes('CLUTCH')) clutchHome = numValue;
            });
            const esquema = contenedorReporte.dataset.metricSchema || '';
            const atributosRequeridos = [
                'data-sideout-home', 'data-sideout-away',
                'data-breakpoint-home', 'data-breakpoint-away',
                'data-service-home', 'data-service-away'
            ];
            const esquemaValido = esquema === 'standard-v1'
                && atributosRequeridos.every(atributo => contenedorReporte.hasAttribute(atributo));
            const leerDataset = (clave) => contenedorReporte.hasAttribute(`data-${clave.replace(/[A-Z]/g, letra => `-${letra.toLowerCase()}`)}`)
                ? numeroONull(contenedorReporte.dataset[clave])
                : null;
            const estado = /(?:🔴\s*)?EN CURSO/i.test(doc.body?.textContent || '') ? 'partial' : 'unknown';
            return crearReporteLegacy({
                nombreArchivo,
                version: contenedorReporte.dataset.version || '',
                esquema: esquemaValido ? esquema : '',
                homeTeam,
                awayTeam,
                fecha,
                estado,
                resultado,
                metrics: {
                    sideoutHome: leerDataset('sideoutHome'),
                    sideoutAway: leerDataset('sideoutAway'),
                    breakpointHome: leerDataset('breakpointHome'),
                    breakpointAway: leerDataset('breakpointAway'),
                    serviceHome: leerDataset('serviceHome'),
                    serviceAway: leerDataset('serviceAway'),
                    clutchHome,
                    clutchAway: clutchHome === null ? null : Number((100 - clutchHome).toFixed(1)),
                    efficiencyHome,
                    efficiencyAway
                }
            });
        } catch (e) {
            console.error('Error extrayendo datos:', e);
            return null;
        }
    }

    actualizarEstadoComparativa() {
        const analizarBtn = document.getElementById('analizarComparativaBtn');
        const estadoElem = document.getElementById('comparativaEstado');
        const selectorContenedor = document.getElementById('equipoCompararContenedor');
        const selector = document.getElementById('equipoCompararSelector');
        if (!analizarBtn || !estadoElem || !selector || !selectorContenedor) return;
        let comparativa = prepararComparativa(this.reportesCargados, selector.value || null);
        const opcionesAnteriores = Array.from(selector.options).map(opcion => opcion.value).filter(Boolean);
        if (comparativa.equiposComunes?.length > 1) {
            selectorContenedor.classList.remove('hidden');
            const debenActualizarse = comparativa.equiposComunes.some(equipo => !opcionesAnteriores.includes(equipo))
                || opcionesAnteriores.length !== comparativa.equiposComunes.length;
            if (debenActualizarse) {
                selector.replaceChildren(new Option('Elegí un equipo', ''));
                comparativa.equiposComunes.forEach(equipo => selector.add(new Option(equipo, equipo)));
            }
            comparativa = prepararComparativa(this.reportesCargados, selector.value || null);
        } else {
            selectorContenedor.classList.add('hidden');
            selector.replaceChildren(new Option('', ''));
        }
        estadoElem.textContent = comparativa.ok
            ? `${comparativa.serie.length} informes listos · ${comparativa.equipoNombre}`
            : comparativa.mensaje;
        estadoElem.className = `mt-3 text-xs ${comparativa.ok ? 'text-green-400' : 'text-amber-400'}`;
        analizarBtn.disabled = !comparativa.ok;
        analizarBtn.classList.toggle('opacity-50', !comparativa.ok);
        analizarBtn.classList.toggle('cursor-not-allowed', !comparativa.ok);
    }

    generarAnalisisComparativo() {
        const resultados = document.getElementById('analisisResultados');
        const resumenElem = document.getElementById('resumenEjecutivo');
        const fortalezasElem = document.getElementById('fortalezasList');
        const debilidadesElem = document.getElementById('debilidadesList');
        const tablaBody = document.getElementById('evolucionTablaBody');
        const equipoSelector = document.getElementById('equipoCompararSelector');
        if (!resultados || this.reportesCargados.length === 0) return;
        resultados.classList.remove('hidden');
        const comparativa = prepararComparativa(this.reportesCargados, equipoSelector?.value || null);
        if (!comparativa.ok) {
            resumenElem.textContent = comparativa.mensaje;
            fortalezasElem.replaceChildren();
            debilidadesElem.replaceChildren();
            tablaBody.replaceChildren();
            const fila = tablaBody.insertRow();
            const celda = fila.insertCell();
            celda.colSpan = 6;
            celda.className = 'text-center py-8 text-amber-400';
            celda.textContent = comparativa.mensaje;
            return;
        }
        const tendencias = calcularTendencias(comparativa.serie);
        const conclusiones = generarConclusiones(tendencias, 3);
        const primero = comparativa.serie[0];
        const ultimo = comparativa.serie.at(-1);
        const periodo = `${this.formatearFechaComparativa(primero)} → ${this.formatearFechaComparativa(ultimo)}`;
        const advertencia = comparativa.advertencias.length ? ` ${comparativa.advertencias.join(' ')}` : '';
        resumenElem.textContent = `Comparando ${comparativa.equipoNombre} en ${comparativa.serie.length} partidos (${periodo}). Las conclusiones comparan el primer informe con el último.${advertencia}`;

        const mejoras = conclusiones.filter(item => item.tipo === 'mejora');
        const revisar = conclusiones.filter(item => item.tipo !== 'mejora');
        this.renderizarConclusionesComparativa(fortalezasElem, mejoras, 'No se detectaron mejoras mayores a 2 puntos.', 'mejora');
        this.renderizarConclusionesComparativa(debilidadesElem, revisar, 'No se detectaron caídas: las métricas comparables se mantuvieron.', 'revisar');

        tablaBody.replaceChildren();
        comparativa.serie.forEach(reporte => {
            const fila = tablaBody.insertRow();
            fila.className = 'border-b border-gray-700';
            const partido = fila.insertCell();
            partido.className = 'py-2';
            const titulo = document.createElement('div');
            titulo.className = 'font-medium';
            titulo.textContent = `${reporte.equipo} vs ${reporte.rival}`;
            const detalle = document.createElement('div');
            detalle.className = 'text-xs text-gray-500';
            detalle.textContent = `${this.formatearFechaComparativa(reporte)}${reporte.resultado ? ` · ${reporte.resultado}` : ''}`;
            partido.append(titulo, detalle);
            ['sideout', 'breakpoint', 'clutch', 'service', 'efficiency'].forEach(clave => {
                const celda = fila.insertCell();
                const valor = numeroONull(reporte.metricas?.[clave]);
                celda.className = `text-center font-bold ${this.colorMetricaComparativa(clave, valor)}`;
                celda.textContent = valor === null ? '—' : `${valor}%`;
            });
        });
        this.renderEvolucionChart(comparativa.serie);
    }

    renderizarConclusionesComparativa(contenedor, conclusiones, vacio, tipo) {
        contenedor.replaceChildren();
        const items = conclusiones.length ? conclusiones : [{ texto: vacio }];
        items.forEach(item => {
            const div = document.createElement('div');
            const verde = tipo === 'mejora';
            div.className = `${verde ? 'bg-green-900/20 border-green-500' : 'bg-amber-900/20 border-amber-500'} rounded-lg p-2 border-l-4`;
            div.textContent = item.texto;
            contenedor.appendChild(div);
        });
    }

    formatearFechaComparativa(reporte) {
        const fecha = Date.parse(reporte.generatedAt || '');
        if (Number.isFinite(fecha)) return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(fecha);
        return reporte.fecha || 'Fecha desconocida';
    }

    colorMetricaComparativa(clave, valor) {
        if (valor === null) return 'text-gray-500';
        if (clave === 'sideout') return valor >= 60 ? 'text-green-400' : valor >= 45 ? 'text-yellow-400' : 'text-red-400';
        if (clave === 'breakpoint') return valor >= 40 ? 'text-green-400' : valor >= 25 ? 'text-yellow-400' : 'text-red-400';
        if (clave === 'clutch') return valor >= 60 ? 'text-green-400' : valor >= 45 ? 'text-yellow-400' : 'text-red-400';
        if (clave === 'service') return valor >= 10 ? 'text-green-400' : valor >= 0 ? 'text-yellow-400' : 'text-red-400';
        return valor >= 55 ? 'text-green-400' : valor >= 45 ? 'text-yellow-400' : 'text-red-400';
    }

    renderEvolucionChart(reportes) {
        const canvas = document.getElementById('evolucionChart');
        if (!canvas) return;
        if (this.chartEvolucion) this.chartEvolucion.destroy();
        const labels = reportes.map(reporte => `${this.formatearFechaComparativa(reporte)} · ${reporte.rival}`);
        this.chartEvolucion = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Sideout%', data: reportes.map(r => numeroONull(r.metricas?.sideout)), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 2, fill: false, tension: 0.2, spanGaps: false },
                    { label: 'Breakpoint%', data: reportes.map(r => numeroONull(r.metricas?.breakpoint)), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 2, fill: false, tension: 0.2, spanGaps: false },
                    { label: 'Bajo presión', data: reportes.map(r => numeroONull(r.metricas?.clutch)), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 2, fill: false, tension: 0.2, spanGaps: false }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#fff', font: { size: 10 } } },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%` } }
                },
                scales: {
                    y: { min: 0, max: 100, ticks: { color: '#9ca3af', callback: (v) => v + '%' }, grid: { color: '#1f2937' } },
                    x: { ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 45 }, grid: { color: '#1f2937' } }
                }
            }
        });
    }

    mostrarSkeleton(mostrar) {
        const skeleton = document.getElementById('skeletonLoader');
        const realContent = document.getElementById('realContent');
        if (mostrar) {
            if (skeleton) skeleton.style.display = 'flex';
            if (realContent) realContent.style.display = 'none';
        } else {
            if (skeleton) skeleton.style.display = 'none';
            if (realContent) realContent.style.display = 'block';
        }
    }

    setupLivePanel() {
        if (this.livePanelInterval) clearInterval(this.livePanelInterval);
        this.livePanelInterval = setInterval(() => {
            if (this.data && this.data.length > 0) this.updateLivePanel();
        }, 1000);
    }

    startConnectionMonitor() {
        let interval = 10000;
        const monitor = () => {
            this.checkConnection();
            const text = document.getElementById('connectionText');
            interval = text?.textContent.includes('Sin conexión') ? 3000 : 10000;
            setTimeout(() => monitor(), interval);
        };
        monitor();
        this.checkConnection();
    }

    async cargarReglamento() {
        try {
            const response = await fetch('/data/reglamento.json');
            if (response.ok) {
                this.reglamento = await response.json();
                return true;
            }
        } catch (e) { console.error('Error cargando reglamento:', e); }
        return false;
    }

    aplicarConfiguracionSets() {
        if (!this.reglamento || !this.categoria) {
            this.configSets = { maxSets: 3, setsParaGanar: 2, puntosSetNormal: 25, puntosSetDecisivo: 15 };
            return;
        }
        const categoriaData = this.reglamento.reglamento.categorias[this.categoria];
        if (categoriaData) {
            this.configSets = {
                maxSets: categoriaData.max_sets,
                setsParaGanar: categoriaData.sets_para_ganar,
                puntosSetNormal: categoriaData.puntos_por_set,
                puntosSetDecisivo: categoriaData.set_decisivo_puntos
            };
        } else {
            console.log(`⚠️ Categoría "${this.categoria}" no encontrada. Usando valores por defecto.`);
            this.configSets = { maxSets: 3, setsParaGanar: 2, puntosSetNormal: 25, puntosSetDecisivo: 15 };
        }
    }

    async cargarTimeouts() {
        const timeoutsKey = `timeouts_${this.matchId}`;
        const timeoutsGuardados = localStorage.getItem(timeoutsKey);
        this.timeouts = timeoutsGuardados ? JSON.parse(timeoutsGuardados) : [];
        this.actualizarVistaTimeouts();
    }

    calcularEfectividadTimeout(timeout) {
        if (!this.data || this.data.length === 0) return timeout;
        const timeoutDate = new Date(timeout.timestamp);
        const puntosAntes = [];
        for (let i = this.data.length - 1; i >= 0; i--) {
            const punto = this.data[i];
            if (new Date(punto.timestamp) < timeoutDate && puntosAntes.length < 5) puntosAntes.unshift(punto);
        }
        const puntosDespues = [];
        let encontrado = false;
        for (const punto of this.data) {
            if (encontrado && puntosDespues.length < 5) puntosDespues.push(punto);
            if (new Date(punto.timestamp) > timeoutDate && !encontrado) { encontrado = true;
                puntosDespues.push(punto); }
        }
        const equipo = timeout.equipo === 'LOCAL' ? 'HOME' : 'AWAY';
        const rival = equipo === 'HOME' ? 'AWAY' : 'HOME';
        const antesLocal = puntosAntes.filter(p => p.scorer === equipo).length;
        const antesRival = puntosAntes.filter(p => p.scorer === rival).length;
        const despuesLocal = puntosDespues.filter(p => p.scorer === equipo).length;
        const despuesRival = puntosDespues.filter(p => p.scorer === rival).length;
        timeout.puntosAntes = { local: antesLocal, rival: antesRival, total: puntosAntes.length };
        timeout.puntosDespues = { local: despuesLocal, rival: despuesRival, total: puntosDespues.length };
        timeout.eficienciaAntes = puntosAntes.length ? (antesLocal / puntosAntes.length * 100).toFixed(1) : 0;
        timeout.eficienciaDespues = puntosDespues.length ? (despuesLocal / puntosDespues.length * 100).toFixed(1) : 0;
        timeout.mejora = (timeout.eficienciaDespues - timeout.eficienciaAntes).toFixed(1);
        if (timeout.mejora > 20) timeout.efectividad = 'positiva';
        else if (timeout.mejora < -20) timeout.efectividad = 'negativa';
        else timeout.efectividad = 'neutra';
        return timeout;
    }

    actualizarVistaTimeouts() {
        const container = document.getElementById('timeoutsList');
        if (!container) return;
        if (!this.timeouts || this.timeouts.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4">Sin timeouts registrados</div>';
            return;
        }
        const timeoutsConEfectividad = this.timeouts.map(t => this.calcularEfectividadTimeout(t));
        const totalTimeouts = timeoutsConEfectividad.length;
        const efectivos = timeoutsConEfectividad.filter(t => t.efectividad === 'positiva').length;
        const mejoraPromedio = timeoutsConEfectividad.reduce((sum, t) => sum + parseFloat(t.mejora || 0), 0) / totalTimeouts;
        let html = `<div class="bg-dark/50 rounded-lg p-3 mb-4">
            <div class="grid grid-cols-3 gap-4 text-center">
                <div><div class="text-2xl font-bold text-primary">${totalTimeouts}</div><div class="text-xs text-gray-400">Total Timeouts</div></div>
                <div><div class="text-2xl font-bold text-green-400">${efectivos}</div><div class="text-xs text-gray-400">Efectivos</div></div>
                <div><div class="text-2xl font-bold ${mejoraPromedio > 0 ? 'text-green-400' : 'text-red-400'}">${mejoraPromedio > 0 ? '+' : ''}${mejoraPromedio.toFixed(1)}%</div><div class="text-xs text-gray-400">Mejora promedio</div></div>
            </div>
        </div>`;
        html += timeoutsConEfectividad.map((t, idx) => {
            let efectividadColor = '',
                efectividadIcono = '';
            if (t.efectividad === 'positiva') { efectividadColor = 'border-green-500 bg-green-500/10';
                efectividadIcono = '✅ POSITIVA'; } else if (t.efectividad === 'negativa') { efectividadColor = 'border-red-500 bg-red-500/10';
                efectividadIcono = '❌ NEGATIVA'; } else { efectividadColor = 'border-yellow-500 bg-yellow-500/10';
                efectividadIcono = '⚖️ NEUTRA'; }
            return `<div class="bg-dark/30 rounded-lg p-3 border-l-4 ${efectividadColor}">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-primary">⏸️ TIMEOUT #${idx + 1}</span>
                    <span class="text-xs text-gray-500">Set ${t.set} - ${new Date(t.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="text-sm mb-2">${t.equipo === 'LOCAL' ? this.homeTeamName : this.awayTeamName} pidió timeout (${t.marcador})</div>
                <div class="grid grid-cols-2 gap-4 text-center text-xs">
                    <div class="bg-gray-800/50 rounded p-2">
                        <div class="text-gray-400 mb-1">ANTES (últimos ${t.puntosAntes?.total || 0} puntos)</div>
                        <div class="flex justify-center gap-4">
                            <span class="text-blue-400">${t.equipo === 'LOCAL' ? this.homeTeamName : this.awayTeamName}: ${t.puntosAntes?.local || 0}</span>
                            <span class="text-red-400">${t.equipo === 'VISITANTE' ? this.homeTeamName : this.awayTeamName}: ${t.puntosAntes?.rival || 0}</span>
                        </div>
                        <div class="text-gray-400 mt-1">Efi: ${t.eficienciaAntes || 0}%</div>
                    </div>
                    <div class="bg-gray-800/50 rounded p-2">
                        <div class="text-gray-400 mb-1">DESPUÉS (primeros ${t.puntosDespues?.total || 0} puntos)</div>
                        <div class="flex justify-center gap-4">
                            <span class="text-blue-400">${t.equipo === 'LOCAL' ? this.homeTeamName : this.awayTeamName}: ${t.puntosDespues?.local || 0}</span>
                            <span class="text-red-400">${t.equipo === 'VISITANTE' ? this.homeTeamName : this.awayTeamName}: ${t.puntosDespues?.rival || 0}</span>
                        </div>
                        <div class="text-gray-400 mt-1">Efi: ${t.eficienciaDespues || 0}%</div>
                    </div>
                </div>
                <div class="mt-2 text-center">
                    <span class="text-xs font-semibold">Mejora: ${t.mejora > 0 ? '+' : ''}${t.mejora}% - Efectividad: ${efectividadIcono}</span>
                </div>
            </div>`;
        }).join('');
        container.innerHTML = html;
    }

    async checkConnection() {
        try {
            const response = await fetch(`/data/match_${this.matchId}.json?_t=${Date.now()}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    const lastUpdate = new Date(data[data.length - 1].timestamp);
                    const secondsSinceUpdate = (new Date() - lastUpdate) / 1000;
                    const led = document.getElementById('connectionLed');
                    const text = document.getElementById('connectionText');
                    if (secondsSinceUpdate < 10) {
                        led.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';
                        text.textContent = 'Tracker activo';
                        text.className = 'text-xs text-green-400';
                    } else if (secondsSinceUpdate < 60) {
                        led.className = 'w-2 h-2 rounded-full bg-yellow-500';
                        text.textContent = `Último dato: ${Math.round(secondsSinceUpdate)}s`;
                        text.className = 'text-xs text-yellow-400';
                    } else {
                        led.className = 'w-2 h-2 rounded-full bg-red-500';
                        text.textContent = 'Tracker inactivo';
                        text.className = 'text-xs text-red-400';
                    }
                    return;
                }
            }
            const led = document.getElementById('connectionLed');
            const text = document.getElementById('connectionText');
            led.className = 'w-2 h-2 rounded-full bg-red-500';
            text.textContent = 'Sin conexión';
            text.className = 'text-xs text-red-400';
        } catch (e) {
            const led = document.getElementById('connectionLed');
            const text = document.getElementById('connectionText');
            led.className = 'w-2 h-2 rounded-full bg-red-500';
            text.textContent = 'Error de conexión';
            text.className = 'text-xs text-red-400';
        }
    }

    setupRefreshIntervalSelector() {
        const selector = document.getElementById('refreshIntervalSelector');
        if (!selector) return;
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        const startInterval = (ms) => {
            if (this.refreshInterval) clearInterval(this.refreshInterval);
            this.refreshInterval = setInterval(() => this.loadData(), ms);
        };
        selector.onchange = () => {
            const ms = parseInt(selector.value);
            startInterval(ms);
            this.mostrarFeedbackPartido(`⏱️ Refresco cada ${ms / 1000} segundos`);
        };
        startInterval(10000);
    }

    obtenerEquipoAnalisis() {
        if (this.homeTeamName === 'ATTITUDE') {
            return { nombre: this.homeTeamName, equipo: 'HOME', esAttitude: true };
        }
        if (this.awayTeamName === 'ATTITUDE') {
            return { nombre: this.awayTeamName, equipo: 'AWAY', esAttitude: true };
        }
        return { nombre: this.homeTeamName, equipo: 'HOME', esAttitude: false };
    }

    actualizarSets() {
        const container = document.getElementById('setsList');
        if (!container) return;
        let datosParaSets = this.data;
        if (!datosParaSets?.length && this.puntosJugadores?.length) datosParaSets = this.puntosJugadores;
        if (!datosParaSets?.length) {
            container.innerHTML = '<div class="text-gray-500 text-xs">Esperando datos del partido...</div>';
            return;
        }
        const setsMap = new Map();
        for (const punto of datosParaSets) {
            const setNum = punto.set || 1;
            if (!setsMap.has(setNum)) setsMap.set(setNum, { home: 0, away: 0 });
            const setData = setsMap.get(setNum);
            let homeScore = punto.homeScore,
                awayScore = punto.awayScore;
            if ((homeScore === undefined || awayScore === undefined) && punto.marcadorDespues) {
                const [h, a] = punto.marcadorDespues.split('-');
                homeScore = parseInt(h);
                awayScore = parseInt(a);
            }
            if (!isNaN(homeScore) && !isNaN(awayScore)) { setData.home = homeScore;
                setData.away = awayScore; }
        }
        let hasValidData = false;
        for (const [num, scores] of setsMap) {
            if (scores.home > 0 || scores.away > 0) { hasValidData = true; break; }
        }
        if (!hasValidData) {
            container.innerHTML = '<div class="text-gray-500 text-xs">Esperando datos del partido...</div>';
            return;
        }
        const setsArray = Array.from(setsMap.keys()).sort((a, b) => a - b);
        const ultimoSetNum = setsArray[setsArray.length - 1];
        const estadoPartido = evaluarEstadoPartido(setsMap, this.configSets, this.estadoOficialPartido);
        const setsGanadosLocal = estadoPartido.setsGanadosLocal;
        const setsGanadosVisitante = estadoPartido.setsGanadosVisitante;
        const setsParaGanar = this.configSets.setsParaGanar;
        this.partidoTerminado = estadoPartido.partidoTerminado;
        if (!this.partidoTerminado) this.matchEnded = false;
        let setsHtml = '';
        for (const setNum of setsArray) {
            const set = setsMap.get(setNum);
            const esUltimoSet = setNum === ultimoSetNum;
            const setTerminado = this.isSetTerminado(set.home, set.away, setNum, setsArray.length);
            let ganador = '',
                ganadorColor = '';
            if (setTerminado) {
                if (set.home > set.away) { ganador = `🏆 ${this.homeTeamName}`;
                    ganadorColor = 'text-blue-400'; } else { ganador = `🏆 ${this.awayTeamName}`;
                    ganadorColor = 'text-red-400'; }
            }
            const mostrarEnCurso = esUltimoSet && !setTerminado && !this.partidoTerminado;
            const bgColor = esUltimoSet && !this.partidoTerminado ? 'bg-primary/20 border-primary' : 'bg-gray-800/50 border-gray-700';
            const borderStyle = esUltimoSet && !this.partidoTerminado ? 'border-2' : 'border';
            setsHtml += `<div class="${bgColor} ${borderStyle} rounded-lg px-3 py-2 min-w-[100px] text-center">
                <div class="text-xs font-bold ${esUltimoSet && !this.partidoTerminado ? 'text-primary' : 'text-gray-400'}">Set ${setNum}${mostrarEnCurso ? ' 🔴 EN CURSO' : ''}</div>
                <div class="text-sm font-bold mt-1"><span class="text-blue-400">${set.home}</span><span class="text-gray-500"> - </span><span class="text-red-400">${set.away}</span></div>
                ${ganador ? `<div class="text-xs ${ganadorColor} mt-1">${ganador}</div>` : ''}
                ${mostrarEnCurso ? '<div class="text-xs text-gray-400 mt-1">En juego</div>' : ''}
            </div>`;
        }
        if (this.partidoTerminado) {
            const campeon = setsGanadosLocal >= setsParaGanar ? this.homeTeamName : this.awayTeamName;
            const marcadorSets = `${setsGanadosLocal} - ${setsGanadosVisitante}`;
            container.innerHTML = `${setsHtml}<div class="w-full mt-3 text-center p-2 bg-green-900/30 rounded-lg border border-green-500/50">
                <div class="text-green-400 font-bold text-sm">🏆 PARTIDO FINALIZADO 🏆</div>
                <div class="text-white font-bold text-base md:text-lg">${campeon} Ganador</div>
                <div class="text-gray-400 text-xs">Sets: ${marcadorSets}</div>
            </div>`;
            return;
        }
        container.innerHTML = setsHtml || '<div class="text-gray-500 text-xs">No hay datos de sets</div>';
    }

    calcularSetsGanados(setsMap) {
        const estado = evaluarEstadoPartido(setsMap, this.configSets, this.estadoOficialPartido);
        return { local: estado.setsGanadosLocal, visitante: estado.setsGanadosVisitante };
    }

    isSetTerminado(home, away, setNum) {
        return isSetTerminadoHelper(home, away, setNum, this.configSets);
    }

    mostrarFeedbackPartido(mensaje) {
        const feedback = document.createElement('div');
        feedback.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-semibold';
        feedback.innerText = mensaje;
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 2000);
    }

    async cargarConfiguracion() {
        try {
            const response = await fetch('/data/config.json');
            if (response.ok) {
                const config = await response.json();
                this.matchId = config.matchId;
                this.homeTeamName = config.homeTeam || "LOCAL";
                this.awayTeamName = config.awayTeam || "VISITANTE";
                this.categoria = config.categoria || null;
                return true;
            }
        } catch (e) {}
        return false;
    }

    findCourt(obj) {
        if (!obj) return null;
        if (obj.court) return obj.court;
        if (obj.liveState?.court) return obj.liveState.court;
        for (let key in obj) {
            if (typeof obj[key] === 'object') {
                let found = this.findCourt(obj[key]);
                if (found) return found;
            }
        }
        return null;
    }

    leerCacheJSON(clave, valorPorDefecto = null) {
        try {
            const valor = localStorage.getItem(clave);
            return valor ? JSON.parse(valor) : valorPorDefecto;
        } catch (error) {
            console.warn(`No se pudo leer ${clave}:`, error);
            return valorPorDefecto;
        }
    }

    cargarDatosGuardadosDelPartido() {
        const nombresLocal = this.leerCacheJSON(`jugadores_${this.matchId}_local`, {});
        const nombresVisitante = this.leerCacheJSON(`jugadores_${this.matchId}_visitante`, {});
        this.jugadoresLocal = { ...nombresLocal, ...this.jugadoresLocal };
        this.jugadoresVisitante = { ...nombresVisitante, ...this.jugadoresVisitante };

        const formacionActual = this.leerCacheJSON(`formacion_${this.matchId}`);
        for (const jugador of formacionActual?.local || []) {
            if (jugador?.numero && jugador?.nombre && !this.jugadoresLocal[jugador.numero]) {
                this.jugadoresLocal[jugador.numero] = jugador.nombre;
            }
        }
        for (const jugador of formacionActual?.visitante || []) {
            if (jugador?.numero && jugador?.nombre && !this.jugadoresVisitante[jugador.numero]) {
                this.jugadoresVisitante[jugador.numero] = jugador.nombre;
            }
        }

        this.formacionInicialPorSet = {};
        for (let set = 1; set <= 5; set++) {
            const formacion = this.leerCacheJSON(`formacion_inicial_${this.matchId}_set_${set}`);
            if (formacion) this.formacionInicialPorSet[set] = formacion;
        }
    }

    async loadData() {
        const offlineManager = new OfflineManager();
        if (this.offlineMode) {
            const cachedData = await offlineManager.getMatchData(this.matchId);
            if (cachedData) {
                this.data = cachedData;
                this.updateDashboard();
                this.mostrarFeedbackPartido('📡 Modo offline - Datos cacheados');
                return;
            }
        }
        this.cargarDatosGuardadosDelPartido();
        this.actualizarVistaIndividuales();
        try {
            let response = await fetch(`/api/matches/${this.matchId}/points?_t=${Date.now()}`);
            let newData = null;
            if (response.ok) {
                const payload = await response.json();
                newData = payload.data || [];
            } else {
                response = await fetch(`/data/match_${this.matchId}.json?_t=${Date.now()}`);
                if (response.ok) newData = await response.json();
            }
            if (newData) {
                this.data = newData;
                await offlineManager.saveMatchData(this.matchId, newData);
                this.updateDashboard();
                this.actualizarSets();
            }
            const fullResponse = await fetch(`/data/full_${this.matchId}.json?_t=${Date.now()}`);
            if (fullResponse.ok) {
                const fullData = await fullResponse.json();
                this.estadoOficialPartido = extraerEstadoOficial(fullData);
                this.actualizarSets();
                const findCourt = (obj) => {
                    if (!obj) return null;
                    if (obj.court) return obj.court;
                    if (obj.liveState?.court) return obj.liveState.court;
                    for (let key in obj) {
                        if (typeof obj[key] === 'object') {
                            let found = findCourt(obj[key]);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                this.cargarTimeouts();
                const court = findCourt(fullData);
                if (court) {
                    if (court.home?.positions) {
                        for (const [pos, info] of Object.entries(court.home.positions)) {
                            if (info.number && info.lastName) {
                                this.jugadoresLocal[info.number] = `${info.firstName || ''} ${info.lastName || ''}`.trim();
                            } else if (info.number) {
                                this.jugadoresLocal[info.number] = `Jugador ${info.number}`;
                            }
                        }
                    }
                    if (court.home?.bench) {
                        for (const info of court.home.bench) {
                            if (info.number && info.lastName && !this.jugadoresLocal[info.number]) {
                                this.jugadoresLocal[info.number] = `${info.firstName || ''} ${info.lastName || ''}`.trim();
                            } else if (info.number && !this.jugadoresLocal[info.number]) {
                                this.jugadoresLocal[info.number] = `Jugador ${info.number}`;
                            }
                        }
                    }
                    if (court.away?.positions) {
                        for (const [pos, info] of Object.entries(court.away.positions)) {
                            if (info.number && info.lastName) {
                                this.jugadoresVisitante[info.number] = `${info.firstName || ''} ${info.lastName || ''}`.trim();
                            } else if (info.number) {
                                this.jugadoresVisitante[info.number] = `Jugador ${info.number}`;
                            }
                        }
                    }
                    if (court.away?.bench) {
                        for (const info of court.away.bench) {
                            if (info.number && info.lastName && !this.jugadoresVisitante[info.number]) {
                                this.jugadoresVisitante[info.number] = `${info.firstName || ''} ${info.lastName || ''}`.trim();
                            } else if (info.number && !this.jugadoresVisitante[info.number]) {
                                this.jugadoresVisitante[info.number] = `Jugador ${info.number}`;
                            }
                        }
                    }
                    localStorage.setItem(`jugadores_${this.matchId}_local`, JSON.stringify(this.jugadoresLocal));
                    localStorage.setItem(`jugadores_${this.matchId}_visitante`, JSON.stringify(this.jugadoresVisitante));
                    this.rotacionesJugadores = {};
                    if (court.home?.positions) {
                        for (const [pos, info] of Object.entries(court.home.positions)) {
                            if (info.number) {
                                this.rotacionesJugadores[info.number] = parseInt(pos);
                            }
                        }
                    }
                    if (court.away?.positions) {
                        for (const [pos, info] of Object.entries(court.away.positions)) {
                            if (info.number) {
                                this.rotacionesJugadores[`away_${info.number}`] = parseInt(pos);
                            }
                        }
                    }
                    localStorage.setItem(`rotaciones_${this.matchId}`, JSON.stringify(this.rotacionesJugadores));
                    this.actualizarVistaIndividuales();
                }
            }
            this.mostrarSkeleton(false);
        } catch (error) {
            const cachedData = await offlineManager.getMatchData(this.matchId);
            if (cachedData) {
                this.data = cachedData;
                this.updateDashboard();
                this.mostrarFeedbackPartido('⚠️ Error de conexión - Usando datos cacheados');
            }
            this.mostrarSkeleton(false);
        }
    }

    setupTabs() {
        const tp = document.getElementById('tabPartido'),
            ti = document.getElementById('tabIndividuales');
        const vp = document.getElementById('vistaPartido'),
            vi = document.getElementById('vistaIndividuales');
        if (!tp || !ti) return;
        tp.addEventListener('click', () => {
            this.vistaActual = 'partido';
            tp.classList.add('bg-primary', 'text-white');
            tp.classList.remove('bg-gray-700', 'text-gray-300');
            ti.classList.add('bg-gray-700', 'text-gray-300');
            ti.classList.remove('bg-primary', 'text-white');
            if (vp) vp.classList.remove('hidden');
            if (vi) vi.classList.add('hidden');
        });
        ti.addEventListener('click', () => {
            this.vistaActual = 'individuales';
            ti.classList.add('bg-primary', 'text-white');
            ti.classList.remove('bg-gray-700', 'text-gray-300');
            tp.classList.add('bg-gray-700', 'text-gray-300');
            tp.classList.remove('bg-primary', 'text-white');
            if (vp) vp.classList.add('hidden');
            if (vi) vi.classList.remove('hidden');
            this.actualizarVistaIndividuales();
        });
    }

    setupFiltrosSets() {
        const contenedor = document.getElementById('filtrosSetsIndividuales');
        if (!contenedor || contenedor.dataset.inicializado === 'true') return;
        contenedor.dataset.inicializado = 'true';
        contenedor.addEventListener('click', (evento) => {
            const target = evento.target.closest('.filtro-set-btn');
            if (!target) return;
            this.actualizarEstiloFiltro(contenedor, target);
            this.filtroSet = target.dataset.set;
            this.actualizarVistaIndividuales();
        });
    }

    setupFiltrosRotaciones() {
        const contenedor = document.getElementById('filtrosSetsRotaciones');
        if (!contenedor || contenedor.dataset.inicializado === 'true') return;
        contenedor.dataset.inicializado = 'true';
        contenedor.addEventListener('click', (evento) => {
            const target = evento.target.closest('.filtro-rotacion-set-btn');
            if (!target) return;
            this.actualizarEstiloFiltro(contenedor, target);
            this.filtroRotaciones = target.dataset.set;
            this.mostrarRotaciones();
        });
    }

    actualizarEstiloFiltro(contenedor, activo) {
        contenedor.querySelectorAll('button[data-set]').forEach(boton => {
            boton.classList.remove('bg-primary', 'text-white');
            boton.classList.add('bg-gray-700', 'text-gray-300');
            boton.setAttribute('aria-pressed', 'false');
        });
        activo.classList.add('bg-primary', 'text-white');
        activo.classList.remove('bg-gray-700', 'text-gray-300');
        activo.setAttribute('aria-pressed', 'true');
    }

    actualizarVistaIndividuales() {
        renderizarSoloNombres('tablaLocalBody', this.jugadoresLocal, this.jugadoresVisitante, 'LOCAL');
        renderizarSoloNombres('tablaVisitanteBody', this.jugadoresLocal, this.jugadoresVisitante, 'VISITANTE');
        if (this.puntosJugadores && this.puntosJugadores.length > 0) {
            const datosFiltrados = filtrarPuntosPorSet(this.puntosJugadores, this.filtroSet);
            const statsLocal = calcularStatsPorJugador(datosFiltrados, 'LOCAL');
            const statsVisitante = calcularStatsPorJugador(datosFiltrados, 'VISITANTE');
            actualizarTablaConStats('tablaLocalBody', statsLocal, this.jugadoresLocal, this.jugadoresVisitante, 'LOCAL');
            actualizarTablaConStats('tablaVisitanteBody', statsVisitante, this.jugadoresLocal, this.jugadoresVisitante, 'VISITANTE');
            const resumenLocal = resumirPuntosEquipo(datosFiltrados, 'LOCAL', statsLocal);
            const resumenVisitante = resumirPuntosEquipo(datosFiltrados, 'VISITANTE', statsVisitante);
            const totalAcesLocal = Object.values(statsLocal).reduce((sum, s) => sum + (s.acesServicio || 0), 0);
            const totalAcesVisitante = Object.values(statsVisitante).reduce((sum, s) => sum + (s.acesServicio || 0), 0);
            const totalErroresServLocal = Object.values(statsLocal).reduce((sum, s) => sum + (s.erroresServicio || 0), 0);
            const totalErroresServVisitante = Object.values(statsVisitante).reduce((sum, s) => sum + (s.erroresServicio || 0), 0);
            document.getElementById('localTotalPts').innerHTML = `Atribuidos: ${resumenLocal.puntosAtribuidos} · Sin atribuir: ${resumenLocal.sinAtribuir} · Equipo: ${resumenLocal.puntosEquipo}`;
            document.getElementById('visitanteTotalPts').innerHTML = `Atribuidos: ${resumenVisitante.puntosAtribuidos} · Sin atribuir: ${resumenVisitante.sinAtribuir} · Equipo: ${resumenVisitante.puntosEquipo}`;
            document.getElementById('localTotalAces').innerHTML = `🎯 Aces: ${totalAcesLocal}`;
            document.getElementById('visitanteTotalAces').innerHTML = `🎯 Aces: ${totalAcesVisitante}`;
            document.getElementById('localTotalServErrors').innerHTML = `❌ Err Serv: ${totalErroresServLocal}`;
            document.getElementById('visitanteTotalServErrors').innerHTML = `❌ Err Serv: ${totalErroresServVisitante}`;
            renderizarTop5ConNombres(statsLocal, statsVisitante, this.jugadoresLocal, this.jugadoresVisitante);
            renderizarTarjetasMoviles('tarjetasLocalMovil', statsLocal, this.jugadoresLocal);
            renderizarTarjetasMoviles('tarjetasVisitanteMovil', statsVisitante, this.jugadoresVisitante);
            if (this.chartPuntosJugadores) this.chartPuntosJugadores.destroy();
            this.chartPuntosJugadores = renderizarGraficoPuntos(statsLocal, 'LOCAL', this.jugadoresLocal, this.jugadoresVisitante, this.chartPuntosJugadores);
        } else {
            document.getElementById('localTotalPts').innerHTML = 'Atribuidos: 0 · Sin atribuir: 0 · Equipo: 0';
            document.getElementById('visitanteTotalPts').innerHTML = 'Atribuidos: 0 · Sin atribuir: 0 · Equipo: 0';
            document.getElementById('localTotalAces').innerHTML = '🎯 Aces: 0';
            document.getElementById('visitanteTotalAces').innerHTML = '🎯 Aces: 0';
            document.getElementById('localTotalServErrors').innerHTML = '❌ Err Serv: 0';
            document.getElementById('visitanteTotalServErrors').innerHTML = '❌ Err Serv: 0';
            document.getElementById('top5List').innerHTML = '<div class="text-center text-gray-500">Sin datos de puntos</div>';
            renderizarTarjetasMoviles('tarjetasLocalMovil', {}, this.jugadoresLocal);
            renderizarTarjetasMoviles('tarjetasVisitanteMovil', {}, this.jugadoresVisitante);
        }
    }

    updateLivePanel() {
        if (!this.data?.length) return;
        const last = this.data[this.data.length - 1];
        const points = this.data.filter(s => s.scorer);
        const homePoints = points.filter(p => p.scorer === 'HOME').length;
        const awayPoints = points.filter(p => p.scorer === 'AWAY').length;
        const total = points.length;
        const last5 = this.data.slice(-5).filter(s => s.scorer);
        const homeLast5 = last5.filter(s => s.scorer === 'HOME').length;
        const awayLast5 = last5.filter(s => s.scorer === 'AWAY').length;
        let txt = homeLast5 > awayLast5 + 1 ? `🔥 ${this.homeTeamName} EN RACHA` : (awayLast5 > homeLast5 + 1 ? `⚡ ${this.awayTeamName} EN RACHA` : '⚖️ EQUILIBRADO');
        let col = homeLast5 > awayLast5 + 1 ? '#667eea' : (awayLast5 > homeLast5 + 1 ? '#f43f5e' : '#9ca3af');
        const cm = document.getElementById('coachMomentum'),
            cr = document.getElementById('coachRun'),
            cb = document.getElementById('coachBreak'),
            cs = document.getElementById('coachScore');
        if (cm) { cm.innerHTML = txt;
            cm.style.color = col; }
        if (cr) cr.innerHTML = `🔥 Racha: ${this.homeTeamName} ${last.homeRun} - ${last.awayRun} ${this.awayTeamName}`;
        if (cb) {
            const metricas = calcularMetricasRally(this.data);
            cb.innerHTML = `💪 Breakpoints: ${metricas.equipos.HOME.breakpoint.exitos} - ${metricas.equipos.AWAY.breakpoint.exitos}`;
        }
        if (cs) cs.innerHTML = `📊 ${last.homeScore} - ${last.awayScore} | ${Math.round((homePoints / total) * 100)}% eficiencia`;
    }

    actualizarBadgeSaque(serving) {
        const bc = document.getElementById('servingBadgeDashboard');
        if (!bc) return;
        if (this.partidoTerminado || !serving) { bc.innerHTML = '';
            bc.classList.add('hidden'); return; }
        const isHome = serving === 'HOME';
        bc.innerHTML = `<div class="${isHome ? 'bg-blue-900/30' : 'bg-red-900/30'} border ${isHome ? 'border-blue-500/50' : 'border-red-500/50'} rounded-full px-3 py-1 md:px-4 md:py-1.5 flex items-center gap-1 md:gap-2 animate-pulse">
            <span class="text-xs md:text-base">🏐</span>
            <span class="text-xs md:text-sm font-bold ${isHome ? 'text-blue-400' : 'text-red-400'} uppercase tracking-wide">SACA ${isHome ? this.homeTeamName : this.awayTeamName}</span>
        </div>`;
        bc.classList.remove('hidden');
    }

    setupEventListeners() {
        document.getElementById('saveHTMLBtn')?.addEventListener('click', () => this.saveAsHTML());
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadData());
        document.getElementById('soundToggleBtn')?.addEventListener('click', () => {
            const enabled = this.soundManager.toggle();
            document.getElementById('soundToggleBtn').innerHTML = enabled ? '🔊 Sonidos ON' : '🔇 Sonidos OFF';
            if (enabled && this.soundManager.audioContext) this.soundManager.audioContext.resume();
        });

        const saveHTMLBtnMobile = document.getElementById('saveHTMLBtnMobile');
        if (saveHTMLBtnMobile) {
            saveHTMLBtnMobile.addEventListener('click', () => {
                this.saveAsHTML();
                const menuDesplegable = document.getElementById('menuDesplegable');
                if (menuDesplegable) {
                    menuDesplegable.classList.add('hidden');
                    menuDesplegable.style.display = 'none';
                }
            });
        }

        const soundToggleBtnMobile = document.getElementById('soundToggleBtnMobile');
        if (soundToggleBtnMobile) {
            soundToggleBtnMobile.addEventListener('click', () => {
                const enabled = this.soundManager.toggle();
                soundToggleBtnMobile.innerHTML = enabled ? '🔊 Sonidos ON' : '🔇 Sonidos OFF';
                if (enabled && this.soundManager.audioContext) this.soundManager.audioContext.resume();
                const btnDesktop = document.getElementById('soundToggleBtn');
                if (btnDesktop) btnDesktop.innerHTML = enabled ? '🔊 Sonidos ON' : '🔇 Sonidos OFF';
            });
        }

        const refreshSelectorMobile = document.getElementById('refreshIntervalSelectorMobile');
        if (refreshSelectorMobile) {
            refreshSelectorMobile.addEventListener('change', (e) => {
                const ms = parseInt(e.target.value);
                const selectorDesktop = document.getElementById('refreshIntervalSelector');
                if (selectorDesktop) selectorDesktop.value = ms;
                if (this.refreshInterval) clearInterval(this.refreshInterval);
                this.refreshInterval = setInterval(() => this.loadData(), ms);
                this.mostrarFeedbackPartido(`⏱️ Refresco cada ${ms / 1000} segundos`);
            });
        }

        const copyUrlBtn = document.getElementById('copyUrlBtn');
        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', () => {
                const currentUrl = window.location.href;
                const urlParts = currentUrl.match(/(https?:\/\/[^\/]+)/);
                const baseUrl = urlParts ? urlParts[1] : currentUrl;
                navigator.clipboard.writeText(baseUrl).then(() => {
                    this.mostrarFeedbackPartido('🔗 URL copiada al portapapeles: ' + baseUrl);
                    const originalText = copyUrlBtn.innerHTML;
                    copyUrlBtn.innerHTML = '✅ ¡Copiado!';
                    setTimeout(() => {
                        copyUrlBtn.innerHTML = originalText;
                    }, 2000);
                }).catch(() => {
                    this.mostrarFeedbackPartido('❌ No se pudo copiar la URL');
                });
            });
        }
    }

    setupPwaInstall() {
        const boton = document.getElementById('installAppBtnMobile');
        if (!boton) return;

        const actualizarVisibilidad = () => {
            boton.classList.toggle('hidden', !window.deferredInstallPrompt);
        };

        window.addEventListener('voleyinsight-install-ready', actualizarVisibilidad);
        window.addEventListener('appinstalled', () => {
            window.deferredInstallPrompt = null;
            actualizarVisibilidad();
            this.mostrarFeedbackPartido('✅ VoleyInsight instalado');
        });

        boton.addEventListener('click', async () => {
            const prompt = window.deferredInstallPrompt;
            if (!prompt) return;
            prompt.prompt();
            await prompt.userChoice;
            window.deferredInstallPrompt = null;
            actualizarVisibilidad();
        });

        actualizarVisibilidad();
    }

    reasignarEventosMenuMovil() {
        const saveHTMLBtnMobile = document.getElementById('saveHTMLBtnMobile');
        if (saveHTMLBtnMobile) {
            const newBtn = saveHTMLBtnMobile.cloneNode(true);
            saveHTMLBtnMobile.parentNode.replaceChild(newBtn, saveHTMLBtnMobile);
            newBtn.addEventListener('click', () => {
                this.saveAsHTML();
                const menuDesplegable = document.getElementById('menuDesplegable');
                if (menuDesplegable) {
                    menuDesplegable.classList.add('hidden');
                    menuDesplegable.style.display = 'none';
                }
            });
        }

        const soundToggleBtnMobile = document.getElementById('soundToggleBtnMobile');
        if (soundToggleBtnMobile) {
            const newBtn = soundToggleBtnMobile.cloneNode(true);
            soundToggleBtnMobile.parentNode.replaceChild(newBtn, soundToggleBtnMobile);
            newBtn.addEventListener('click', () => {
                const enabled = this.soundManager.toggle();
                newBtn.innerHTML = enabled ? '🔊 Sonidos ON' : '🔇 Sonidos OFF';
                if (enabled && this.soundManager.audioContext) this.soundManager.audioContext.resume();
                const btnDesktop = document.getElementById('soundToggleBtn');
                if (btnDesktop) btnDesktop.innerHTML = enabled ? '🔊 Sonidos ON' : '🔇 Sonidos OFF';
            });
        }

        const refreshSelectorMobile = document.getElementById('refreshIntervalSelectorMobile');
        if (refreshSelectorMobile) {
            const newSelector = refreshSelectorMobile.cloneNode(true);
            refreshSelectorMobile.parentNode.replaceChild(newSelector, refreshSelectorMobile);
            newSelector.addEventListener('change', (e) => {
                const ms = parseInt(e.target.value);
                const selectorDesktop = document.getElementById('refreshIntervalSelector');
                if (selectorDesktop) selectorDesktop.value = ms;
                if (this.refreshInterval) clearInterval(this.refreshInterval);
                this.refreshInterval = setInterval(() => this.loadData(), ms);
                this.mostrarFeedbackPartido(`⏱️ Refresco cada ${ms / 1000} segundos`);
            });
        }
    }

    actualizarHoraUltimoPunto() {
        const c = document.getElementById('lastPointTime');
        if (!c) return;
        if (!this.data?.length) { c.textContent = 'Último punto: --'; return; }
        const up = [...this.data].reverse().find(p => p.scorer);
        if (!up) { c.textContent = 'Último punto: --'; return; }
        const s = Math.floor((new Date() - new Date(up.timestamp)) / 1000);
        if (s < 60) c.textContent = `Último punto: hace ${s}s`;
        else if (s < 3600) c.textContent = `Último punto: hace ${Math.floor(s / 60)}m ${s % 60}s`;
        else c.textContent = `Último punto: hace ${Math.floor(s / 3600)}h`;
    }

    actualizarEstadisticasServicio() {
        const stats = calcularEstadisticasServicio(this.data, this.puntosJugadores);
        document.getElementById('serviceAcesHome').textContent = stats.home.aces;
        document.getElementById('serviceErrorsHome').textContent = stats.home.errores;
        document.getElementById('serviceEfficiencyHome').textContent = `${stats.home.eficiencia}%`;
        document.getElementById('serviceAcesAway').textContent = stats.away.aces;
        document.getElementById('serviceErrorsAway').textContent = stats.away.errores;
        document.getElementById('serviceEfficiencyAway').textContent = `${stats.away.eficiencia}%`;
        const hel = document.getElementById('serviceEfficiencyHome');
        const ael = document.getElementById('serviceEfficiencyAway');
        hel.className = `text-2xl md:text-3xl font-bold ${stats.home.eficiencia > 0 ? 'text-green-400' : stats.home.eficiencia < 0 ? 'text-red-400' : 'text-yellow-400'}`;
        ael.className = `text-2xl md:text-3xl font-bold ${stats.away.eficiencia > 0 ? 'text-green-400' : stats.away.eficiencia < 0 ? 'text-red-400' : 'text-yellow-400'}`;
    }

    updateBreakPointsList() {
        const c = document.getElementById('breakPointsList');
        if (!c) return;
        const automaticos = calcularMetricasRally(this.data).breakpoints;
        const leerLista = (clave) => {
            try { return JSON.parse(localStorage.getItem(clave) || '[]'); }
            catch { return []; }
        };
        const marcas = [...leerLista(`breaks_${this.matchId}`), ...leerLista(`marcas_${this.matchId}`)];
        const automaticosHtml = automaticos.slice(-12).reverse().map(punto => {
            const esLocal = punto.equipoBreakpoint === 'HOME';
            const marcador = `${punto.homeScore ?? '?'}-${punto.awayScore ?? '?'}`;
            return `<div class="flex justify-between items-center p-2 rounded-lg ${esLocal ? 'bg-primary/10' : 'bg-rose-500/10'} mb-1">
                <span class="text-xs text-gray-400">Set ${punto.set || '-'}</span>
                <span class="text-sm font-semibold ${esLocal ? 'text-primary' : 'text-rose-400'}">🏐 ${esLocal ? this.homeTeamName : this.awayTeamName}</span>
                <span class="text-xs bg-dark px-2 py-0.5 rounded-full">${marcador}</span>
            </div>`;
        }).join('');
        const marcasHtml = marcas.length ? `<div class="mt-3 pt-2 border-t border-gray-700">
            <div class="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Marcas manuales del analista</div>
            ${marcas.slice(-6).reverse().map(marca => `<div class="flex justify-between items-center p-2 rounded-lg bg-purple-500/10 mb-1"><span class="text-xs">⭐ Momento clave</span><span class="text-xs text-gray-300">${marca.equipo || '-'}</span><span class="text-xs bg-dark px-2 py-0.5 rounded-full">${marca.marcador || '-'}</span></div>`).join('')}
        </div>` : '';
        c.innerHTML = automaticosHtml || marcasHtml
            ? `${automaticosHtml}${marcasHtml}`
            : '<div class="text-center text-gray-400 py-4">Todavía no hubo breakpoints con saque propio</div>';
    }

    updateInsightsList(homeEfficiency, homeBreaks) {
        const c = document.getElementById('insightsList');
        if (!c) return;
        const equipoAnalisis = this.obtenerEquipoAnalisis();
        const nombreEquipo = equipoAnalisis.nombre;
        const eficiencia = equipoAnalisis.equipo === 'HOME' ? homeEfficiency : this.awayEfficiency;
        const breaks = equipoAnalisis.equipo === 'HOME' ? homeBreaks : this.awayBreaks;
        const i = [];
        if (eficiencia > 60) i.push(`🏆 DOMINIO TOTAL: ${nombreEquipo} ganó ${eficiencia}% de los puntos.`);
        else if (eficiencia > 55) i.push(`✅ CONTROL: ${nombreEquipo} ganó ${eficiencia}% de los puntos.`);
        else if (eficiencia > 50) i.push(`⚖️ VENTAJA MÍNIMA: ${nombreEquipo} ganó ${eficiencia}% vs rival.`);
        else if (eficiencia < 45 && eficiencia > 0) i.push(`⚠️ SUPERADO: ${nombreEquipo} solo ganó ${eficiencia}% de los puntos.`);
        if (breaks > 12) i.push(`⚡ EFECTIVO CON SAQUE PROPIO: ganó ${breaks} breakpoints.`);
        else if (breaks < 6 && breaks > 0) i.push(`🔻 POCOS BREAKPOINTS: ganó ${breaks} puntos con saque propio. Revisar presión de saque y bloqueo-defensa.`);
        const sideout = parseFloat(document.getElementById('sideoutLocalLabel')?.textContent) || 0;
        const breakpoint = parseFloat(document.getElementById('breakpointLocalLabel')?.textContent) || 0;
        const sideoutEquipo = equipoAnalisis.equipo === 'HOME' ? sideout : parseFloat(document.getElementById('sideoutVisitanteLabel')?.textContent) || 0;
        const breakpointEquipo = equipoAnalisis.equipo === 'HOME' ? breakpoint : parseFloat(document.getElementById('breakpointVisitanteLabel')?.textContent) || 0;
        if (sideoutEquipo > 60) i.push(`🎯 EXCELENTE SIDEOUT% (${sideoutEquipo}%). Ganó con frecuencia los rallies en los que recibió el saque rival.`);
        else if (sideoutEquipo < 45 && sideoutEquipo > 0) i.push(`⚠️ BAJO SIDEOUT% (${sideoutEquipo}%). Revisar recepción y salida de ataque.`);
        if (breakpointEquipo > 45) i.push(`⚡ EXCELENTE BREAKPOINT% (${breakpointEquipo}%). El saque propio genera puntos.`);
        else if (breakpointEquipo < 25 && breakpointEquipo > 0) i.push(`🔻 BAJO BREAKPOINT% (${breakpointEquipo}%). Falta presión con saque propio.`);
        const clutch = parseFloat(document.getElementById('clutchHome')?.textContent) || 0;
        if (clutch > 65) i.push(`🧠 FORTALEZA MENTAL: ${clutch}% bajo presión.`);
        else if (clutch < 35 && clutch > 0) i.push(`😰 DEBILIDAD BAJO PRESIÓN: Solo ${clutch}% en momentos críticos.`);
        if (i.length === 0) i.push('📊 Esperando más datos para generar insights...');
        c.innerHTML = i.map(x => `<div class="bg-dark/50 rounded-lg p-3 border-l-4 border-primary text-xs md:text-sm">${x}</div>`).join('');
    }

    calcularRotaciones(setSeleccionado = this.filtroRotaciones) {
        const puntos = seleccionarPuntosParaRotaciones(
            this.data,
            this.puntosJugadores,
            this.obtenerEquipoRotaciones(),
            setSeleccionado
        );
        if (!puntos.length) {
            return null;
        }
        return calcularRotacionesPorEquipo(puntos, this.obtenerEquipoRotaciones());
    }

    obtenerEquipoRotaciones() {
        return this.obtenerEquipoAnalisis().equipo === 'AWAY' ? 'VISITANTE' : 'LOCAL';
    }

    obtenerNombreEquipoRotaciones() {
        return this.obtenerEquipoRotaciones() === 'LOCAL'
            ? this.homeTeamName
            : this.awayTeamName;
    }

    generarRotacionesHTML(setSeleccionado = 'all') {
        const datos = this.calcularRotaciones(setSeleccionado);
        if (!datos) {
            return '<div class="section"><div class="section-title">🔄 EFICIENCIA POR ROTACIÓN</div><div class="text-center text-gray-400 py-4">No hay suficientes datos para calcular rotaciones</div></div>';
        }

        const equipoRotaciones = this.obtenerEquipoRotaciones();
        const nombreEquipoRotaciones = this.obtenerNombreEquipoRotaciones();

        let html = `
            <div class="section">
                <div class="section-title">🔄 EFICIENCIA POR ROTACIÓN · ${nombreEquipoRotaciones}</div>
                <p class="text-gray-400 text-sm mb-4" style="color:#9ca3af;font-size:13px;margin-bottom:15px;">Los puntos se agrupan siempre por la rotación de ${nombreEquipoRotaciones}, sin mezclar la rotación rival. En el acumulado, la formación mostrada corresponde al primer set disponible; los valores estadísticos suman todo el partido.</p>
                
                <div style="overflow-x:auto; margin-bottom: 20px;">
                    <table style="width:100%;border-collapse:collapse;min-width:900px;background:#1a1f2e;border-radius:12px;overflow:hidden;">
                        <thead>
                            <tr style="background:#0f1119;border-bottom:2px solid #2d3748;">
                                <th style="text-align:left; padding:12px 10px; color:#9ca3af; font-weight:600; font-size:11px; text-transform:uppercase;">Rotación</th>
                                <th style="text-align:center; padding:12px 10px; color:#93c5fd; font-weight:600; font-size:11px; text-transform:uppercase;">Formación ${nombreEquipoRotaciones}</th>
                                <th style="text-align:center; padding:12px 10px; color:#9ca3af; font-weight:600; font-size:11px; text-transform:uppercase;">Pts F</th>
                                <th style="text-align:center; padding:12px 10px; color:#9ca3af; font-weight:600; font-size:11px; text-transform:uppercase;">Pts C</th>
                                <th style="text-align:center; padding:12px 10px; color:#9ca3af; font-weight:600; font-size:11px; text-transform:uppercase;">Eficiencia</th>
                                <th style="text-align:center; padding:12px 10px; color:#9ca3af; font-weight:600; font-size:11px; text-transform:uppercase;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>`;

        for (let i = 1; i <= 6; i++) {
            const r = datos[i];
            const tieneDatos = r && r.totalPuntos > 0;
            
            let formacionNombres = 'Formación histórica no registrada';
            
            if (tieneDatos) {
                const formacion = this.obtenerJugadoresEnRotacion(equipoRotaciones, i, setSeleccionado);
                if (formacion.length === 6) {
                    formacionNombres = formacion.map(j =>
                    `${j.numero}${j.nombreCorto ? ' ('+j.nombreCorto+')' : ''}`
                    ).join(' • ');
                }
            }

            if (!tieneDatos) {
                html += `<tr style="border-bottom:1px solid #2d3748;">
                    <td style="padding:12px 10px; font-weight:bold; color:#667eea;">🔄 Rotación ${i}</td>
                    <td colspan="5" style="text-align:center; color:#6b7280; padding:12px 10px; font-style:italic;">⚠️ Sin datos - Esta rotación no se jugó</td>
                </tr>`;
                continue;
            }

            const eficiencia = parseFloat(r.eficiencia);
            let estado = '⚖️ NEUTRA';
            let estadoColor = '#f59e0b';
            
            if (eficiencia > 60) {
                estado = '✅ FUERTE';
                estadoColor = '#10b981';
            } else if (eficiencia < 40) {
                estado = '❌ DÉBIL';
                estadoColor = '#ef4444';
            }
            
            const diferencia = r.diferencia || 0;
            const diferenciaColor = diferencia > 0 ? '#10b981' : (diferencia < 0 ? '#ef4444' : '#6b7280');

            html += `<tr style="border-bottom:1px solid #2d3748;">
                <td style="padding:12px 10px; font-weight:bold; color:#667eea;">🔄 Rotación ${i}</td>
                <td style="text-align:center; color:#93c5fd; font-size:11px; padding:12px 10px; background:rgba(59,130,246,0.05); border-radius:4px;">
                    ${formacionNombres}
                </td>
                <td style="text-align:center; color:#3b82f6; font-weight:bold; padding:12px 10px;">${r.puntosAFavor}</td>
                <td style="text-align:center; color:#ef4444; font-weight:bold; padding:12px 10px;">${r.puntosEnContra}</td>
                <td style="text-align:center; font-weight:bold; color:${estadoColor}; padding:12px 10px;">${eficiencia}%</td>
                <td style="text-align:center; color:${estadoColor}; font-weight:bold; padding:12px 10px;">${estado}</td>
            </tr>`;
        }

        html += `</tbody></table></div>`;

        let rotacionesFuertes = [];
        let rotacionesDebiles = [];
        for (let i = 1; i <= 6; i++) {
            const r = datos[i];
            if (!r || r.totalPuntos === 0) continue;
            const eficiencia = parseFloat(r.eficiencia);
            if (eficiencia > 60) rotacionesFuertes.push(`Rotación ${i} (${eficiencia}%)`);
            else if (eficiencia < 40) rotacionesDebiles.push(`Rotación ${i} (${eficiencia}%)`);
        }

        html += `<div style="margin-top:20px;">`;
        if (rotacionesFuertes.length > 0) {
            html += `<div style="background:rgba(16,185,129,0.1); border-left:4px solid #10b981; padding:12px 16px; border-radius:6px; margin-bottom:10px;">
                <span style="font-weight:bold; color:#10b981;">✅ FORTALEZAS:</span>
                <span style="color:#e5e7eb;">${rotacionesFuertes.join(', ')}</span>
                <div style="color:#9ca3af; font-size:12px; margin-top:4px;">💡 Estas rotaciones están funcionando bien. Mantener la estrategia.</div>
            </div>`;
        }
        if (rotacionesDebiles.length > 0) {
            html += `<div style="background:rgba(239,68,68,0.1); border-left:4px solid #ef4444; padding:12px 16px; border-radius:6px; margin-bottom:10px;">
                <span style="font-weight:bold; color:#ef4444;">❌ DEBILIDADES:</span>
                <span style="color:#e5e7eb;">${rotacionesDebiles.join(', ')}</span>
                <div style="color:#9ca3af; font-size:12px; margin-top:4px;">💡 Revisar el sistema defensivo y la recepción en estas rotaciones.</div>
            </div>`;
        }
        if (rotacionesFuertes.length === 0 && rotacionesDebiles.length === 0) {
            html += `<div style="text-align:center; color:#6b7280; padding:10px;">No hay suficientes datos para generar insights de rotaciones.</div>`;
        }
        html += `</div></div>`;

        return html;
    }

    mostrarRotaciones() {
        const tabla = document.getElementById('tablaRotaciones');
        const chartCanvas = document.getElementById('rotacionesChart');
        const insights = document.getElementById('rotacionesInsights');
        const nombreEquipo = this.obtenerNombreEquipoRotaciones();
        const titulo = document.getElementById('rotacionesTitulo');
        const descripcion = document.getElementById('rotacionesDescripcion');
        const alcance = this.filtroRotaciones === 'all' ? 'Acumulado del partido' : `Set ${this.filtroRotaciones}`;
        if (titulo) titulo.textContent = `🔄 EFICIENCIA POR ROTACIÓN · ${nombreEquipo} · ${alcance}`;
        if (descripcion) descripcion.textContent = `Puntos a favor y en contra de ${nombreEquipo}. ${alcance}.`;
        if (!tabla) return;
        const datos = this.calcularRotaciones();
        if (!datos) {
            tabla.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">No hay suficientes datos para calcular rotaciones</td></tr>';
            return;
        }
        let html = '';
        let rotacionesFuertes = [];
        let rotacionesDebiles = [];
        for (let i = 1; i <= 6; i++) {
            const r = datos[i];
            if (!r || r.totalPuntos === 0) {
                html += `<tr class="border-b border-gray-700/50">
                    <td class="py-2 font-medium">
                        <button onclick="window.dashboard.mostrarDetalleRotacion(${i})" class="text-primary hover:text-secondary transition-all text-left flex items-center gap-2">🏐 Rotación ${i}</button>
                    </td>
                    <td class="text-center text-gray-500" colspan="5">Sin datos</td>
                </tr>`;
                continue;
            }
            const eficiencia = parseFloat(r.eficiencia);
            let estado = '⚖️ NEUTRA';
            let estadoColor = 'text-yellow-400';
            if (eficiencia > 60) {
                estado = '✅ FUERTE';
                estadoColor = 'text-green-400';
                rotacionesFuertes.push(`Rotación ${i} (${eficiencia}%)`);
            } else if (eficiencia < 40) {
                estado = '❌ DÉBIL';
                estadoColor = 'text-red-400';
                rotacionesDebiles.push(`Rotación ${i} (${eficiencia}%)`);
            }
            const barColor = eficiencia > 60 ? 'bg-green-500' : (eficiencia > 40 ? 'bg-yellow-500' : 'bg-red-500');
            html += `<tr class="border-b border-gray-700/50">
                <td class="py-2 font-medium">
                    <button onclick="window.dashboard.mostrarDetalleRotacion(${i})" class="text-primary hover:text-secondary transition-all text-left flex items-center gap-2">🏐 Rotación ${i}</button>
                </td>
                <td class="text-center font-bold text-green-400">${r.puntosAFavor}</td>
                <td class="text-center font-bold text-red-400">${r.puntosEnContra}</td>
                <td class="text-center font-bold ${r.diferencia > 0 ? 'text-green-400' : r.diferencia < 0 ? 'text-red-400' : 'text-gray-400'}">${r.diferencia > 0 ? '+' : ''}${r.diferencia}</td>
                <td class="text-center">
                    <div class="flex items-center gap-2">
                        <div class="w-full bg-gray-700 rounded-full h-2 max-w-[100px]">
                            <div class="${barColor} h-2 rounded-full" style="width: ${eficiencia}%"></div>
                        </div>
                        <span class="font-bold ${estadoColor}">${eficiencia}%</span>
                    </div>
                </td>
                <td class="text-center ${estadoColor} font-bold">${estado}</td>
            </tr>`;
        }
        tabla.innerHTML = html;
        let insightsHtml = '';
        if (rotacionesFuertes.length > 0) {
            insightsHtml += `<div class="bg-green-900/20 border-l-4 border-green-500 p-3 rounded">
                <span class="font-bold text-green-400">✅ FORTALEZAS:</span>
                <span class="text-gray-300">${rotacionesFuertes.join(', ')}</span>
                <div class="text-xs text-gray-400 mt-1">💡 Estas rotaciones están funcionando bien. Mantener la estrategia.</div>
            </div>`;
        }
        if (rotacionesDebiles.length > 0) {
            insightsHtml += `<div class="bg-red-900/20 border-l-4 border-red-500 p-3 rounded mt-2">
                <span class="font-bold text-red-400">❌ DEBILIDADES:</span>
                <span class="text-gray-300">${rotacionesDebiles.join(', ')}</span>
                <div class="text-xs text-gray-400 mt-1">💡 Revisar el sistema defensivo y la recepción en estas rotaciones.</div>
            </div>`;
        }
        if (!insightsHtml) {
            insightsHtml = `<div class="text-gray-400 text-sm">No hay suficientes datos para generar insights de rotaciones.</div>`;
        }
        insights.innerHTML = insightsHtml;
        if (chartCanvas) {
            if (this.chartRotaciones) {
                this.chartRotaciones.destroy();
            }
            const labels = [];
            const data = [];
            const colors = [];
            for (let i = 1; i <= 6; i++) {
                const r = datos[i];
                if (r && r.totalPuntos > 0) {
                    labels.push(`Rot ${i}`);
                    data.push(parseFloat(r.eficiencia));
                    const ef = parseFloat(r.eficiencia);
                    if (ef > 60) colors.push('#10b981');
                    else if (ef > 40) colors.push('#f59e0b');
                    else colors.push('#ef4444');
                } else {
                    labels.push(`Rot ${i}`);
                    data.push(0);
                    colors.push('#4b5563');
                }
            }
            this.chartRotaciones = new Chart(chartCanvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Eficiencia %',
                        data: data,
                        backgroundColor: colors,
                        borderRadius: 4,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.raw + '%';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            ticks: {
                                color: '#9ca3af',
                                callback: function(value) { return value + '%'; },
                                font: { size: 10 }
                            },
                            grid: { color: '#1f2937' }
                        },
                        x: {
                            ticks: { color: '#9ca3af' },
                            grid: { color: '#1f2937' }
                        }
                    }
                }
            });
        }
    }

    mostrarDetalleRotacion(rotacionNum) {
        const equipoRotaciones = this.obtenerEquipoRotaciones();
        const nombreEquipoRotaciones = this.obtenerNombreEquipoRotaciones();
        const setFormacion = this.resolverSetFormacion(this.filtroRotaciones);
        const jugadores = this.obtenerJugadoresEnRotacion(equipoRotaciones, rotacionNum, this.filtroRotaciones);
        const stats = this.obtenerStatsRotacion(rotacionNum);
        const modal = document.getElementById('modalRotacion');
        const titulo = document.getElementById('modalRotacionTitulo');
        const contenido = document.getElementById('modalRotacionContenido');
        if (!modal || !titulo || !contenido) return;
        titulo.textContent = `🔄 Rotación ${rotacionNum} - ${nombreEquipoRotaciones}`;
        const renderizarEquipo = (jugadores, equipoNombre, colorClass) => {
            if (!jugadores || jugadores.length === 0) {
                return `<div class="text-center text-gray-500 text-sm py-4">La formación histórica de esta rotación no fue registrada. Las estadísticas de puntos sí son válidas.</div>`;
            }
            const delanteros = jugadores.slice(0, 3);
            const zagueros = jugadores.slice(3, 6);
            return `
                <div class="bg-dark/30 rounded-xl p-3 border ${colorClass === 'blue' ? 'border-blue-500/20' : 'border-red-500/20'}">
                    <h4 class="${colorClass === 'blue' ? 'text-blue-400' : 'text-red-400'} font-bold text-sm mb-2 text-center">
                        ${colorClass === 'blue' ? '🔵' : '🔴'} ${equipoNombre}
                    </h4>
                    <div class="text-center text-[8px] text-gray-500 uppercase tracking-wider mb-1">┈┈┈┈┈ RED ┈┈┈┈┈</div>
                    <div class="grid grid-cols-3 gap-2 mb-2">
                        ${delanteros.map(j => `
                            <div class="${colorClass === 'blue' ? 'bg-blue-900/30 border-blue-500/40' : 'bg-red-900/30 border-red-500/40'} rounded-lg p-2 border text-center">
                                <div class="text-xl font-bold text-white">${j.numero}</div>
                                <div class="text-[10px] text-gray-300 truncate">${j.nombreCorto || j.nombre || 'Jugador'}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        ${zagueros.map(j => `
                            <div class="${colorClass === 'blue' ? 'bg-blue-900/30 border-blue-500/40' : 'bg-red-900/30 border-red-500/40'} rounded-lg p-2 border text-center">
                                <div class="text-xl font-bold text-white">${j.numero}</div>
                                <div class="text-[10px] text-gray-300 truncate">${j.nombreCorto || j.nombre || 'Jugador'}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="text-center text-[8px] text-gray-500 mt-2">⬆ Delanteros · ⬇ Zagueros</div>
                </div>
            `;
        };
        contenido.innerHTML = `
            <div class="space-y-4">
                <div class="grid grid-cols-1 gap-4">
                    <div>${renderizarEquipo(jugadores, nombreEquipoRotaciones, equipoRotaciones === 'LOCAL' ? 'blue' : 'red')}</div>
                </div>
                ${stats ? `
                    <div class="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-4 border border-primary/20">
                        <div class="grid grid-cols-3 gap-4 text-center">
                            <div><div class="text-2xl font-bold text-green-400">${stats.puntosAFavor || 0}</div><div class="text-xs text-gray-400">🏐 Puntos a favor</div></div>
                            <div><div class="text-2xl font-bold text-red-400">${stats.puntosEnContra || 0}</div><div class="text-xs text-gray-400">⚡ Puntos en contra</div></div>
                            <div><div class="text-2xl font-bold ${stats.eficiencia > 60 ? 'text-green-400' : stats.eficiencia > 40 ? 'text-yellow-400' : 'text-red-400'}">${stats.eficiencia || 0}%</div><div class="text-xs text-gray-400">📊 Eficiencia</div></div>
                        </div>
                        <div class="text-center text-sm font-bold mt-2 ${stats.eficiencia > 60 ? 'text-green-400' : stats.eficiencia > 40 ? 'text-yellow-400' : 'text-red-400'}">${stats.estado || '⚖️ NEUTRA'}</div>
                    </div>
                ` : `
                    <div class="text-center text-gray-500 text-sm py-6 bg-dark/30 rounded-xl">📊 No hay suficientes datos para esta rotación</div>
                `}
                <div class="text-center text-[10px] text-gray-500 border-t border-gray-700/50 pt-3">💡 Estadísticas: ${this.filtroRotaciones === 'all' ? 'acumulado del partido' : `Set ${this.filtroRotaciones}`} · Formación mostrada: Set ${setFormacion}</div>
            </div>
        `;
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    resolverSetFormacion(setSeleccionado = this.filtroRotaciones) {
        const setsConPuntos = [...new Set((this.puntosJugadores || [])
            .map(punto => Number(punto.set))
            .filter(Number.isInteger))]
            .sort((a, b) => a - b);
        return setSeleccionado !== 'all'
            ? Number(setSeleccionado)
            : (setsConPuntos.find(set => this.formacionInicialPorSet?.[set]) || setsConPuntos[0] || 1);
    }

    obtenerJugadoresEnRotacion(equipo, rotacionNum, setSeleccionado = this.filtroRotaciones) {
        const setFormacion = this.resolverSetFormacion(setSeleccionado);
        const claveEquipo = equipo === 'VISITANTE' ? 'visitante' : 'local';
        const formacionInicial = this.formacionInicialPorSet?.[setFormacion]?.[claveEquipo];
        const jugadoresMap = equipo === 'VISITANTE'
            ? this.jugadoresVisitante
            : this.jugadoresLocal;

        return rotarFormacion(formacionInicial, rotacionNum).map(jugador => {
            const nombre = jugadoresMap[jugador.numero] || jugador.nombre || `Jugador ${jugador.numero}`;
            return {
                ...jugador,
                nombre,
                nombreCorto: jugador.nombreCorto || nombre.split(' ')[0]
            };
        });
    }

    obtenerStatsRotacion(rotacionNum) {
        const equipo = this.obtenerEquipoRotaciones();
        return obtenerStatsRotacionHelper(
            seleccionarPuntosParaRotaciones(
                this.data,
                this.puntosJugadores,
                equipo,
                this.filtroRotaciones
            ),
            equipo,
            rotacionNum
        );
    }

    updateCharts() {
        if (!this.data) return;
        
        this.destruirGrafico('scoreEvolutionChart', 'score');
        const sc = document.getElementById('scoreEvolutionChart');
        if (sc) {
            this.charts.score = new Chart(sc, {
                type: 'line',
                data: {
                    labels: this.data.map((_, i) => i + 1),
                    datasets: [
                        { label: this.homeTeamName, data: this.data.map(s => s.homeScore), borderColor: '#667eea', backgroundColor: 'rgba(102,126,234,0.1)', borderWidth: 2, fill: true, pointRadius: 1 },
                        { label: this.awayTeamName, data: this.data.map(s => s.awayScore), borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)', borderWidth: 2, fill: true, pointRadius: 1 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { labels: { color: '#fff' } } },
                    scales: { y: { ticks: { color: '#9ca3af' } }, x: { ticks: { color: '#9ca3af' } } }
                }
            });
        }
        
        this.destruirGrafico('runsHeatmap', 'runs');
        const rc = document.getElementById('runsHeatmap');
        if (rc) {
            this.charts.runs = new Chart(rc, {
                type: 'line',
                data: {
                    labels: this.data.map((_, i) => i + 1),
                    datasets: [
                        { label: 'Racha LOCAL', data: this.data.map(s => s.homeRun), borderColor: '#667eea', backgroundColor: 'rgba(102,126,234,0.2)', borderWidth: 2, fill: true, pointRadius: 0 },
                        { label: 'Racha VISITANTE', data: this.data.map(s => s.awayRun), borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.2)', borderWidth: 2, fill: true, pointRadius: 0 }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { labels: { color: '#fff' } } },
                    scales: { y: { ticks: { color: '#9ca3af' } }, x: { ticks: { color: '#9ca3af' } } }
                }
            });
        }
        
        this.destruirGrafico('phaseEfficiencyChart', 'phase');
        const pc = document.getElementById('phaseEfficiencyChart');
        if (pc) {
            const ph = { EARLY: { home: 0, away: 0, total: 0 }, MID: { home: 0, away: 0, total: 0 }, LATE: { home: 0, away: 0, total: 0 } };
            this.data.forEach(s => {
                if (s.scorer && ph[s.phase]) {
                    ph[s.phase][s.scorer === 'HOME' ? 'home' : 'away']++;
                    ph[s.phase].total++;
                }
            });
            const he = [
                ph.EARLY.total ? ((ph.EARLY.home / ph.EARLY.total) * 100).toFixed(1) : 0,
                ph.MID.total ? ((ph.MID.home / ph.MID.total) * 100).toFixed(1) : 0,
                ph.LATE.total ? ((ph.LATE.home / ph.LATE.total) * 100).toFixed(1) : 0
            ];
            const ae = [
                ph.EARLY.total ? ((ph.EARLY.away / ph.EARLY.total) * 100).toFixed(1) : 0,
                ph.MID.total ? ((ph.MID.away / ph.MID.total) * 100).toFixed(1) : 0,
                ph.LATE.total ? ((ph.LATE.away / ph.LATE.total) * 100).toFixed(1) : 0
            ];
            this.charts.phase = new Chart(pc, {
                type: 'bar',
                data: {
                    labels: ['Early (1-10)', 'Mid (11-20)', 'Late (21+)'],
                    datasets: [
                        { label: this.homeTeamName, data: he, backgroundColor: '#667eea', borderRadius: 4 },
                        { label: this.awayTeamName, data: ae, backgroundColor: '#f43f5e', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { labels: { color: '#fff' } } },
                    scales: {
                        y: { ticks: { color: '#9ca3af', callback: v => v + '%' }, max: 100 },
                        x: { ticks: { color: '#9ca3af' } }
                    }
                }
            });
        }
        
        this.destruirGrafico('momentumChart', 'momentum');
        const mc = document.getElementById('momentumChart');
        if (mc && this.data.length > 10) {
            const mom = [];
            for (let i = 9; i < this.data.length; i++) {
                const w = this.data.slice(i - 9, i + 1);
                mom.push(w.filter(w => w.scorer === 'HOME').length - w.filter(w => w.scorer === 'AWAY').length);
            }
            this.charts.momentum = new Chart(mc, {
                type: 'bar',
                data: {
                    labels: Array.from({ length: mom.length }, (_, i) => i + 10),
                    datasets: [{ label: 'Momentum', data: mom, backgroundColor: mom.map(m => m >= 0 ? '#667eea' : '#f43f5e') }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { labels: { color: '#fff' } } },
                    scales: { y: { ticks: { color: '#9ca3af' } }, x: { ticks: { color: '#9ca3af' } } }
                }
            });
        }
    }

    updateInterpretations(homeEff, awayEff, maxHomeRun, maxAwayRun, homeBreaks, awayBreaks, homeClutchPct, phaseHomeEff, sideoutPct, breakpointPct, serviceEffHome, serviceEffAway) {
        const c = document.getElementById('metricInterpretations');
        if (!c) return;
        const effH = homeEff || 0;
        const effA = awayEff || 0;
        const maxAR = maxAwayRun || 0;
        const maxHR = maxHomeRun || 0;
        const brH = homeBreaks || 0;
        const brA = awayBreaks || 0;
        const clutch = homeClutchPct || 0;
        const sideout = sideoutPct || 0;
        const breakpoint = breakpointPct || 0;
        const serviceEff = serviceEffHome || 0;
        const lateEff = phaseHomeEff?.late || 0;
        const earlyEff = phaseHomeEff?.early || 0;
        const midEff = phaseHomeEff?.mid || 0;
        const interpretaciones = [];
        if (effH > 60) {
            interpretaciones.push({ titulo: '🏆 DOMINIO ABSOLUTO', descripcion: `${this.homeTeamName} ganó el ${effH}% de los puntos. Diferencia de ${(effH - effA).toFixed(1)}% sobre el rival.`, accion: 'El sistema funciona. Mantener la estrategia y buscar perfeccionar detalles.' });
        } else if (effH > 55) {
            interpretaciones.push({ titulo: '✅ CONTROL DEL PARTIDO', descripcion: `${this.homeTeamName} ganó el ${effH}% de los puntos. Ventaja clara pero el rival compitió.`, accion: 'Analizar los momentos donde el rival descontó. ¿Fueron errores propios o méritos rivales?' });
        } else if (effH > 50) {
            interpretaciones.push({ titulo: '⚖️ VENTAJA MÍNIMA', descripcion: `${this.homeTeamName} solo ganó el ${effH}% de los puntos. Diferencia de ${(effH - effA).toFixed(1)}% sobre el rival.`, accion: 'El partido se definió por detalles. Revisar puntos de quiebre y momentos clutch.' });
        } else if (effH > 45) {
            interpretaciones.push({ titulo: '⚠️ PARTIDO PAREDO', descripcion: `${this.homeTeamName} ganó el ${effH}% vs ${effA}% del rival. Prácticamente empatados en eficiencia.`, accion: 'El resultado pudo ser para cualquiera. ¿En qué fase del set el equipo rindió peor?' });
        } else if (effH > 0) {
            interpretaciones.push({ titulo: '🔴 SUPERADO EN EFICIENCIA', descripcion: `${this.homeTeamName} solo ganó el ${effH}% de los puntos. El rival dominó el ${effA}%.`, accion: 'Trabajar en: reducción de errores no forzados y mayor eficacia en ataque.' });
        }
        if (maxHR > 5 && maxHR > maxAR + 2) {
            interpretaciones.push({ titulo: '💪 FUERZA EN RACHAS OFENSIVAS', descripcion: `${this.homeTeamName} encadenó ${maxHR} puntos seguidos, superando ampliamente la mejor racha rival (${maxAR}).`, accion: '¿Qué generó esas rachas? Saque agresivo, bloqueo efectivo o errores rivales? Identificar y replicar.' });
        } else if (maxAR > 5 && maxAR > maxHR + 2) {
            interpretaciones.push({ titulo: '🔥 DEBILIDAD ANTE RACHAS RIVALES', descripcion: `${this.awayTeamName} tuvo una racha de ${maxAR} puntos consecutivos, ${maxAR - maxHR} más que la mejor racha propia.`, accion: 'Ajustar: pedir tiempo muerto ANTES de que la racha crezca, cambiar la rotación de saque.' });
        } else if (maxAR > 5 || maxHR > 5) {
            interpretaciones.push({ titulo: '⚡ RACHAS MOMENTÁNEAS', descripcion: `Ambos equipos tuvieron rachas (${this.homeTeamName}: ${maxHR}, ${this.awayTeamName}: ${maxAR}). El partido fue de altibajos.`, accion: 'Trabajar la consistencia. Los equipos que mantienen el nivel por más tiempo suelen ganar.' });
        }
        if (brH > brA + 4) {
            interpretaciones.push({ titulo: '💪 PRESIÓN EFECTIVA CON SAQUE PROPIO', descripcion: `${this.homeTeamName} ganó ${brH} breakpoints, ${brH - brA} más que el rival.`, accion: 'Mantener la combinación de saque, bloqueo y defensa que produjo esos puntos.' });
        } else if (brA > brH + 4) {
            interpretaciones.push({ titulo: '⚠️ POCA PRODUCCIÓN CON SAQUE PROPIO', descripcion: `${this.awayTeamName} ganó ${brA} breakpoints y ${this.homeTeamName} ${brH}.`, accion: 'Trabajar presión de saque, organización de bloqueo y transición defensiva.' });
        } else if (brH + brA > 15) {
            interpretaciones.push({ titulo: '⚡ MUCHOS BREAKPOINTS', descripcion: `Hubo ${brH + brA} puntos ganados por el equipo que sacaba.`, accion: 'Revisar qué zonas de saque y sistemas de bloqueo generaron mayor ventaja.' });
        }
        if (clutch > 65) {
            interpretaciones.push({ titulo: '🧠 FORTALEZA MENTAL DESTACADA', descripcion: `${this.homeTeamName} ganó ${clutch}% de los puntos en momentos críticos (set point o diferencia ≤2).`, accion: 'El equipo no se achica. Entrenar situaciones de presión para mantener este nivel.' });
        } else if (clutch < 35 && clutch > 0) {
            interpretaciones.push({ titulo: '😰 DEBILIDAD BAJO PRESIÓN', descripcion: `${this.homeTeamName} solo ganó ${clutch}% de los puntos en situaciones críticas.`, accion: 'Entrenar ejercicios específicos: set point en contra, partidos empatados al final del set.' });
        } else if (clutch > 0) {
            const evaluacion = clutch > 55 ? 'aceptable' : (clutch > 45 ? 'regular' : 'bajo');
            interpretaciones.push({ titulo: '🎭 RENDIMIENTO BAJO PRESIÓN', descripcion: `${this.homeTeamName} ganó ${clutch}% de los puntos críticos. Rendimiento ${evaluacion}.`, accion: clutch > 55 ? 'Mantener la calma en momentos clave.' : 'Incorporar ejercicios de presión en los entrenamientos.' });
        }
        if (sideout > 65) {
            interpretaciones.push({ titulo: '🎯 EXCELENTE SIDEOUT', descripcion: `${this.homeTeamName} ganó ${sideout}% de los rallies en los que recibió el saque rival.`, accion: 'Es un buen resultado de sideout. Para identificar la causa, revisar por separado recepción, distribución y primer ataque.' });
        } else if (sideout < 45 && sideout > 0) {
            interpretaciones.push({ titulo: '⚠️ PROBLEMAS DE SIDEOUT', descripcion: `${this.homeTeamName} solo ganó ${sideout}% de los puntos cuando recibía.`, accion: 'Revisar recepción, disponibilidad de atacantes y eficacia del primer ataque.' });
        }
        if (breakpoint > 45) {
            interpretaciones.push({ titulo: '⚡ EXCELENTE BREAKPOINT', descripcion: `${this.homeTeamName} ganó ${breakpoint}% de los puntos mientras sacaba.`, accion: 'El saque propio y el sistema de bloqueo-defensa están generando ventaja.' });
        } else if (breakpoint < 25 && breakpoint > 0) {
            interpretaciones.push({ titulo: '🔻 BAJA PRODUCCIÓN CON SAQUE', descripcion: `${this.homeTeamName} solo ganó ${breakpoint}% de los puntos mientras sacaba.`, accion: 'Trabajar zonas de saque, relación saque-bloqueo y transición defensiva.' });
        }
        if (serviceEff > 15) {
            interpretaciones.push({ titulo: '🏐 SAQUE MUY EFECTIVO', descripcion: `Eficiencia de servicio del ${serviceEff}% (Aces - Errores). El saque es un arma ofensiva.`, accion: 'Mantener la agresividad controlada. Seguir variando zonas y velocidades.' });
        } else if (serviceEff < -5) {
            interpretaciones.push({ titulo: '❌ ERRORES DE SERVICIO', descripcion: `Eficiencia de servicio negativa (${serviceEff}%). Muchos errores no forzados.`, accion: 'Priorizar efectividad sobre potencia. Reducir los errores de saque como primer objetivo.' });
        } else if (serviceEff > 0 && serviceEff < 10) {
            interpretaciones.push({ titulo: '📊 SERVICIO NEUTRO', descripcion: `Eficiencia de servicio del ${serviceEff}%. No fue determinante en el resultado.`, accion: 'Buscar mayor agresividad sin aumentar errores. Entrenar saques flotantes y saltados a zonas clave.' });
        }
        if (earlyEff < 40 && earlyEff > 0) {
            interpretaciones.push({ titulo: '⏰ ARRANQUES LENTOS', descripcion: `${this.homeTeamName} tuvo solo ${earlyEff}% de efectividad en los primeros 10 puntos de cada set.`, accion: 'Trabajar la concentración desde el inicio. Calentamiento más intenso, entrada en calor efectiva.' });
        }
        if (lateEff < 40 && lateEff > 0) {
            interpretaciones.push({ titulo: '⏱️ CIERRE DE SETS DÉBIL', descripcion: `${this.homeTeamName} tuvo solo ${lateEff}% de efectividad en la fase final (puntos 21+).`, accion: 'Ejercicios de definición de sets. Entrenar con marcador 20-20, set point en contra, etc.' });
        }
        if (earlyEff > 60 && midEff > 60 && lateEff > 60) {
            interpretaciones.push({ titulo: '📊 CONSISTENCIA TOTAL', descripcion: `El equipo rindió por encima del 60% en TODAS las fases del set. Muy difícil de vencer.`, accion: 'Felicitaciones. Mantener el nivel y trabajar detalles tácticos.' });
        }
        if (interpretaciones.length === 0) {
            c.innerHTML = '<div class="text-center text-gray-400 py-6">Esperando más datos para generar análisis detallado...</div>';
            return;
        }
        c.innerHTML = interpretaciones.map(i =>
            `<div class="bg-dark/50 rounded-lg p-3 mb-2 border-l-4 border-primary hover:bg-dark/70 transition-all">
                <div class="font-bold text-primary text-xs md:text-sm mb-1 flex items-center gap-2"><span>📌</span> ${i.titulo}</div>
                <div class="text-gray-300 text-xs md:text-sm mb-2 pl-2">${i.descripcion}</div>
                <div class="text-amber-400 text-xs pl-2 border-t border-gray-700 pt-1 mt-1">💡 ${i.accion}</div>
            </div>`
        ).join('');
    }

    updateRecommendations(homeEff, awayEff, maxHomeRun, maxAwayRun, homeBreaks, awayBreaks, homeClutchPct, phaseHomeEff, sideoutPct, breakpointPct, serviceEffHome, serviceEffAway) {
        const c = document.getElementById('actionableRecommendations');
        if (!c) return;
        const effH = homeEff || 0;
        const maxAR = maxAwayRun || 0;
        const maxHR = maxHomeRun || 0;
        const brH = homeBreaks || 0;
        const brA = awayBreaks || 0;
        const clutch = homeClutchPct || 0;
        const sideout = sideoutPct || 0;
        const breakpoint = breakpointPct || 0;
        const serviceEff = serviceEffHome || 0;
        const lateEff = phaseHomeEff?.late || 0;
        const earlyEff = phaseHomeEff?.early || 0;
        const recomendaciones = [];
        if (effH < 48 && effH > 0) {
            recomendaciones.push({ prioridad: 'ALTA', area: 'EFICIENCIA GENERAL', texto: `Ganaste solo el ${effH}% de los puntos jugados.`, detalle: 'El rival dominó la mayor parte del partido. Hay que trabajar la eficiencia ofensiva y reducir errores.', tarea: 'Entrenar: reducción de errores no forzados, aumento del porcentaje de ataque.' });
        }
        if (maxAR > 6) {
            recomendaciones.push({ prioridad: 'ALTA', area: 'RACHAS RIVALES', texto: `${this.awayTeamName} tuvo una racha de ${maxAR} puntos consecutivos.`, detalle: 'Cuando el rival encadenó puntos, el equipo no pudo cortar la racha a tiempo.', tarea: 'Pedir tiempo muerto ANTES de que la racha crezca (al 3er o 4to punto seguido). Revisar rotación de saque.' });
        }
        if (clutch < 40 && clutch > 0) {
            recomendaciones.push({ prioridad: 'ALTA', area: 'MANEJO DE LA PRESIÓN', texto: `Solo convertiste ${clutch}% de los puntos en momentos críticos.`, detalle: 'El equipo se achica cuando el partido está parejo o hay set point en contra.', tarea: 'Ejercicios específicos: definir sets con marcador 20-20, 23-23, set point en contra.' });
        }
        if (breakpoint < 28 && breakpoint > 0) {
            recomendaciones.push({ prioridad: 'ALTA', area: 'SAQUE Y BLOQUEO-DEFENSA', texto: `Breakpoint% del ${breakpoint}% (muy bajo).`, detalle: 'El equipo produce pocos puntos mientras tiene el saque.', tarea: 'Trabajar zonas de saque, relación saque-bloqueo y transición defensiva.' });
        }
        if (sideout < 48 && sideout > 0) {
            recomendaciones.push({ prioridad: 'MEDIA', area: 'RECEPCIÓN Y PRIMER ATAQUE', texto: `Sideout% del ${sideout}% (por debajo del ideal 55%).`, detalle: 'Cuando recibe el saque rival, el equipo no recupera el servicio con suficiente frecuencia.', tarea: 'Ajustar recepción, distribución y definición del primer ataque.' });
        }
        if (brA > brH + 4) {
            recomendaciones.push({ prioridad: 'MEDIA', area: 'SISTEMA DE SAQUE/BLOQUEO', texto: `El rival ganó ${brA} breakpoints y el equipo ${brH}.`, detalle: 'El rival produjo más puntos mientras sacaba.', tarea: 'Revisar posicionamiento defensivo, relación saque-bloqueo y agresividad controlada.' });
        }
        if (lateEff < 45 && lateEff > 0 && effH > 0) {
            recomendaciones.push({ prioridad: 'MEDIA', area: 'CIERRE DE SETS', texto: `Solo ${lateEff}% de efectividad en puntos 21+ (fase Late).`, detalle: 'El equipo baja su rendimiento en la parte final de los sets.', tarea: 'Entrenar la definición: concentración en los últimos puntos, saque agresivo, manejo de tiempos.' });
        }
        if (serviceEff < -3) {
            recomendaciones.push({ prioridad: 'MEDIA', area: 'ERRORES DE SERVICIO', texto: `Eficiencia de servicio negativa (${serviceEff}%).`, detalle: 'Muchos puntos regalados por errores de saque no forzados.', tarea: 'Priorizar efectividad: saque flotante bien colocado en lugar de salto sin control.' });
        }
        if (earlyEff < 45 && earlyEff > 0) {
            recomendaciones.push({ prioridad: 'BAJA', area: 'ARRANQUE DE PARTIDO', texto: `Solo ${earlyEff}% de efectividad en los primeros 10 puntos.`, detalle: 'El equipo tarda en entrar en ritmo de competencia.', tarea: 'Mejorar la entrada en calor. Simular inicios de set en entrenamientos.' });
        }
        if (maxHR < 3 && effH > 0) {
            recomendaciones.push({ prioridad: 'BAJA', area: 'CONSISTENCIA OFENSIVA', texto: `Máxima racha de solo ${maxHR} puntos consecutivos.`, detalle: 'El equipo no logra encadenar puntos seguidos para tomar ventaja.', tarea: 'Trabajar la continuidad en ataque. Buscar sistemas ofensivos que generen puntos seguidos.' });
        }
        if (recomendaciones.length === 0 && effH > 0) {
            if (effH > 60) {
                recomendaciones.push({ prioridad: 'BAJA', area: '¡EXCELENTE PARTIDO!', texto: `Ganaste el ${effH}% de los puntos. Dominio claro.`, detalle: 'El equipo jugó a un nivel muy alto. Seguir por este camino.', tarea: 'Revisar los pequeños detalles que pueden marcar la diferencia en partidos más parejos.' });
            } else {
                recomendaciones.push({ prioridad: 'BAJA', area: 'BUEN PARTIDO', texto: `Ganaste el ${effH}% de los puntos.`, detalle: 'El equipo compitió bien. Con pequeños ajustes se puede mejorar.', tarea: 'Foco en: mayor eficacia en ataque y reducción de errores no forzados.' });
            }
        }
        c.innerHTML = recomendaciones.map(r => {
            const prioridadConfig = {
                'ALTA': { color: 'border-red-500 bg-red-500/10', icono: '🔴' },
                'MEDIA': { color: 'border-yellow-500 bg-yellow-500/10', icono: '🟡' },
                'BAJA': { color: 'border-blue-500 bg-blue-500/10', icono: '🔵' }
            };
            const config = prioridadConfig[r.prioridad];
            return `<div class="rounded-lg p-3 mb-2 border-l-4 ${config.color} transition-all hover:scale-[1.01]">
                <div class="flex items-center justify-between mb-1 flex-wrap gap-1">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold">${config.icono} ${r.prioridad}</span>
                        <span class="text-xs font-mono bg-gray-800 px-2 py-0.5 rounded-full">${r.area}</span>
                    </div>
                </div>
                <div class="text-white text-sm font-semibold mb-1">🎯 ${r.texto}</div>
                <div class="text-gray-400 text-xs mb-2">📊 ${r.detalle}</div>
                <div class="text-amber-400 text-xs border-t border-gray-700 pt-1 mt-1">⚡ ${r.tarea}</div>
            </div>`;
        }).join('');
    }

    updateSetDominance() {
        const sets = new Map();
        this.data.forEach(s => {
            if (!sets.has(s.set)) sets.set(s.set, { home: 0, away: 0 });
            const sd = sets.get(s.set);
            sd.home = s.homeScore;
            sd.away = s.awayScore;
        });
        const c = document.getElementById('setDominance');
        if (!c) return;
        c.innerHTML = '';
        for (const [num, sc] of sets) {
            const total = sc.home + sc.away;
            const hp = total ? (sc.home / total * 100) : 0;
            const ap = total ? (sc.away / total * 100) : 0;
            c.innerHTML += `<div class="bg-dark rounded-lg p-3 mb-2">
                <div class="flex justify-between mb-1">
                    <span class="text-primary font-semibold">Set ${num}</span>
                    <span class="text-sm">${sc.home}-${sc.away}</span>
                </div>
                <div class="flex h-6 rounded overflow-hidden">
                    <div class="bg-gradient-to-r from-primary to-secondary h-full flex items-center justify-center text-xs font-bold text-white" style="width: ${hp}%">${hp > 15 ? Math.round(hp) + '%' : ''}</div>
                    <div class="bg-gradient-to-r from-rose-400 to-rose-500 h-full flex items-center justify-center text-xs font-bold text-white" style="width: ${ap}%">${ap > 15 ? Math.round(ap) + '%' : ''}</div>
                </div>
            </div>`;
        }
    }

    updateTimeline() {
        const c = document.getElementById('timeline');
        if (!c) return;
        const resumenUltimos = resumirUltimosPuntos(this.data, 10);
        if (resumenUltimos.total >= 5) {
            const h10 = resumenUltimos.home;
            const a10 = resumenUltimos.away;
            let em = '',
                txt = '';
            if (h10 > a10 + 2) { em = '🔥';
                txt = `${this.homeTeamName} dominó el cierre`; } else if (a10 > h10 + 2) { em = '⚡';
                txt = `${this.awayTeamName} dominó el cierre`; } else { em = '⚖️';
                txt = 'Cierre parejo'; }
            c.innerHTML = `<div class="text-center p-3">
                <div class="text-sm font-semibold mb-2 text-gray-400">ÚLTIMOS ${resumenUltimos.total} PUNTOS</div>
                <div class="flex justify-center items-center gap-6">
                    <div class="text-center"><div class="text-3xl font-bold text-primary">${h10}</div><div class="text-xs text-gray-500">${this.homeTeamName}</div></div>
                    <div class="text-2xl">${em}</div>
                    <div class="text-center"><div class="text-3xl font-bold text-rose-400">${a10}</div><div class="text-xs text-gray-500">${this.awayTeamName}</div></div>
                </div>
                <div class="text-xs text-gray-500 mt-2">${txt}</div>
            </div>`;
        } else { c.innerHTML = '<div class="text-center text-gray-400 py-8">Esperando más datos...</div>'; }
    }

    updateDashboard() {
        if (!this.data?.length) {
            const clutchInsight = document.getElementById('clutchInsight');
            const breakPointsList = document.getElementById('breakPointsList');
            const setDominance = document.getElementById('setDominance');
            if (clutchInsight) clutchInsight.textContent = 'Todavía no hay puntos suficientes para analizar presión.';
            if (breakPointsList) breakPointsList.innerHTML = '<div class="text-center text-gray-400 py-4">Esperando puntos del partido...</div>';
            if (setDominance) setDominance.innerHTML = '<div class="text-center text-gray-400 py-6 text-sm">Esperando el inicio del partido...</div>';
            return;
        }
        const last = this.data[this.data.length - 1];
        document.getElementById('homeTeamName').textContent = this.homeTeamName;
        document.getElementById('awayTeamName').textContent = this.awayTeamName;
        document.getElementById('homeScore').textContent = last.homeScore;
        document.getElementById('awayScore').textContent = last.awayScore;
        const points = this.data.filter(s => s.scorer);
        const homePoints = points.filter(p => p.scorer === 'HOME').length;
        const awayPoints = points.filter(p => p.scorer === 'AWAY').length;
        const total = points.length;
        const maxHomeRun = Math.max(...this.data.map(s => s.homeRun), 0);
        const maxAwayRun = Math.max(...this.data.map(s => s.awayRun), 0);
        const metricasRally = calcularMetricasRally(this.data);
        const homeBreaks = metricasRally.equipos.HOME.breakpoint.exitos;
        const awayBreaks = metricasRally.equipos.AWAY.breakpoint.exitos;
        const homeEfficiency = total ? ((homePoints / total) * 100).toFixed(1) : 0;
        const awayEfficiency = total ? ((awayPoints / total) * 100).toFixed(1) : 0;
        const phases = { EARLY: { home: 0, away: 0, total: 0 }, MID: { home: 0, away: 0, total: 0 }, LATE: { home: 0, away: 0, total: 0 } };
        this.data.forEach(s => {
            if (s.scorer && phases[s.phase]) {
                phases[s.phase][s.scorer === 'HOME' ? 'home' : 'away']++;
                phases[s.phase].total++;
            }
        });
        const clutchPoints = this.data.filter(s => {
            const isSetPoint = (s.homeScore >= 24 && s.homeScore > s.awayScore) || (s.awayScore >= 24 && s.awayScore > s.homeScore);
            const isCloseGame = Math.abs(s.lead) <= 2;
            return (isSetPoint || isCloseGame) && s.scorer;
        });
        const homeClutch = clutchPoints.filter(c => c.scorer === 'HOME').length;
        const totalClutch = clutchPoints.length;
        const homeClutchPct = totalClutch ? ((homeClutch / totalClutch) * 100).toFixed(1) : 0;
        const solPct = metricasRally.equipos.HOME.sideout.porcentaje;
        const sovPct = metricasRally.equipos.AWAY.sideout.porcentaje;
        const bplPct = metricasRally.equipos.HOME.breakpoint.porcentaje;
        const bpvPct = metricasRally.equipos.AWAY.breakpoint.porcentaje;
        this.awayEfficiency = awayEfficiency;
        this.awayBreaks = awayBreaks;
        document.getElementById('maxRunHome').textContent = maxHomeRun;
        document.getElementById('maxRunAway').textContent = maxAwayRun;
        document.getElementById('breaksHome').textContent = homeBreaks;
        document.getElementById('breaksAway').textContent = awayBreaks;
        document.getElementById('efficiencyHome').textContent = `${homeEfficiency}%`;
        document.getElementById('efficiencyAway').textContent = `${awayEfficiency}%`;
        document.getElementById('totalPoints').textContent = total;
        document.getElementById('clutchHome').textContent = `${homeClutchPct}%`;
        const sel = document.getElementById('sideoutLocalLabel');
        if (sel) {
            sel.textContent = `${solPct}%`;
            document.getElementById('sideoutVisitanteLabel').textContent = `${sovPct}%`;
            const bar = document.getElementById('sideoutBarLocal');
            if (bar) { bar.style.width = `${solPct}%`;
                bar.textContent = `${solPct}%`; }
        }
        const bel = document.getElementById('breakpointLocalLabel');
        if (bel) {
            bel.textContent = `${bplPct}%`;
            document.getElementById('breakpointVisitanteLabel').textContent = `${bpvPct}%`;
            const bar = document.getElementById('breakpointBarLocal');
            if (bar) { bar.style.width = `${bplPct}%`;
                bar.textContent = `${bplPct}%`; }
        }
        if (totalClutch > 0) {
            const hw = (homeClutch / totalClutch) * 100;
            const hb = document.getElementById('clutchBarHome');
            const ab = document.getElementById('clutchBarAway');
            if (hb) { hb.style.width = `${hw}%`; hb.textContent = `${hw.toFixed(1)}%`; }
            if (ab) { ab.style.width = `${100 - hw}%`; ab.textContent = `${(100 - hw).toFixed(1)}%`; }
        }
        const clutchInsight = document.getElementById('clutchInsight');
        if (clutchInsight) {
            clutchInsight.textContent = totalClutch
                ? `${this.homeTeamName} ${homeClutchPct}% · ${this.awayTeamName} ${(100 - Number(homeClutchPct)).toFixed(1)}% sobre ${totalClutch} puntos críticos.`
                : 'Todavía no hubo suficientes puntos críticos para comparar.';
        }
        if (last?.servingAfter || last?.serving) {
            this.actualizarBadgeSaque(last.servingAfter || last.serving);
        }
        this.updateCharts();
        this.updateSetDominance();
        this.updateBreakPointsList();
        this.updateTimeline();
        this.updateInsightsList(homeEfficiency, homeBreaks);
        this.actualizarEstadisticasServicio();
        this.actualizarHoraUltimoPunto();
        const phaseHomeEff = {
            early: phases.EARLY.total ? ((phases.EARLY.home / phases.EARLY.total) * 100).toFixed(1) : 0,
            mid: phases.MID.total ? ((phases.MID.home / phases.MID.total) * 100).toFixed(1) : 0,
            late: phases.LATE.total ? ((phases.LATE.home / phases.LATE.total) * 100).toFixed(1) : 0
        };
        this.updateInterpretations(homeEfficiency, awayEfficiency, maxHomeRun, maxAwayRun, homeBreaks, awayBreaks, homeClutchPct, phaseHomeEff, solPct, bplPct, parseFloat(document.getElementById('serviceEfficiencyHome')?.textContent) || 0, parseFloat(document.getElementById('serviceEfficiencyAway')?.textContent) || 0);
        this.updateRecommendations(homeEfficiency, awayEfficiency, maxHomeRun, maxAwayRun, homeBreaks, awayBreaks, homeClutchPct, phaseHomeEff, solPct, bplPct, parseFloat(document.getElementById('serviceEfficiencyHome')?.textContent) || 0, parseFloat(document.getElementById('serviceEfficiencyAway')?.textContent) || 0);
        const ultimoPunto = [...this.data].reverse().find(p => p.scorer);
        const timestamp = ultimoPunto ? new Date(ultimoPunto.timestamp) : new Date();
        const segundos = Math.floor((new Date() - timestamp) / 1000);
        if (segundos <= 5 && ultimoPunto && this.ultimoPuntoSonido !== ultimoPunto.timestamp) {
            this.ultimoPuntoSonido = ultimoPunto.timestamp;
            if (ultimoPunto.scorer === 'HOME') this.soundManager.playLocalPoint();
            else if (ultimoPunto.scorer === 'AWAY') this.soundManager.playAwayPoint();
        }
        if (this.partidoTerminado && !this.matchEnded) {
            this.matchEnded = true;
            this.soundManager.playEndMatch();
        }
    }

    async saveAsHTML() {
        try {
            this.mostrarFeedbackPartido('📸 Generando reporte con gráficos...');
            const tabPartido = document.getElementById('tabPartido');
            if (tabPartido && this.vistaActual !== 'partido') {
                tabPartido.click();
                await new Promise(resolve => setTimeout(resolve, 800));
            }
            const vistaPartido = document.getElementById('vistaPartido');
            if (vistaPartido && vistaPartido.classList.contains('hidden')) {
                vistaPartido.classList.remove('hidden');
                const vistaIndividuales = document.getElementById('vistaIndividuales');
                if (vistaIndividuales) vistaIndividuales.classList.add('hidden');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            if (this.charts.score) this.charts.score.update();
            if (this.charts.momentum) this.charts.momentum.update();
            if (this.charts.runs) this.charts.runs.update();
            if (this.charts.phase) this.charts.phase.update();
            await new Promise(resolve => setTimeout(resolve, 1500));
            let scoreChartImage = '',
                momentumChartImage = '',
                runsChartImage = '',
                phaseChartImage = '';
            const scoreCanvas = document.getElementById('scoreEvolutionChart');
            if (scoreCanvas) { try { scoreChartImage = scoreCanvas.toDataURL('image/png'); } catch (e) {} }
            const momentumCanvas = document.getElementById('momentumChart');
            if (momentumCanvas) { try { momentumChartImage = momentumCanvas.toDataURL('image/png'); } catch (e) {} }
            const runsCanvas = document.getElementById('runsHeatmap');
            if (runsCanvas) { try { runsChartImage = runsCanvas.toDataURL('image/png'); } catch (e) {} }
            const phaseCanvas = document.getElementById('phaseEfficiencyChart');
            if (phaseCanvas) { try { phaseChartImage = phaseCanvas.toDataURL('image/png'); } catch (e) {} }
            let logoDataUrl = '';
            try {
                const logoResponse = await fetch('/dashboard/logo-horizontal.png');
                if (logoResponse.ok) {
                    const logoBlob = await logoResponse.blob();
                    logoDataUrl = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(logoBlob);
                    });
                }
            } catch (e) {
                console.warn('No se pudo incrustar el logo en el reporte:', e.message);
            }
            const last = this.data ? this.data[this.data.length - 1] : null;
            const homeTeam = this.homeTeamName;
            const awayTeam = this.awayTeamName;
            const homeScore = last ? last.homeScore : 0;
            const awayScore = last ? last.awayScore : 0;
            const points = this.data ? this.data.filter(s => s.scorer) : [];
            const homePoints = points.filter(p => p.scorer === 'HOME').length;
            const awayPoints = points.filter(p => p.scorer === 'AWAY').length;
            const total = points.length;
            const homeEfficiency = total ? ((homePoints / total) * 100).toFixed(1) : 0;
            const awayEfficiency = total ? ((awayPoints / total) * 100).toFixed(1) : 0;
            const maxHomeRun = this.data ? Math.max(...this.data.map(s => s.homeRun), 0) : 0;
            const maxAwayRun = this.data ? Math.max(...this.data.map(s => s.awayRun), 0) : 0;
            const metricasRally = calcularMetricasRally(this.data || []);
            const homeBreaks = metricasRally.equipos.HOME.breakpoint.exitos;
            const awayBreaks = metricasRally.equipos.AWAY.breakpoint.exitos;
            const sideoutHome = metricasRally.equipos.HOME.sideout.porcentaje;
            const sideoutAway = metricasRally.equipos.AWAY.sideout.porcentaje;
            const breakpointHome = metricasRally.equipos.HOME.breakpoint.porcentaje;
            const breakpointAway = metricasRally.equipos.AWAY.breakpoint.porcentaje;
            const clutchPoints = this.data ? this.data.filter(s => {
                const isSetPoint = (s.homeScore >= 24 && s.homeScore > s.awayScore) || (s.awayScore >= 24 && s.awayScore > s.homeScore);
                const isCloseGame = Math.abs(s.lead) <= 2;
                return (isSetPoint || isCloseGame) && s.scorer;
            }) : [];
            const homeClutch = clutchPoints.filter(c => c.scorer === 'HOME').length;
            const totalClutch = clutchPoints.length;
            const homeClutchPct = totalClutch > 0 ? ((homeClutch / totalClutch) * 100).toFixed(1) : 0;
            const phases = { EARLY: { home: 0, away: 0, total: 0 }, MID: { home: 0, away: 0, total: 0 }, LATE: { home: 0, away: 0, total: 0 } };
            if (this.data) {
                this.data.forEach(s => {
                    if (s.scorer && phases[s.phase]) {
                        phases[s.phase][s.scorer === 'HOME' ? 'home' : 'away']++;
                        phases[s.phase].total++;
                    }
                });
            }
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
            const sets = new Map();
            if (this.data) {
                this.data.forEach(s => {
                    if (!sets.has(s.set)) sets.set(s.set, { home: 0, away: 0 });
                    const setData = sets.get(s.set);
                    setData.home = s.homeScore;
                    setData.away = s.awayScore;
                });
            }
            const estadoReporte = evaluarEstadoPartido(sets, this.configSets, this.estadoOficialPartido);
            const setsReporte = [];
            let setsHtml = '';
            for (const [num, scores] of sets) {
                const isFinished = isSetTerminadoHelper(scores.home, scores.away, num, this.configSets);
                const winner = isFinished
                    ? `🏆 ${scores.home > scores.away ? homeTeam : awayTeam}`
                    : '🔴 En curso';
                setsReporte.push({
                    number: Number(num),
                    home: Number(scores.home),
                    away: Number(scores.away),
                    status: isFinished ? 'final' : 'partial'
                });
                const bgColor = !isFinished ? 'background: linear-gradient(135deg, #1a1f2e, #0f1119); border: 2px solid #667eea;' : 'background: linear-gradient(135deg, #1a1f2e, #0f1119); border: 1px solid rgba(102,126,234,0.3);';
                setsHtml += `<div style="${bgColor} border-radius: 12px; padding: 15px; text-align: center;">
                    <div style="font-size: 14px; font-weight: bold; color: #667eea; margin-bottom: 8px;">SET ${num}</div>
                    <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;"><span style="color: #3b82f6;">${scores.home}</span><span style="color: #6b7280;"> - </span><span style="color: #ef4444;">${scores.away}</span></div>
                    <div style="font-size: 12px; color: #10b981;">${winner}</div>
                </div>`;
            }
            let tablaLocal = '';
            let tablaVisitante = '';
            let statsLocalCalculadas = null;
            let statsVisitanteCalculadas = null;
            const puntosKey = `puntos_${this.matchId}`;
            const puntosGuardados = localStorage.getItem(puntosKey);
            let puntosJugadoresRaw = null;
            if (puntosGuardados) {
                puntosJugadoresRaw = JSON.parse(puntosGuardados);
            } else {
                console.log('❌ No se encontraron puntos en localStorage para matchId:', this.matchId, puntosKey);
            }
            if ((!puntosJugadoresRaw || puntosJugadoresRaw.length === 0) && this.puntosJugadores && this.puntosJugadores.length > 0) {
                puntosJugadoresRaw = this.puntosJugadores;
            }
            if (puntosJugadoresRaw && puntosJugadoresRaw.length > 0) {
                statsLocalCalculadas = calcularStatsPorJugador(puntosJugadoresRaw, 'LOCAL');
                statsVisitanteCalculadas = calcularStatsPorJugador(puntosJugadoresRaw, 'VISITANTE');
                tablaLocal = generarTablaHTMLSimple(statsLocalCalculadas, this.jugadoresLocal);
                tablaVisitante = generarTablaHTMLSimple(statsVisitanteCalculadas, this.jugadoresVisitante);
            } else {
                console.log('⚠️ No hay puntos para generar tablas individuales');
                const noDataMsg = '<tr><td colspan="16" style="text-align:center;padding:40px;">No hay puntos registrados para este partido</td></tr>';
                tablaLocal = noDataMsg;
                tablaVisitante = noDataMsg;
            }
            let breakPointsHtml = '';
            if (metricasRally.breakpoints.length) {
                breakPointsHtml = '<div style="max-height:300px;overflow-y:auto;">' + metricasRally.breakpoints.slice(-20).reverse().map(punto => {
                    const isHome = punto.equipoBreakpoint === 'HOME';
                    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:${isHome ? 'rgba(102,126,234,0.1)' : 'rgba(244,63,94,0.1)'};border-radius:10px;margin-bottom:8px;"><span>Set ${punto.set || '-'}</span><strong style="color:${isHome ? '#667eea' : '#f43f5e'};">🏐 ${isHome ? homeTeam : awayTeam}</strong><span>${punto.homeScore ?? '?'}-${punto.awayScore ?? '?'}</span></div>`;
                }).join('') + '</div>';
            }
            if (!breakPointsHtml) breakPointsHtml = '<div style="text-align:center;padding:30px;color:#6b7280;">No hubo breakpoints ganados con saque propio</div>';
            let timelineHtml = '';
            const resumenUltimos = resumirUltimosPuntos(this.data, 10);
            if (resumenUltimos.total >= 5) {
                const homeLast10 = resumenUltimos.home;
                const awayLast10 = resumenUltimos.away;
                let emoji = '',
                    text = '';
                if (homeLast10 > awayLast10 + 2) { emoji = '🔥';
                    text = `${homeTeam} dominó el cierre`; } else if (awayLast10 > homeLast10 + 2) { emoji = '⚡';
                    text = `${awayTeam} dominó el cierre`; } else { emoji = '⚖️';
                    text = 'Cierre parejo'; }
                timelineHtml = `<div style="text-align: center; padding: 20px;">
                    <div style="font-size: 14px; font-weight: bold; margin-bottom: 15px;">ÚLTIMOS ${resumenUltimos.total} PUNTOS</div>
                    <div style="display: flex; justify-content: center; align-items: center; gap: 30px;">
                        <div><div style="font-size: 40px; font-weight: bold; color: #667eea;">${homeLast10}</div><div style="font-size: 12px; color: #6b7280;">${homeTeam}</div></div>
                        <div style="font-size: 32px;">${emoji}</div>
                        <div><div style="font-size: 40px; font-weight: bold; color: #f43f5e;">${awayLast10}</div><div style="font-size: 12px; color: #6b7280;">${awayTeam}</div></div>
                    </div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 12px;">${text}</div>
                </div>`;
            } else { timelineHtml = '<div style="text-align: center; padding: 30px; color: #6b7280;">Esperando más datos...</div>'; }
            let interpretationsHtml = '';
            if (homeEfficiency > 55) interpretationsHtml += `<div style="border-left: 3px solid #10b981; padding: 12px; margin-bottom: 10px;">📊 EFICIENCIA (${homeEfficiency}%) → ${homeTeam} dominó el partido.</div>`;
            else if (homeEfficiency < 45) interpretationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">⚠️ EFICIENCIA (${homeEfficiency}%) → ${awayTeam} dominó el partido.</div>`;
            else interpretationsHtml += `<div style="border-left: 3px solid #f59e0b; padding: 12px; margin-bottom: 10px;">⚖️ EFICIENCIA (${homeEfficiency}%) → Partido parejo.</div>`;
            if (maxAwayRun > 5) interpretationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">🔥 RACHA RIVAL (${maxAwayRun} pts) → ${awayTeam} tuvo una racha larga.</div>`;
            if (maxHomeRun > 5) interpretationsHtml += `<div style="border-left: 3px solid #10b981; padding: 12px; margin-bottom: 10px;">💪 RACHA PROPIA (${maxHomeRun} pts) → ${homeTeam} encadenó puntos.</div>`;
            if (homeBreaks > awayBreaks + 5) interpretationsHtml += `<div style="border-left:3px solid #10b981;padding:12px;margin-bottom:10px;">💪 BREAKPOINTS (${homeBreaks} vs ${awayBreaks}) → ${homeTeam} produjo más puntos con saque propio.</div>`;
            else if (awayBreaks > homeBreaks + 5) interpretationsHtml += `<div style="border-left:3px solid #ef4444;padding:12px;margin-bottom:10px;">⚠️ BREAKPOINTS (${homeBreaks} vs ${awayBreaks}) → ${awayTeam} produjo más puntos con saque propio.</div>`;
            if (homeClutchPct > 60) interpretationsHtml += `<div style="border-left: 3px solid #10b981; padding: 12px; margin-bottom: 10px;">🏆 BAJO PRESIÓN (${homeClutchPct}%) → ${homeTeam} demostró temple.</div>`;
            else if (homeClutchPct < 35 && homeClutchPct > 0) interpretationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">⚠️ BAJO PRESIÓN (${homeClutchPct}%) → ${homeTeam} mostró debilidad.</div>`;
            let recommendationsHtml = '';
            if (homeEfficiency < 45) recommendationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">📌 Mejorar eficiencia en ataque - ${homeTeam} solo ganó el ${homeEfficiency}% de los puntos</div>`;
            if (maxAwayRun > 5) recommendationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">📌 ${awayTeam} tuvo una racha de ${maxAwayRun} puntos. Ajustar bloqueo y recepción.</div>`;
            if (awayBreaks > homeBreaks + 5) recommendationsHtml += `<div style="border-left:3px solid #ef4444;padding:12px;margin-bottom:10px;">📌 ${awayTeam} ganó ${awayBreaks} breakpoints. Revisar presión de saque y relación saque-bloqueo.</div>`;
            if (homeClutchPct < 40 && homeClutchPct > 0) recommendationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">📌 Entrenar presión: ${homeTeam} solo convirtió ${homeClutchPct}% en momentos críticos.</div>`;
            if (homePhaseEff.late < 40 && homePhaseEff.late > 0) recommendationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">📌 Débil en el cierre (${homePhaseEff.late}% en Late Game). Trabajar definición.</div>`;
            if (!recommendationsHtml) recommendationsHtml = '<div style="border-left: 3px solid #10b981; padding: 12px;">🏆 Buen partido! Mantener la estrategia.</div>';
            const eficienciaPorSet = [];
            const puntosPorSet = [];
            let datosParaEficiencia = null;
            if (this.data && this.data.length > 0 && this.data.some(p => p.scorer)) {
                datosParaEficiencia = this.data;
            } else if (this.puntosJugadores && this.puntosJugadores.length > 0) {
                datosParaEficiencia = this.puntosJugadores;
            }
            if (datosParaEficiencia && datosParaEficiencia.length > 0) {
                const setsUnicos = [...new Set(datosParaEficiencia.map(p => p.set || 1))].sort((a, b) => a - b);
                for (const setNum of setsUnicos) {
                    const puntosSet = datosParaEficiencia.filter(p => (p.set || 1) === setNum);
                    let localSet = 0,
                        visitanteSet = 0;
                    for (const p of puntosSet) {
                        if (p.scorer === 'HOME') localSet++;
                        else if (p.scorer === 'AWAY') visitanteSet++;
                        else if (p.equipoAnota === 'LOCAL') localSet++;
                        else if (p.equipoAnota === 'VISITANTE') visitanteSet++;
                    }
                    const totalSet = localSet + visitanteSet;
                    eficienciaPorSet.push({
                        set: `Set ${setNum}`,
                        local: totalSet > 0 ? ((localSet / totalSet) * 100).toFixed(1) : 0,
                        visitante: totalSet > 0 ? ((visitanteSet / totalSet) * 100).toFixed(1) : 0
                    });
                    puntosPorSet.push({ set: setNum, local: localSet, visitante: visitanteSet });
                }
            }
            const localPorSet = {};
            const visitantePorSet = {};
            if (statsLocalCalculadas && statsVisitanteCalculadas) {
                localPorSet['todos'] = tablaLocal;
                visitantePorSet['todos'] = tablaVisitante;
            }
            if (puntosJugadoresRaw && puntosJugadoresRaw.length > 0) {
                const setsUnicosPuntos = [...new Set(puntosJugadoresRaw.map(p => Number(p.set || 1)))].sort((a, b) => a - b);
                for (const setNum of setsUnicosPuntos) {
                    const puntosSet = puntosJugadoresRaw.filter(p => Number(p.set || 1) === setNum);
                    const statsLocalSet = calcularStatsPorJugador(puntosSet, 'LOCAL');
                    const statsVisitanteSet = calcularStatsPorJugador(puntosSet, 'VISITANTE');
                    localPorSet[setNum] = generarTablaHTMLSimple(statsLocalSet, this.jugadoresLocal);
                    visitantePorSet[setNum] = generarTablaHTMLSimple(statsVisitanteSet, this.jugadoresVisitante);
                }
            }
            const resumenLocal = resumirPuntosEquipo(puntosJugadoresRaw || [], 'LOCAL', statsLocalCalculadas || {});
            const resumenVisitante = resumirPuntosEquipo(puntosJugadoresRaw || [], 'VISITANTE', statsVisitanteCalculadas || {});
            const servicioReporte = calcularEstadisticasServicio(this.data, puntosJugadoresRaw || []);
            const leerMarcas = (clave) => {
                try { return JSON.parse(localStorage.getItem(clave) || '[]'); }
                catch { return []; }
            };
            const marcas = [...leerMarcas(`breaks_${this.matchId}`), ...leerMarcas(`marcas_${this.matchId}`)];
            const marcasManualHtml = marcas.length
                ? marcas.map(marca => `<div style="display:flex;justify-content:space-between;padding:10px;background:rgba(124,58,237,.1);border-radius:8px;margin-bottom:6px;"><span>⭐ Momento clave · Set ${marca.set || '-'}</span><strong>${marca.equipo || '-'}</strong><span>${marca.marcador || '-'}</span></div>`).join('')
                : '<div style="color:#6b7280;text-align:center;">Sin marcas manuales</div>';
            const generadoEn = new Date();
            const datosReporte = {
                homeTeam,
                awayTeam,
                homeScore,
                awayScore,
                fechaHora: generadoEn.toLocaleString(),
                homeEfficiency,
                awayEfficiency,
                maxHomeRun,
                maxAwayRun,
                homeBreaks,
                awayBreaks,
                sideoutHome,
                sideoutAway,
                breakpointHome,
                breakpointAway,
                serviceEfficiencyHome: servicioReporte.home.eficiencia,
                serviceEfficiencyAway: servicioReporte.away.eficiencia,
                totalPoints: total,
                homeClutchPct,
                homePhaseEff,
                awayPhaseEff,
                setsHtml,
                scoreChartImage,
                momentumChartImage,
                runsChartImage,
                phaseChartImage,
                breakPointsHtml,
                timelineHtml,
                interpretationsHtml,
                recommendationsHtml,
                tablaLocal,
                tablaVisitante,
                eficienciaPorSet: eficienciaPorSet,
                puntosPorSet: puntosPorSet,
                localPorSet: localPorSet,
                visitantePorSet: visitantePorSet,
                resumenLocal,
                resumenVisitante,
                marcasManualHtml,
                rotacionesHtml: this.generarRotacionesHTML(),
                logoDataUrl,
                reportMetadata: {
                    generatedAt: generadoEn.toISOString(),
                    displayDate: generadoEn.toLocaleString(),
                    matchId: this.matchId,
                    category: this.categoria,
                    status: estadoReporte.partidoTerminado ? 'final' : 'partial',
                    homeSets: estadoReporte.setsGanadosLocal,
                    awaySets: estadoReporte.setsGanadosVisitante,
                    sets: setsReporte,
                    metrics: {
                        home: {
                            efficiency: { percentage: Number(homeEfficiency), successes: homePoints, attempts: total },
                            sideout: { percentage: sideoutHome, successes: metricasRally.equipos.HOME.sideout.exitos, attempts: metricasRally.equipos.HOME.sideout.oportunidades },
                            breakpoint: { percentage: breakpointHome, successes: metricasRally.equipos.HOME.breakpoint.exitos, attempts: metricasRally.equipos.HOME.breakpoint.oportunidades },
                            clutch: { percentage: Number(homeClutchPct), successes: homeClutch, attempts: totalClutch },
                            service: { percentage: servicioReporte.home.eficiencia, aces: servicioReporte.home.aces, errors: servicioReporte.home.errores, attempts: servicioReporte.home.totalSaques }
                        },
                        away: {
                            efficiency: { percentage: Number(awayEfficiency), successes: awayPoints, attempts: total },
                            sideout: { percentage: sideoutAway, successes: metricasRally.equipos.AWAY.sideout.exitos, attempts: metricasRally.equipos.AWAY.sideout.oportunidades },
                            breakpoint: { percentage: breakpointAway, successes: metricasRally.equipos.AWAY.breakpoint.exitos, attempts: metricasRally.equipos.AWAY.breakpoint.oportunidades },
                            clutch: { percentage: totalClutch ? Number((((totalClutch - homeClutch) / totalClutch) * 100).toFixed(1)) : 0, successes: totalClutch - homeClutch, attempts: totalClutch },
                            service: { percentage: servicioReporte.away.eficiencia, aces: servicioReporte.away.aces, errors: servicioReporte.away.errores, attempts: servicioReporte.away.totalSaques }
                        }
                    }
                }
            };
            const reportHtml = ReporteGenerator.generarHTML(datosReporte);
            const blob = new Blob([reportHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte_${homeTeam}_vs_${awayTeam}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`;
            a.click();
            URL.revokeObjectURL(url);
            this.mostrarFeedbackPartido('📄 Reporte generado correctamente');
        } catch (e) {
            console.error('Error al guardar HTML:', e);
            this.mostrarFeedbackPartido('❌ Error al generar el reporte: ' + e.message);
        }
    }
}
