// dashboard/js/dashboard.js
import { OfflineManager, SoundManager } from './utils.js';
import { ReporteGenerator } from './reporteGenerator.js';
import { 
    calcularStatsPorJugador, 
    actualizarTablaConStats, 
    renderizarSoloNombres, 
    renderizarTop5ConNombres, 
    renderizarGraficoPuntos,
    calcularEstadisticasServicio,
    generarTablaHTMLSimple
} from './StatsHelper.js';

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
        this.vistaActual = 'partido';
        this.filtroSet = 'all';
        this.puntosJugadores = null;
        this.chartPuntosJugadores = null;
        this.jugadoresLocal = {};
        this.jugadoresVisitante = {};
        this.refreshInterval = null;
        this.ultimoPuntoSonido = null;
        this.categoria = null;
        this.reglamento = null;
        this.configSets = { maxSets: 3, setsParaGanar: 2, puntosSetNormal: 25, puntosSetDecisivo: 15 };
        
        this.mostrarSkeleton(true);
        setTimeout(() => this.mostrarSkeleton(false), 5000);
        
        document.body.addEventListener('click', () => {
            if (this.soundManager.audioContext && this.soundManager.audioContext.state === 'suspended') {
                this.soundManager.audioContext.resume();
                this.mostrarFeedbackPartido('🔊 Sonidos activados', 'success');
            }
        }, { once: true });
        
        this.cargarConfiguracion().then(() => {
            this.cargarReglamento();
            this.connectWebSocket();
            this.loadData();
            this.startAutoRefresh();
            this.setupRefreshIntervalSelector();
            this.startConnectionMonitor();
            this.setupLivePanel();
            this.setupEventListeners();
            this.cargarPuntosJugadores();
            this.setupTabs();
            this.setupFiltrosSets();
            this.cargarPartidosHistoricos();
            this.startAutoRefreshPuntos();
            this.actualizarSets();
        });
    }
                   mostrarSkeleton(mostrar) {
                const skeleton = document.getElementById('skeletonLoader');
                const realContent = document.getElementById('realContent');
                if (mostrar) { if(skeleton) skeleton.style.display = 'flex'; if(realContent) realContent.style.display = 'none'; }
                else { if(skeleton) skeleton.style.display = 'none'; if(realContent) realContent.style.display = 'block'; }
            }
            
            startAutoRefreshPuntos() { 
                setInterval(() => { 
                    const puntosKey = `puntos_${this.matchId}`; 
                    const puntosGuardados = localStorage.getItem(puntosKey); 
                    if (puntosGuardados) { 
                        const nuevosPuntos = JSON.parse(puntosGuardados); 
                        if (JSON.stringify(this.puntosJugadores) !== JSON.stringify(nuevosPuntos)) { 
                            this.puntosJugadores = nuevosPuntos; 
                            this.cargarTimeouts();
                            this.actualizarVistaIndividuales();
                            this.actualizarSets();
                        } 
                    } 
                }, 3000); 
            }
            
            startAutoRefresh() { setInterval(() => { this.loadData(); }, 5000); }
            setupLivePanel() { setInterval(() => { if (this.data && this.data.length > 0) this.updateLivePanel(); }, 1000); }
            
            startConnectionMonitor() {
                let interval = 10000;
                const monitor = () => { this.checkConnection(); const text = document.getElementById('connectionText'); interval = text?.textContent.includes('Sin conexión') ? 3000 : 10000; setTimeout(() => monitor(), interval); };
                monitor(); this.checkConnection();
            }
            
            connectWebSocket() {
                if (!this.useWebSocket) return;
                try {
                    this.socket = io('http://localhost:3002', { reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
                    this.socket.on('connect', () => { console.log('🔌 WebSocket conectado'); this.socket.emit('subscribe', this.matchId); this.mostrarFeedbackPartido('📡 Conexión en tiempo real activada'); });
                    this.socket.on('new_point', (data) => { console.log('⚡ Punto en tiempo real:', data); this.loadData(); this.actualizarSets(); });
                    this.socket.on('disconnect', () => { console.log('⚠️ WebSocket desconectado, usando polling'); this.mostrarFeedbackPartido('⚠️ Cambiando a modo polling'); });
                    this.socket.on('subscribed', (data) => { console.log(`📡 Suscrito a partido ${data.matchId}`); });
                } catch(e) { console.log('WebSocket no disponible, usando polling'); this.useWebSocket = false; }
            }
            async cargarReglamento() {
    try {
        const response = await fetch('/data/reglamento.json');
        if (response.ok) {
            const data = await response.json();
            this.reglamento = data;
            console.log('📜 Reglamento cargado:', this.reglamento);
            
            // Cargar categoría desde config.json
            const configResponse = await fetch('/data/config.json');
            if (configResponse.ok) {
                const config = await configResponse.json();
                this.categoria = config.categoria || null;
                console.log('🏷️ Categoría del partido:', this.categoria);
                this.aplicarConfiguracionSets();
            }
        } else {
            console.log('⚠️ No se encontró reglamento.json, usando valores por defecto');
        }
    } catch(e) {
        console.log('Error cargando reglamento:', e);
    }
}
aplicarConfiguracionSets() {
    if (!this.reglamento || !this.categoria) {
        console.log('📊 Usando configuración por defecto: 3 sets (al mejor de 3)');
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
        console.log(`📊 Configuración aplicada para categoría ${this.categoria}:`, this.configSets);
    } else {
        console.log(`⚠️ Categoría "${this.categoria}" no encontrada en reglamento. Usando valores por defecto.`);
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
                    if (new Date(punto.timestamp) > timeoutDate && !encontrado) { encontrado = true; puntosDespues.push(punto); }
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
                if (!this.timeouts || this.timeouts.length === 0) { container.innerHTML = '<div class="text-center text-gray-500 py-4">Sin timeouts registrados</div>'; return; }
                const timeoutsConEfectividad = this.timeouts.map(t => this.calcularEfectividadTimeout(t));
                const totalTimeouts = timeoutsConEfectividad.length;
                const efectivos = timeoutsConEfectividad.filter(t => t.efectividad === 'positiva').length;
                const mejoraPromedio = timeoutsConEfectividad.reduce((sum, t) => sum + parseFloat(t.mejora || 0), 0) / totalTimeouts;
                const html = `<div class="bg-dark/50 rounded-lg p-3 mb-4"><div class="grid grid-cols-3 gap-4 text-center"><div><div class="text-2xl font-bold text-primary">${totalTimeouts}</div><div class="text-xs text-gray-400">Total Timeouts</div></div><div><div class="text-2xl font-bold text-green-400">${efectivos}</div><div class="text-xs text-gray-400">Efectivos</div></div><div><div class="text-2xl font-bold ${mejoraPromedio > 0 ? 'text-green-400' : 'text-red-400'}">${mejoraPromedio > 0 ? '+' : ''}${mejoraPromedio.toFixed(1)}%</div><div class="text-xs text-gray-400">Mejora promedio</div></div></div></div>${timeoutsConEfectividad.map((t, idx) => {
                    let efectividadColor = '', efectividadIcono = '';
                    if (t.efectividad === 'positiva') { efectividadColor = 'border-green-500 bg-green-500/10'; efectividadIcono = '✅ POSITIVA'; }
                    else if (t.efectividad === 'negativa') { efectividadColor = 'border-red-500 bg-red-500/10'; efectividadIcono = '❌ NEGATIVA'; }
                    else { efectividadColor = 'border-yellow-500 bg-yellow-500/10'; efectividadIcono = '⚖️ NEUTRA'; }
                    return `<div class="bg-dark/30 rounded-lg p-3 border-l-4 ${efectividadColor}"><div class="flex justify-between items-center mb-2"><span class="font-bold text-primary">⏸️ TIMEOUT #${idx + 1}</span><span class="text-xs text-gray-500">Set ${t.set} - ${new Date(t.timestamp).toLocaleTimeString()}</span></div><div class="text-sm mb-2">${t.equipo === 'LOCAL' ? this.homeTeamName : this.awayTeamName} pidió timeout (${t.marcador})</div><div class="grid grid-cols-2 gap-4 text-center text-xs"><div class="bg-gray-800/50 rounded p-2"><div class="text-gray-400 mb-1">ANTES (últimos ${t.puntosAntes?.total || 0} puntos)</div><div class="flex justify-center gap-4"><span class="text-blue-400">${t.equipo === 'LOCAL' ? this.homeTeamName : this.awayTeamName}: ${t.puntosAntes?.local || 0}</span><span class="text-red-400">${t.equipo === 'VISITANTE' ? this.homeTeamName : this.awayTeamName}: ${t.puntosAntes?.rival || 0}</span></div><div class="text-gray-400 mt-1">Efi: ${t.eficienciaAntes || 0}%</div></div><div class="bg-gray-800/50 rounded p-2"><div class="text-gray-400 mb-1">DESPUÉS (primeros ${t.puntosDespues?.total || 0} puntos)</div><div class="flex justify-center gap-4"><span class="text-blue-400">${t.equipo === 'LOCAL' ? this.homeTeamName : this.awayTeamName}: ${t.puntosDespues?.local || 0}</span><span class="text-red-400">${t.equipo === 'VISITANTE' ? this.homeTeamName : this.awayTeamName}: ${t.puntosDespues?.rival || 0}</span></div><div class="text-gray-400 mt-1">Efi: ${t.eficienciaDespues || 0}%</div></div></div><div class="mt-2 text-center"><span class="text-xs font-semibold">Mejora: ${t.mejora > 0 ? '+' : ''}${t.mejora}% - Efectividad: ${efectividadIcono}</span></div></div>`;
                }).join('')}`;
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
                            const led = document.getElementById('connectionLed'); const text = document.getElementById('connectionText');
                            if (secondsSinceUpdate < 10) { led.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse'; text.textContent = 'Tracker activo'; text.className = 'text-xs text-green-400'; }
                            else if (secondsSinceUpdate < 60) { led.className = 'w-2 h-2 rounded-full bg-yellow-500'; text.textContent = `Último dato: ${Math.round(secondsSinceUpdate)}s`; text.className = 'text-xs text-yellow-400'; }
                            else { led.className = 'w-2 h-2 rounded-full bg-red-500'; text.textContent = 'Tracker inactivo'; text.className = 'text-xs text-red-400'; }
                            return;
                        }
                    }
                    const led = document.getElementById('connectionLed'); const text = document.getElementById('connectionText');
                    led.className = 'w-2 h-2 rounded-full bg-red-500'; text.textContent = 'Sin conexión'; text.className = 'text-xs text-red-400';
                } catch(e) { const led = document.getElementById('connectionLed'); const text = document.getElementById('connectionText'); led.className = 'w-2 h-2 rounded-full bg-red-500'; text.textContent = 'Error de conexión'; text.className = 'text-xs text-red-400'; }
            }
            
            setupRefreshIntervalSelector() {
                const selector = document.getElementById('refreshIntervalSelector');
                if (!selector) return;
                if (this.refreshInterval) clearInterval(this.refreshInterval);
                const startInterval = (ms) => { if (this.refreshInterval) clearInterval(this.refreshInterval); this.refreshInterval = setInterval(() => this.loadData(), ms); };
                selector.onchange = () => { const ms = parseInt(selector.value); startInterval(ms); this.mostrarFeedbackPartido(`⏱️ Refresco cada ${ms/1000} segundos`); };
                startInterval(3000);
            }
            
            actualizarSets() {
                const container = document.getElementById('setsList');
                if (!container) return;
                let datosParaSets = this.data;
                if (!datosParaSets?.length && this.puntosJugadores?.length) datosParaSets = this.puntosJugadores;
                if (!datosParaSets?.length) { container.innerHTML = '<div class="text-gray-500 text-xs">Esperando datos del partido...</div>'; return; }
                const setsMap = new Map();
                for (const punto of datosParaSets) {
                    const setNum = punto.set || 1;
                    if (!setsMap.has(setNum)) setsMap.set(setNum, { home: 0, away: 0 });
                    const setData = setsMap.get(setNum);
                    let homeScore = punto.homeScore, awayScore = punto.awayScore;
                    if ((homeScore === undefined || awayScore === undefined) && punto.marcadorDespues) {
                        const [h, a] = punto.marcadorDespues.split('-');
                        homeScore = parseInt(h); awayScore = parseInt(a);
                    }
                    if (!isNaN(homeScore) && !isNaN(awayScore)) { setData.home = homeScore; setData.away = awayScore; }
                }
                let hasValidData = false;
                for (const [num, scores] of setsMap) { if (scores.home > 0 || scores.away > 0) { hasValidData = true; break; } }
                if (!hasValidData) { container.innerHTML = '<div class="text-gray-500 text-xs">Esperando datos del partido...</div>'; return; }
                const setsArray = Array.from(setsMap.keys()).sort((a, b) => a - b);
                const ultimoSetNum = setsArray[setsArray.length - 1];
                const { local: setsGanadosLocal, visitante: setsGanadosVisitante } = this.calcularSetsGanados(setsMap);
const totalSetsPosibles = this.configSets.maxSets;
const setsParaGanar = this.configSets.setsParaGanar;
this.partidoTerminado = setsGanadosLocal >= setsParaGanar || setsGanadosVisitante >= setsParaGanar;
                let setsHtml = '';
                for (const setNum of setsArray) {
                    const set = setsMap.get(setNum);
                    const esUltimoSet = setNum === ultimoSetNum;
                    const setTerminado = this.isSetTerminado(set.home, set.away, setNum, setsArray.length);
                    let ganador = '', ganadorColor = '';
                    if (setTerminado) { if (set.home > set.away) { ganador = `🏆 ${this.homeTeamName}`; ganadorColor = 'text-blue-400'; } else { ganador = `🏆 ${this.awayTeamName}`; ganadorColor = 'text-red-400'; } }
                    const mostrarEnCurso = esUltimoSet && !setTerminado && !this.partidoTerminado;
                    const bgColor = esUltimoSet && !this.partidoTerminado ? 'bg-primary/20 border-primary' : 'bg-gray-800/50 border-gray-700';
                    const borderStyle = esUltimoSet && !this.partidoTerminado ? 'border-2' : 'border';
                    setsHtml += `<div class="${bgColor} ${borderStyle} rounded-lg px-3 py-2 min-w-[100px] text-center"><div class="text-xs font-bold ${esUltimoSet && !this.partidoTerminado ? 'text-primary' : 'text-gray-400'}">Set ${setNum}${mostrarEnCurso ? ' 🔴 EN CURSO' : ''}</div><div class="text-sm font-bold mt-1"><span class="text-blue-400">${set.home}</span><span class="text-gray-500"> - </span><span class="text-red-400">${set.away}</span></div>${ganador ? `<div class="text-xs ${ganadorColor} mt-1">${ganador}</div>` : ''}${mostrarEnCurso ? '<div class="text-xs text-gray-400 mt-1">En juego</div>' : ''}</div>`;
                }
                if (this.partidoTerminado) {
                    const campeon = setsGanadosLocal >= setsParaGanar ? this.homeTeamName : this.awayTeamName;
                    const marcadorSets = `${setsGanadosLocal} - ${setsGanadosVisitante}`;
                    container.innerHTML = `${setsHtml}<div class="w-full mt-3 text-center p-2 bg-green-900/30 rounded-lg border border-green-500/50"><div class="text-green-400 font-bold text-sm">🏆 PARTIDO FINALIZADO 🏆</div><div class="text-white font-bold text-base md:text-lg">${campeon} Ganador</div><div class="text-gray-400 text-xs">Sets: ${marcadorSets}</div></div>`;
                    return;
                }
                container.innerHTML = setsHtml || '<div class="text-gray-500 text-xs">No hay datos de sets</div>';
            }
            
            calcularSetsGanados(setsMap) {
                let local = 0, visitante = 0;
                for (const [setNum, set] of setsMap) if (this.isSetTerminado(set.home, set.away, setNum, setsMap.size)) set.home > set.away ? local++ : visitante++;
                return { local, visitante };
            }
            
            isSetTerminado(home, away, setNum, totalSets) {
    const esSetDecisivo = setNum === totalSets && totalSets === this.configSets.maxSets;
    const puntosNecesarios = esSetDecisivo ? this.configSets.puntosSetDecisivo : this.configSets.puntosSetNormal;
    return (home >= puntosNecesarios || away >= puntosNecesarios) && Math.abs(home - away) >= 2;
}
            
            async cargarPartidosHistoricos() {
                try {
                    const configResponse = await fetch('/data/config.json');
                    let currentId = null;
                    if (configResponse.ok) { const config = await configResponse.json(); currentId = config.matchId; this.matchId = currentId; }
                    const idsAPROBAR = new Set();
                    if (currentId) idsAPROBAR.add(currentId);
                    [260283,259953,259843,258193,248494,248357,248621,247173,247041,246922,246909,241363,231128,156803,156795].forEach(id => idsAPROBAR.add(id));
                    for (let i = 230000; i <= 260000; i += 1000) idsAPROBAR.add(i);
                    const partidos = [];
                    for (const id of idsAPROBAR) {
                        try {
                            const response = await fetch(`/data/match_${id}.json`);
                            if (response.ok) {
                                const data = await response.json();
                                if (data?.length) {
                                    const last = data[data.length - 1], first = data[0];
                                    partidos.push({ id, fecha: first.timestamp ? new Date(first.timestamp).toLocaleDateString() : 'Fecha desconocida', homeTeam: last.homeTeam || first.homeTeam || 'LOCAL', awayTeam: last.awayTeam || first.awayTeam || 'VISITANTE', resultado: `${last.homeScore}-${last.awayScore}` });
                                }
                            }
                        } catch(e) {}
                    }
                    partidos.sort((a, b) => b.id - a.id);
                    const selector = document.getElementById('partidoHistoricoSelector');
                    if (selector) selector.innerHTML = partidos.length ? '<option value="">-- Seleccionar partido --</option>' + partidos.map(p => `<option value="${p.id}" ${p.id == this.matchId ? 'selected' : ''}>${p.id} - ${p.homeTeam} vs ${p.awayTeam} (${p.fecha}) - ${p.resultado}</option>`).join('') : '<option value="">No hay partidos guardados</option>';
                    const cargarBtn = document.getElementById('cargarPartidoHistoricoBtn');
                    if (cargarBtn) {
                        const nuevoBtn = cargarBtn.cloneNode(true);
                        cargarBtn.parentNode.replaceChild(nuevoBtn, cargarBtn);
                        nuevoBtn.onclick = (e) => { e.preventDefault(); const selector = document.getElementById('partidoHistoricoSelector'); const nuevoId = parseInt(selector.value); if (nuevoId && nuevoId !== this.matchId) this.cambiarPartido(nuevoId); else if (nuevoId === this.matchId) this.mostrarFeedbackPartido(`📌 Ya estás viendo el partido ${nuevoId}`); else if (!nuevoId) this.mostrarFeedbackPartido('⚠️ Seleccioná un partido válido'); };
                    }
                } catch(e) { console.log('Error cargando partidos históricos:', e); }
            }
            
            async cambiarPartido(nuevoId) {
                const nombres = await this.obtenerNombresEquiposDesdeAPI(nuevoId);
                if (nombres) { this.homeTeamName = nombres.homeTeam; this.awayTeamName = nombres.awayTeam; document.getElementById('homeTeamName').textContent = this.homeTeamName; document.getElementById('awayTeamName').textContent = this.awayTeamName; }
                else { this.homeTeamName = "LOCAL"; this.awayTeamName = "VISITANTE"; }
                this.matchId = nuevoId;
                this.data = null;
                this.puntosJugadores = null;
                this.jugadoresLocal = {};
                this.jugadoresVisitante = {};
                localStorage.setItem(`jugadores_${this.matchId}_local`, JSON.stringify(this.jugadoresLocal));
                localStorage.setItem(`jugadores_${this.matchId}_visitante`, JSON.stringify(this.jugadoresVisitante));
                await this.loadData();
                await this.cargarPuntosJugadores();
                this.actualizarSets();
                this.cargarTimeouts();
                this.mostrarFeedbackPartido(`📊 ${this.homeTeamName} vs ${this.awayTeamName} (${nuevoId})`);
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
                        return true;
                    }
                } catch(e) {}
                return false;
            }
            
            async obtenerNombresEquiposDesdeAPI(matchId) {
                try {
                    const response = await fetch(`https://metrovoley.com.ar/api/matches/${matchId}/updates`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data?.match?.homeTeam?.name && data?.match?.awayTeam?.name) return { homeTeam: data.match.homeTeam.name, awayTeam: data.match.awayTeam.name };
                    }
                } catch(e) {}
                return null;
            }
            
            async loadData() {
                const offlineManager = new OfflineManager();
                const jugadoresLocalGuardados = localStorage.getItem(`jugadores_${this.matchId}_local`);
                const jugadoresVisitanteGuardados = localStorage.getItem(`jugadores_${this.matchId}_visitante`);
                if (jugadoresLocalGuardados) this.jugadoresLocal = JSON.parse(jugadoresLocalGuardados);
                if (jugadoresVisitanteGuardados) { this.jugadoresVisitante = JSON.parse(jugadoresVisitanteGuardados); this.actualizarVistaIndividuales(); }
                try {
                    const response = await fetch(`/data/match_${this.matchId}.json`);
                    if (response.ok) {
                        const newData = await response.json();
                        this.data = newData;
                        await offlineManager.saveMatchData(this.matchId, newData);
                        this.updateDashboard();
                        this.actualizarSets();
                    }
                    const fullResponse = await fetch(`/data/full_${this.matchId}.json?_t=${Date.now()}`);
                    if (fullResponse.ok) {
                        const fullData = await fullResponse.json();
                        this.jugadoresLocal = {};
                        this.jugadoresVisitante = {};
                        const findCourt = (obj) => {
                            if (!obj) return null;
                            if (obj.court) return obj.court;
                            if (obj.liveState?.court) return obj.liveState.court;
                            for (let key in obj) if (typeof obj[key] === 'object') { let found = findCourt(obj[key]); if (found) return found; }
                            return null;
                        };
                        this.cargarTimeouts();
                        const court = findCourt(fullData);
                        if (court) {
                            if (court.home?.positions) for (const [pos, info] of Object.entries(court.home.positions)) if (info.number) this.jugadoresLocal[info.number] = `Jugador ${info.number}`;
                            if (court.home?.bench) for (const info of court.home.bench) if (info.number && !this.jugadoresLocal[info.number]) this.jugadoresLocal[info.number] = `Jugador ${info.number}`;
                            if (court.away?.positions) for (const [pos, info] of Object.entries(court.away.positions)) if (info.number) this.jugadoresVisitante[info.number] = `Jugador ${info.number}`;
                            if (court.away?.bench) for (const info of court.away.bench) if (info.number && !this.jugadoresVisitante[info.number]) this.jugadoresVisitante[info.number] = `Jugador ${info.number}`;
                            localStorage.setItem(`jugadores_${this.matchId}_local`, JSON.stringify(this.jugadoresLocal));
                            localStorage.setItem(`jugadores_${this.matchId}_visitante`, JSON.stringify(this.jugadoresVisitante));
                            this.actualizarVistaIndividuales();
                        }
                    }
                    this.mostrarSkeleton(false);
                } catch(error) {
                    const cachedData = await offlineManager.getMatchData(this.matchId);
                    if (cachedData) { this.data = cachedData; this.updateDashboard(); this.mostrarFeedbackPartido('⚠️ Error de conexión - Usando datos cacheados'); }
                    this.mostrarSkeleton(false);
                }
            }
            
            async cargarPuntosJugadores() {
                const puntosKey = `puntos_${this.matchId}`;
                const puntosGuardados = localStorage.getItem(puntosKey);
                if (puntosGuardados) { this.puntosJugadores = JSON.parse(puntosGuardados); this.actualizarVistaIndividuales(); return; }
                try {
                    const response = await fetch(`/data/jugadores_${this.matchId}.json`);
                    if (response.ok) this.puntosJugadores = await response.json();
                    else this.puntosJugadores = [];
                    this.actualizarVistaIndividuales();
                } catch(e) { this.puntosJugadores = []; }
            }
            
            setupTabs() {
                const tp = document.getElementById('tabPartido'), ti = document.getElementById('tabIndividuales'), vp = document.getElementById('vistaPartido'), vi = document.getElementById('vistaIndividuales');
                if (!tp || !ti) return;
                tp.addEventListener('click', () => { this.vistaActual = 'partido'; tp.classList.add('bg-primary','text-white'); tp.classList.remove('bg-gray-700','text-gray-300'); ti.classList.add('bg-gray-700','text-gray-300'); ti.classList.remove('bg-primary','text-white'); if(vp) vp.classList.remove('hidden'); if(vi) vi.classList.add('hidden'); });
                ti.addEventListener('click', () => { this.vistaActual = 'individuales'; ti.classList.add('bg-primary','text-white'); ti.classList.remove('bg-gray-700','text-gray-300'); tp.classList.add('bg-gray-700','text-gray-300'); tp.classList.remove('bg-primary','text-white'); if(vp) vp.classList.add('hidden'); if(vi) vi.classList.remove('hidden'); this.actualizarVistaIndividuales(); });
            }
            
            setupFiltrosSets() {
                setTimeout(() => {
                    const btns = document.querySelectorAll('.filtro-set-btn');
                    if (!btns.length) return;
                    btns.forEach(btn => {
                        btn.removeEventListener('click', this.filtroSetHandler);
                        this.filtroSetHandler = (e) => {
                            const target = e.currentTarget;
                            btns.forEach(b => { b.classList.remove('bg-primary','text-white'); b.classList.add('bg-gray-700','text-gray-300'); });
                            target.classList.add('bg-primary','text-white');
                            target.classList.remove('bg-gray-700','text-gray-300');
                            this.filtroSet = target.dataset.set;
                            this.actualizarVistaIndividuales();
                        };
                        btn.addEventListener('click', this.filtroSetHandler);
                    });
                }, 100);
            }
            
 
            
actualizarVistaIndividuales() {
    renderizarSoloNombres('tablaLocalBody', this.jugadoresLocal, this.jugadoresVisitante, 'LOCAL');
    renderizarSoloNombres('tablaVisitanteBody', this.jugadoresLocal, this.jugadoresVisitante, 'VISITANTE');
    
    if (this.puntosJugadores && this.puntosJugadores.length > 0) {
        let datosFiltrados = this.puntosJugadores;
        if (this.filtroSet !== 'all') {
            datosFiltrados = this.puntosJugadores.filter(p => p.set == this.filtroSet);
        }
        
        const statsLocal = calcularStatsPorJugador(datosFiltrados, 'LOCAL');
        const statsVisitante = calcularStatsPorJugador(datosFiltrados, 'VISITANTE');
        
        actualizarTablaConStats('tablaLocalBody', statsLocal, this.jugadoresLocal, this.jugadoresVisitante, 'LOCAL');
        actualizarTablaConStats('tablaVisitanteBody', statsVisitante, this.jugadoresLocal, this.jugadoresVisitante, 'VISITANTE');
        
        const totalLocal = Object.values(statsLocal).reduce((sum, s) => sum + s.puntos, 0);
        const totalVisitante = Object.values(statsVisitante).reduce((sum, s) => sum + s.puntos, 0);
        const totalAcesLocal = Object.values(statsLocal).reduce((sum, s) => sum + (s.acesServicio || 0), 0);
        const totalAcesVisitante = Object.values(statsVisitante).reduce((sum, s) => sum + (s.acesServicio || 0), 0);
        const totalErroresServLocal = Object.values(statsLocal).reduce((sum, s) => sum + (s.erroresServicio || 0), 0);
        const totalErroresServVisitante = Object.values(statsVisitante).reduce((sum, s) => sum + (s.erroresServicio || 0), 0);
        
        document.getElementById('localTotalPts').innerHTML = `Total: ${totalLocal} pts`;
        document.getElementById('visitanteTotalPts').innerHTML = `Total: ${totalVisitante} pts`;
        document.getElementById('localTotalAces').innerHTML = `🎯 Aces: ${totalAcesLocal}`;
        document.getElementById('visitanteTotalAces').innerHTML = `🎯 Aces: ${totalAcesVisitante}`;
        document.getElementById('localTotalServErrors').innerHTML = `❌ Err Serv: ${totalErroresServLocal}`;
        document.getElementById('visitanteTotalServErrors').innerHTML = `❌ Err Serv: ${totalErroresServVisitante}`;
        
        renderizarTop5ConNombres(statsLocal, statsVisitante, this.jugadoresLocal, this.jugadoresVisitante);
        
        if (this.chartPuntosJugadores) {
            this.chartPuntosJugadores.destroy();
        }
        this.chartPuntosJugadores = renderizarGraficoPuntos(statsLocal, 'LOCAL', this.jugadoresLocal, this.jugadoresVisitante, this.chartPuntosJugadores);
        
    } else {
        document.getElementById('localTotalPts').innerHTML = 'Total: 0 pts';
        document.getElementById('visitanteTotalPts').innerHTML = 'Total: 0 pts';
        document.getElementById('localTotalAces').innerHTML = '🎯 Aces: 0';
        document.getElementById('visitanteTotalAces').innerHTML = '🎯 Aces: 0';
        document.getElementById('localTotalServErrors').innerHTML = '❌ Err Serv: 0';
        document.getElementById('visitanteTotalServErrors').innerHTML = '❌ Err Serv: 0';
        document.getElementById('top5List').innerHTML = '<div class="text-center text-gray-500">Sin datos de puntos</div>';
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
                const cm = document.getElementById('coachMomentum'), cr = document.getElementById('coachRun'), cb = document.getElementById('coachBreak'), cs = document.getElementById('coachScore');
                if (cm) { cm.innerHTML = txt; cm.style.color = col; }
                if (cr) cr.innerHTML = `🔥 Racha: ${this.homeTeamName} ${last.homeRun} - ${last.awayRun} ${this.awayTeamName}`;
                if (cb) { const br = this.data.filter(s => s.event?.includes('BREAK')); cb.innerHTML = `💪 Rompes: ${br.filter(b => b.event === 'BREAK_HOME').length} - ${br.filter(b => b.event === 'BREAK_AWAY').length}`; }
                if (cs) cs.innerHTML = `📊 ${last.homeScore} - ${last.awayScore} | ${Math.round((homePoints/total)*100)}% eficiencia`;
            }
            
            actualizarBadgeSaque(serving) {
                const bc = document.getElementById('servingBadge');
                if (!bc) return;
                if (this.partidoTerminado || !serving) { bc.innerHTML = ''; bc.classList.add('hidden'); return; }
                const isHome = serving === 'HOME';
                bc.innerHTML = `<div class="${isHome ? 'bg-blue-900/30' : 'bg-red-900/30'} border ${isHome ? 'border-blue-500/50' : 'border-red-500/50'} rounded-full px-3 py-1 md:px-4 md:py-1.5 flex items-center gap-1 md:gap-2 animate-pulse"><span class="text-xs md:text-base">🏐</span><span class="text-xs md:text-sm font-bold ${isHome ? 'text-blue-400' : 'text-red-400'} uppercase tracking-wide">SACA ${isHome ? this.homeTeamName : this.awayTeamName}</span></div>`;
                bc.classList.remove('hidden');
            }
            
            setupEventListeners() {
    document.getElementById('offlineModeBtn')?.addEventListener('click', () => this.mostrarFeedbackPartido('📡 Modo offline activado - Usando datos cacheados'));
    document.getElementById('saveHTMLBtn')?.addEventListener('click', () => this.saveAsHTML());
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadData());
    document.getElementById('soundToggleBtn')?.addEventListener('click', () => { 
        const enabled = this.soundManager.toggle(); 
        document.getElementById('soundToggleBtn').innerHTML = enabled ? '🔊 Sonidos ON' : '🔇 Sonidos OFF'; 
        if (enabled && this.soundManager.audioContext) this.soundManager.audioContext.resume(); 
    });
    
    // ✅ MENÚ HAMBURGUESA - CÓDIGO CORREGIDO
    const menuBtn = document.getElementById('menuHamburguesaBtn');
    const menuDesplegable = document.getElementById('menuDesplegable');
    
    if (menuBtn && menuDesplegable) {
        // Quitar event listeners anteriores si existen
        const newMenuBtn = menuBtn.cloneNode(true);
        menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
        
        newMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔄 Menú hamburguesa clickeado');
            
            // Toggle clase 'hidden' y 'show'
            if (menuDesplegable.classList.contains('hidden')) {
                menuDesplegable.classList.remove('hidden');
                menuDesplegable.classList.add('show');
                // También agregar clase para animación
                menuDesplegable.style.display = 'flex';
            } else {
                menuDesplegable.classList.add('hidden');
                menuDesplegable.classList.remove('show');
                menuDesplegable.style.display = 'none';
            }
        });
        
        // Cerrar menú si se clickea fuera
        document.addEventListener('click', (e) => {
            if (!newMenuBtn.contains(e.target) && !menuDesplegable.contains(e.target)) {
                menuDesplegable.classList.add('hidden');
                menuDesplegable.classList.remove('show');
                menuDesplegable.style.display = 'none';
            }
        });
    }
    
    // ✅ Botones móviles
    const saveHTMLBtnMobile = document.getElementById('saveHTMLBtnMobile');
    if (saveHTMLBtnMobile) {
        saveHTMLBtnMobile.addEventListener('click', () => {
            this.saveAsHTML();
            // Cerrar menú después de guardar
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
            // Sincronizar con botón desktop
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
            this.mostrarFeedbackPartido(`⏱️ Refresco cada ${ms/1000} segundos`);
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
                else if (s < 3600) c.textContent = `Último punto: hace ${Math.floor(s/60)}m ${s%60}s`;
                else c.textContent = `Último punto: hace ${Math.floor(s/3600)}h`;
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
                const bg = localStorage.getItem(`breaks_${this.matchId}`);
                let breaks = bg ? JSON.parse(bg) : [];
                if (!breaks.length) { c.innerHTML = '<div class="text-center text-gray-400 py-4">No se detectaron rompes</div>'; return; }
                c.innerHTML = breaks.slice(-12).reverse().map(b => `<div class="flex justify-between items-center p-2 rounded-lg ${b.equipo === 'LOCAL' ? 'bg-primary/10' : 'bg-rose-500/10'} mb-1"><span class="text-xs font-bold text-primary">${b.tipo?.toUpperCase() || 'BREAK'}</span><span class="text-sm font-semibold ${b.equipo === 'LOCAL' ? 'text-primary' : 'text-rose-400'}">⚡ ${b.equipo === 'LOCAL' ? this.homeTeamName : this.awayTeamName}</span><span class="text-xs bg-dark px-2 py-0.5 rounded-full">${b.marcador}</span></div>`).join('');
            }
            
            updateInsightsList(homeEfficiency, homeBreaks) {
                const c = document.getElementById('insightsList');
                if (!c) return;
                const i = [];
                if (homeEfficiency > 55) i.push(`📈 ${this.homeTeamName} dominó ${homeEfficiency}% de los puntos del partido`);
                else if (homeEfficiency > 45 && homeEfficiency < 55) i.push(`⚖️ Partido parejo - ${this.homeTeamName} tiene ${homeEfficiency}% de eficiencia`);
                else if (homeEfficiency > 0 && homeEfficiency < 45) i.push(`⚠️ ${this.homeTeamName} necesita mejorar la eficiencia (${homeEfficiency}%)`);
                if (homeBreaks > 10) i.push(`⚡ ${this.homeTeamName} fue efectivo en rompes: ${homeBreaks} conversiones`);
                if (this.puntosJugadores?.length) {
                    const pl = this.puntosJugadores.filter(p => p.equipo === 'LOCAL').length;
                    const pv = this.puntosJugadores.filter(p => p.equipo === 'VISITANTE').length;
                    if (pl + pv > 0) i.push(`📊 Puntos anotados manualmente: ${pl} - ${pv}`);
                }
                c.innerHTML = i.length ? i.map(x => `<div class="bg-dark/50 rounded-lg p-3 border-l-4 border-primary text-sm">${x}</div>`).join('') : '<div class="text-gray-400 text-center py-4">Esperando más datos...</div>';
            }
            
            updateInterpretations(homeEff, awayEff, maxHomeRun, maxAwayRun, homeBreaks, awayBreaks, homeClutchPct, phaseHomeEff) {
                const c = document.getElementById('metricInterpretations');
                if (!c) return;
                const i = [];
                const effH = homeEff || 0, maxAR = maxAwayRun || 0, maxHR = maxHomeRun || 0, brH = homeBreaks || 0, brA = awayBreaks || 0, clutch = homeClutchPct || 0;
                if (effH > 55) i.push(`📊 EFICIENCIA (${effH}%) → ${this.homeTeamName} dominó el partido.`);
                else if (effH < 45 && effH > 0) i.push(`⚠️ EFICIENCIA (${effH}%) → ${this.awayTeamName} dominó el partido.`);
                else if (effH > 0) i.push(`⚖️ EFICIENCIA (${effH}%) → Partido parejo entre ${this.homeTeamName} y ${this.awayTeamName}.`);
                if (maxAR > 5) i.push(`🔥 RACHA RIVAL (${maxAR} pts) → ${this.awayTeamName} tuvo una racha larga. Revisar recepción.`);
                if (maxHR > 5) i.push(`💪 RACHA PROPIA (${maxHR} pts) → ${this.homeTeamName} encadenó puntos seguidos. Analizar qué funcionó.`);
                if (brH > brA + 5) i.push(`💪 ROMPS (${brH} vs ${brA}) → ${this.homeTeamName} fue muy efectivo rompiendo el saque.`);
                else if (brA > brH + 5) i.push(`⚠️ ROMPS (${brH} vs ${brA}) → ${this.awayTeamName} rompió el saque muchas veces. Mejorar servicio.`);
                if (clutch > 60) i.push(`🏆 BAJO PRESIÓN (${clutch}%) → ${this.homeTeamName} demostró excelente temple en momentos críticos.`);
                else if (clutch < 35 && clutch > 0) i.push(`⚠️ BAJO PRESIÓN (${clutch}%) → ${this.homeTeamName} mostró debilidad en momentos clave. Trabajar presión.`);
                c.innerHTML = i.length ? i.map(x => `<div class="bg-dark/50 rounded-lg p-2 mb-1 text-sm border-l-4 border-primary">${x}</div>`).join('') : '<div class="text-gray-400 text-center py-4">Esperando datos del partido...</div>';
            }
            
            updateRecommendations(homeEff, awayEff, maxHomeRun, maxAwayRun, homeBreaks, awayBreaks, homeClutchPct, phaseHomeEff) {
                const c = document.getElementById('actionableRecommendations');
                if (!c) return;
                const r = [];
                const effH = homeEff || 0, maxAR = maxAwayRun || 0, brA = awayBreaks || 0, brH = homeBreaks || 0, clutch = homeClutchPct || 0, late = phaseHomeEff?.late || 0;
                if (effH < 45 && effH > 0) r.push(`📌 Mejorar eficiencia en ataque - ${this.homeTeamName} solo ganó el ${effH}% de los puntos`);
                if (maxAR > 5) r.push(`📌 ${this.awayTeamName} tuvo una racha de ${maxAR} puntos consecutivos. Ajustar el bloqueo y la recepción.`);
                if (brA > brH + 5) r.push(`📌 ${this.awayTeamName} rompió el saque ${brA} veces. Variar la zona de saque y la velocidad.`);
                if (clutch < 40 && clutch > 0) r.push(`📌 Entrenar situaciones de presión: ${this.homeTeamName} solo convirtió ${clutch}% en momentos críticos.`);
                if (late < 40 && late > 0) r.push(`📌 Débil en el cierre (${late}% en Late Game). ${this.homeTeamName} debe trabajar la definición de sets.`);
                if (!r.length && effH > 0) r.push(effH > 50 ? `🏆 Buen partido de ${this.homeTeamName}! Mantener la estrategia para los próximos encuentros.` : `💪 Sigue así! Con más práctica los resultados van a llegar.`);
                c.innerHTML = r.length ? r.map(rec => `<div class="bg-primary/10 rounded-lg p-2 mb-1 text-sm border-l-4 border-primary">${rec}</div>`).join('') : '<div class="text-gray-400 text-center py-4">Esperando datos del partido...</div>';
            }
            
            updateSetDominance() {
                const sets = new Map();
                this.data.forEach(s => { if (!sets.has(s.set)) sets.set(s.set, { home: 0, away: 0 }); const sd = sets.get(s.set); sd.home = s.homeScore; sd.away = s.awayScore; });
                const c = document.getElementById('setDominance');
                if (!c) return;
                c.innerHTML = '';
                for (const [num, sc] of sets) {
                    const total = sc.home + sc.away;
                    const hp = total ? (sc.home / total * 100) : 0;
                    const ap = total ? (sc.away / total * 100) : 0;
                    c.innerHTML += `<div class="bg-dark rounded-lg p-3 mb-2"><div class="flex justify-between mb-1"><span class="text-primary font-semibold">Set ${num}</span><span class="text-sm">${sc.home}-${sc.away}</span></div><div class="flex h-6 rounded overflow-hidden"><div class="bg-gradient-to-r from-primary to-secondary h-full flex items-center justify-center text-xs font-bold text-white" style="width: ${hp}%">${hp > 15 ? Math.round(hp) + '%' : ''}</div><div class="bg-gradient-to-r from-rose-400 to-rose-500 h-full flex items-center justify-center text-xs font-bold text-white" style="width: ${ap}%">${ap > 15 ? Math.round(ap) + '%' : ''}</div></div></div>`;
                }
            }
            
            updateTimeline() {
                const c = document.getElementById('timeline');
                if (!c) return;
                const l10 = this.data.slice(-10).filter(s => s.scorer);
                if (l10.length >= 5) {
                    const h10 = l10.filter(s => s.scorer === 'HOME').length;
                    const a10 = l10.filter(s => s.scorer === 'AWAY').length;
                    let em = '', txt = '';
                    if (h10 > a10 + 2) { em = '🔥'; txt = `${this.homeTeamName} dominó el cierre`; }
                    else if (a10 > h10 + 2) { em = '⚡'; txt = `${this.awayTeamName} dominó el cierre`; }
                    else { em = '⚖️'; txt = 'Cierre parejo'; }
                    c.innerHTML = `<div class="text-center p-3"><div class="text-sm font-semibold mb-2 text-gray-400">ÚLTIMOS 10 PUNTOS</div><div class="flex justify-center items-center gap-6"><div class="text-center"><div class="text-3xl font-bold text-primary">${h10}</div><div class="text-xs text-gray-500">${this.homeTeamName}</div></div><div class="text-2xl">${em}</div><div class="text-center"><div class="text-3xl font-bold text-rose-400">${a10}</div><div class="text-xs text-gray-500">${this.awayTeamName}</div></div></div><div class="text-xs text-gray-500 mt-2">${txt}</div></div>`;
                } else { c.innerHTML = '<div class="text-center text-gray-400 py-8">Esperando más datos...</div>'; }
            }
            
            updateDashboard() {
                if (!this.data?.length) return;
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
                const breaks = this.data.filter(s => s.event && (s.event === 'BREAK_HOME' || s.event === 'BREAK_AWAY'));
                const homeBreaks = breaks.filter(b => b.event === 'BREAK_HOME').length;
                const awayBreaks = breaks.filter(b => b.event === 'BREAK_AWAY').length;
                const homeEfficiency = total ? ((homePoints / total) * 100).toFixed(1) : 0;
                const awayEfficiency = total ? ((awayPoints / total) * 100).toFixed(1) : 0;
                
                const phases = { EARLY: { home: 0, away: 0, total: 0 }, MID: { home: 0, away: 0, total: 0 }, LATE: { home: 0, away: 0, total: 0 } };
                this.data.forEach(s => { if (s.scorer && phases[s.phase]) { phases[s.phase][s.scorer === 'HOME' ? 'home' : 'away']++; phases[s.phase].total++; } });
                
                const clutchPoints = this.data.filter(s => { const isSetPoint = (s.homeScore >= 24 && s.homeScore > s.awayScore) || (s.awayScore >= 24 && s.awayScore > s.homeScore); const isCloseGame = Math.abs(s.lead) <= 2; return (isSetPoint || isCloseGame) && s.scorer; });
                const homeClutch = clutchPoints.filter(c => c.scorer === 'HOME').length;
                const totalClutch = clutchPoints.length;
                const homeClutchPct = totalClutch ? ((homeClutch / totalClutch) * 100).toFixed(1) : 0;
                
                let sl=0, sv=0, sol=0, sov=0, bpl=0, bpv=0;
                for (const p of this.data) { if (p.scorer && p.serving) { if (p.serving === 'HOME') { sl++; if (p.scorer === 'HOME') sol++; else bpv++; } else if (p.serving === 'AWAY') { sv++; if (p.scorer === 'AWAY') sov++; else bpl++; } } }
                const solPct = sl ? (sol / sl * 100).toFixed(1) : 0;
                const sovPct = sv ? (sov / sv * 100).toFixed(1) : 0;
                const bplPct = sv ? (bpl / sv * 100).toFixed(1) : 0;
                const bpvPct = sl ? (bpv / sl * 100).toFixed(1) : 0;
                
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
                    if (bar) { bar.style.width = `${solPct}%`; bar.textContent = `${solPct}%`; }
                }
                const bel = document.getElementById('breakpointLocalLabel');
                if (bel) {
                    bel.textContent = `${bplPct}%`;
                    document.getElementById('breakpointVisitanteLabel').textContent = `${bpvPct}%`;
                    const bar = document.getElementById('breakpointBarLocal');
                    if (bar) { bar.style.width = `${bplPct}%`; bar.textContent = `${bplPct}%`; }
                }
                
                if (totalClutch > 0) { const hw = (homeClutch / totalClutch) * 100; const hb = document.getElementById('clutchBarHome'); const ab = document.getElementById('clutchBarAway'); if (hb) hb.style.width = `${hw}%`; if (ab) ab.style.width = `${100 - hw}%`; }
                if (last?.serving) this.actualizarBadgeSaque(last.serving);
                this.updateCharts();
                this.updateSetDominance();
                this.updateBreakPointsList();
                this.updateTimeline();
                this.updateInsightsList(homeEfficiency, homeBreaks);
                this.actualizarEstadisticasServicio();
                this.actualizarHoraUltimoPunto();
                
                const phaseHomeEff = { early: phases.EARLY.total ? ((phases.EARLY.home / phases.EARLY.total) * 100).toFixed(1) : 0, mid: phases.MID.total ? ((phases.MID.home / phases.MID.total) * 100).toFixed(1) : 0, late: phases.LATE.total ? ((phases.LATE.home / phases.LATE.total) * 100).toFixed(1) : 0 };
                this.updateInterpretations(homeEfficiency, awayEfficiency, maxHomeRun, maxAwayRun, homeBreaks, awayBreaks, homeClutchPct, phaseHomeEff);
                this.updateRecommendations(homeEfficiency, awayEfficiency, maxHomeRun, maxAwayRun, homeBreaks, awayBreaks, homeClutchPct, phaseHomeEff);
                
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
            
            updateCharts() {
                if (!this.data) return;
                const sc = document.getElementById('scoreEvolutionChart');
                if (sc) {
                    if (this.charts.score) this.charts.score.destroy();
                    this.charts.score = new Chart(sc, { type: 'line', data: { labels: this.data.map((_,i)=>i+1), datasets: [{ label: this.homeTeamName, data: this.data.map(s=>s.homeScore), borderColor: '#667eea', backgroundColor: 'rgba(102,126,234,0.1)', borderWidth: 2, fill: true, pointRadius: 1 }, { label: this.awayTeamName, data: this.data.map(s=>s.awayScore), borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)', borderWidth: 2, fill: true, pointRadius: 1 }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { ticks: { color: '#9ca3af' } }, x: { ticks: { color: '#9ca3af' } } } } });
                }
                const rc = document.getElementById('runsHeatmap');
                if (rc) {
                    if (this.charts.runs) this.charts.runs.destroy();
                    this.charts.runs = new Chart(rc, { type: 'line', data: { labels: this.data.map((_,i)=>i+1), datasets: [{ label: 'Racha LOCAL', data: this.data.map(s=>s.homeRun), borderColor: '#667eea', backgroundColor: 'rgba(102,126,234,0.2)', borderWidth: 2, fill: true, pointRadius: 0 }, { label: 'Racha VISITANTE', data: this.data.map(s=>s.awayRun), borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.2)', borderWidth: 2, fill: true, pointRadius: 0 }] }, options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { ticks: { color: '#9ca3af' } }, x: { ticks: { color: '#9ca3af' } } } } });
                }
                const pc = document.getElementById('phaseEfficiencyChart');
                if (pc) {
                    if (this.charts.phase) this.charts.phase.destroy();
                    const ph = { EARLY: { home:0, away:0, total:0 }, MID: { home:0, away:0, total:0 }, LATE: { home:0, away:0, total:0 } };
                    this.data.forEach(s => { if (s.scorer && ph[s.phase]) { ph[s.phase][s.scorer==='HOME'?'home':'away']++; ph[s.phase].total++; } });
                    const he = [ ph.EARLY.total ? ((ph.EARLY.home/ph.EARLY.total)*100).toFixed(1) : 0, ph.MID.total ? ((ph.MID.home/ph.MID.total)*100).toFixed(1) : 0, ph.LATE.total ? ((ph.LATE.home/ph.LATE.total)*100).toFixed(1) : 0 ];
                    const ae = [ ph.EARLY.total ? ((ph.EARLY.away/ph.EARLY.total)*100).toFixed(1) : 0, ph.MID.total ? ((ph.MID.away/ph.MID.total)*100).toFixed(1) : 0, ph.LATE.total ? ((ph.LATE.away/ph.LATE.total)*100).toFixed(1) : 0 ];
                    this.charts.phase = new Chart(pc, { type: 'bar', data: { labels: ['Early (1-10)','Mid (11-20)','Late (21+)'], datasets: [{ label: this.homeTeamName, data: he, backgroundColor: '#667eea', borderRadius: 4 }, { label: this.awayTeamName, data: ae, backgroundColor: '#f43f5e', borderRadius: 4 }] }, options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { ticks: { color: '#9ca3af', callback: v => v + '%' }, max: 100 }, x: { ticks: { color: '#9ca3af' } } } } });
                }
                const mc = document.getElementById('momentumChart');
                if (mc && this.data.length > 10) {
                    if (this.charts.momentum) this.charts.momentum.destroy();
                    const mom = [];
                    for (let i=9; i<this.data.length; i++) { const w = this.data.slice(i-9,i+1); mom.push(w.filter(w=>w.scorer==='HOME').length - w.filter(w=>w.scorer==='AWAY').length); }
                    this.charts.momentum = new Chart(mc, { type: 'bar', data: { labels: Array.from({ length: mom.length }, (_,i)=>i+10), datasets: [{ label: 'Momentum', data: mom, backgroundColor: mom.map(m=>m>=0?'#667eea':'#f43f5e') }] }, options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { ticks: { color: '#9ca3af' } }, x: { ticks: { color: '#9ca3af' } } } } });
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
        
        let scoreChartImage = '', momentumChartImage = '', runsChartImage = '', phaseChartImage = '';
        
        const scoreCanvas = document.getElementById('scoreEvolutionChart');
        if (scoreCanvas) { try { scoreChartImage = scoreCanvas.toDataURL('image/png'); } catch(e) {} }
        
        const momentumCanvas = document.getElementById('momentumChart');
        if (momentumCanvas) { try { momentumChartImage = momentumCanvas.toDataURL('image/png'); } catch(e) {} }
        
        const runsCanvas = document.getElementById('runsHeatmap');
        if (runsCanvas) { try { runsChartImage = runsCanvas.toDataURL('image/png'); } catch(e) {} }
        
        const phaseCanvas = document.getElementById('phaseEfficiencyChart');
        if (phaseCanvas) { try { phaseChartImage = phaseCanvas.toDataURL('image/png'); } catch(e) {} }
        
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
        const breaks = this.data ? this.data.filter(s => s.event && s.event.includes('BREAK')) : [];
        const homeBreaks = breaks.filter(b => b.event === 'BREAK_HOME').length;
        const awayBreaks = breaks.filter(b => b.event === 'BREAK_AWAY').length;
        
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
            this.data.forEach(s => { if (s.scorer && phases[s.phase]) { phases[s.phase][s.scorer === 'HOME' ? 'home' : 'away']++; phases[s.phase].total++; } });
        }
        
        const homePhaseEff = {
            early: phases.EARLY.total ? (phases.EARLY.home / phases.EARLY.total * 100).toFixed(1) : 0,
            mid: phases.MID.total ? (phases.MID.home / phases.MID.total * 100).toFixed(1) : 0,
            late: phases.LATE.total ? (phases.LATE.home / phases.LATE.total * 100).toFixed(1) : 0
        };
        
        const sets = new Map();
        if (this.data) {
            this.data.forEach(s => { if (!sets.has(s.set)) sets.set(s.set, { home: 0, away: 0 }); const setData = sets.get(s.set); setData.home = s.homeScore; setData.away = s.awayScore; });
        }
        let setsHtml = '';
        for (const [num, scores] of sets) {
            const winner = scores.home > scores.away ? homeTeam : awayTeam;
            const isFinished = (scores.home >= 25 || scores.away >= 25) && Math.abs(scores.home - scores.away) >= 2;
            const bgColor = !isFinished ? 'background: linear-gradient(135deg, #1a1f2e, #0f1119); border: 2px solid #667eea;' : 'background: linear-gradient(135deg, #1a1f2e, #0f1119); border: 1px solid rgba(102,126,234,0.3);';
            setsHtml += `<div style="${bgColor} border-radius: 12px; padding: 15px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: #667eea; margin-bottom: 8px;">SET ${num}</div>
                <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;"><span style="color: #3b82f6;">${scores.home}</span><span style="color: #6b7280;"> - </span><span style="color: #ef4444;">${scores.away}</span></div>
                <div style="font-size: 12px; color: #10b981;">🏆 ${winner}</div>
            </div>`;
        }
        
        // ============================================
        // GENERACIÓN DE TABLAS - CON FALLBACK A NOMBRES GENÉRICOS
        // ============================================
        let tablaLocal = '';
        let tablaVisitante = '';
        
        // Variables para stats (declaradas afuera para usar después)
        let statsLocalCalculadas = null;
        let statsVisitanteCalculadas = null;
        
        // FORZAR CARGA DIRECTA desde localStorage
        const puntosKey = `puntos_${this.matchId}`;
        const puntosGuardados = localStorage.getItem(puntosKey);
        let puntosJugadoresRaw = null;
        
        if (puntosGuardados) {
            puntosJugadoresRaw = JSON.parse(puntosGuardados);
            console.log('✅ Puntos cargados desde localStorage:', puntosJugadoresRaw.length);
        } else {
            console.log('❌ No se encontraron puntos en localStorage para matchId:', this.matchId, puntosKey);
        }
        
        // También intentar cargar desde this.puntosJugadores
        if ((!puntosJugadoresRaw || puntosJugadoresRaw.length === 0) && this.puntosJugadores && this.puntosJugadores.length > 0) {
            puntosJugadoresRaw = this.puntosJugadores;
            console.log('📦 Usando this.puntosJugadores:', puntosJugadoresRaw.length);
        }
        
        if (puntosJugadoresRaw && puntosJugadoresRaw.length > 0) {
            console.log('🔍 Primer punto ejemplo:', puntosJugadoresRaw[0]);
            
            // Función para calcular stats manualmente
            const calcularStatsManual = (datos, equipo) => {
                const stats = {};
                for (const punto of datos) {
                    if (punto.equipo !== equipo) continue;
                    const jugador = punto.jugador;
                    if (!stats[jugador]) {
                        stats[jugador] = { 
                            puntos: 0, 
                            ataques: 0, 
                            ataquesConvertidos: 0,
                            bloqueos: 0, 
                            aces: 0, 
                            erroresAtaque: 0, 
                            asistencias: 0, 
                            acesServicio: 0, 
                            erroresServicio: 0, 
                            totalSaques: 0,
                            puntosPorErrorRival: 0
                        };
                    }
                    
                    const s = stats[jugador];
                    
                    switch(punto.accion) {
                        case 'ATAQUE':
                            s.ataques++;
                            s.ataquesConvertidos++;
                            s.puntos++;
                            break;
                        case 'BLOQUEO':
                            s.bloqueos++;
                            s.puntos++;
                            break;
                        case 'ACE':
                            s.aces++;
                            s.acesServicio++;
                            s.totalSaques++;
                            s.puntos++;
                            break;
                        case 'ERROR_RIVAL':
                            s.puntosPorErrorRival++;
                            s.puntos++;
                            break;
                        case 'ERROR':
                            s.erroresAtaque++;
                            s.erroresServicio++;
                            s.totalSaques++;
                            break;
                    }
                    
                    if (punto.asistencia) {
                        if (!stats[punto.asistencia]) {
                            stats[punto.asistencia] = { 
                                puntos: 0, ataques: 0, ataquesConvertidos: 0, bloqueos: 0, 
                                aces: 0, erroresAtaque: 0, asistencias: 0, acesServicio: 0, 
                                erroresServicio: 0, totalSaques: 0, puntosPorErrorRival: 0
                            };
                        }
                        stats[punto.asistencia].asistencias++;
                    }
                }
                
                for (const jugador in stats) {
                    const s = stats[jugador];
                    
                    s.ataques = s.ataques || 0;
                    s.ataquesConvertidos = s.ataquesConvertidos || 0;
                    s.bloqueos = s.bloqueos || 0;
                    s.aces = s.aces || 0;
                    s.erroresAtaque = s.erroresAtaque || 0;
                    s.asistencias = s.asistencias || 0;
                    s.acesServicio = s.acesServicio || 0;
                    s.erroresServicio = s.erroresServicio || 0;
                    s.totalSaques = s.totalSaques || 0;
                    s.puntosPorErrorRival = s.puntosPorErrorRival || 0;
                    
                    if (s.ataques > 0) {
                        s.eficienciaAtaque = ((s.ataquesConvertidos / s.ataques) * 100).toFixed(1);
                    } else {
                        s.eficienciaAtaque = '0';
                    }
                    
                    if (s.totalSaques > 0) {
                        s.eficienciaServicio = ((s.acesServicio - s.erroresServicio) / s.totalSaques * 100).toFixed(1);
                    } else {
                        s.eficienciaServicio = '0';
                    }
                    
                    s.puntos = (s.ataquesConvertidos || 0) + (s.bloqueos || 0) + (s.aces || 0) + (s.puntosPorErrorRival || 0);
                }
                
                return stats;
            };
            
            statsLocalCalculadas = calcularStatsManual(puntosJugadoresRaw, 'LOCAL');
            statsVisitanteCalculadas = calcularStatsManual(puntosJugadoresRaw, 'VISITANTE');
            
            console.log('Stats LOCAL calculadas:', statsLocalCalculadas);
            console.log('Stats VISITANTE calculadas:', statsVisitanteCalculadas);
            
            // Función para generar tabla HTML con FALLBACK a nombres genéricos
            const generarTablaHTML = (stats, jugadoresMap, nombreEquipo, esVisitante) => {
                if (!stats || Object.keys(stats).length === 0) {
                    return `<tr><td colspan="13" style="text-align:center;padding:40px;">Sin datos para ${nombreEquipo}</td></tr>`;
                }
                
                let html = '';
                const ordenados = Object.entries(stats).sort((a, b) => b[1].puntos - a[1].puntos);
                
                for (const [numJugador, s] of ordenados) {
                    const num = parseInt(numJugador);
                    if (isNaN(num)) continue;
                    
                    // FALLBACK: Si no hay nombre en jugadoresMap, usar "Visitante X" o "Local X" según el equipo
                    let nombre = jugadoresMap[num];
                    if (!nombre) {
                        nombre = esVisitante ? `Visitante ${num}` : `Local ${num}`;
                    }
                    
                    const puntos = s.puntos || 0;
                    const ataquesTotales = s.ataques || 0;
                    const ataquesConvertidos = s.ataquesConvertidos || 0;
                    const bloqueos = s.bloqueos || 0;
                    const aces = s.aces || 0;
                    const erroresAtaque = s.erroresAtaque || 0;
                    const asistencias = s.asistencias || 0;
                    const acesServicio = s.acesServicio || 0;
                    const erroresServicio = s.erroresServicio || 0;
                    const totalSaques = s.totalSaques || 0;
                    
                    const ataquesTexto = ataquesTotales > 0 ? `${ataquesConvertidos}/${ataquesTotales}` : '0/0';
                    
                    let eficienciaAtaque = '0';
                    if (ataquesTotales > 0) {
                        eficienciaAtaque = ((ataquesConvertidos / ataquesTotales) * 100).toFixed(1);
                    }
                    
                    let eficienciaServicio = '0';
                    if (totalSaques > 0) {
                        eficienciaServicio = ((acesServicio - erroresServicio) / totalSaques * 100).toFixed(1);
                    }
                    
                    const efAtaqueNum = parseFloat(eficienciaAtaque);
                    const efAtaqueColor = efAtaqueNum > 50 ? '#10b981' : (efAtaqueNum > 25 ? '#f59e0b' : '#ef4444');
                    
                    const efServNum = parseFloat(eficienciaServicio);
                    const efServColor = efServNum > 10 ? '#10b981' : (efServNum < 0 ? '#ef4444' : '#f59e0b');
                    
                    html += `<tr style="border-bottom:1px solid #374151;">
                        <td style="padding:12px;font-weight:500;">${nombre} <span style="color:#6b7280;">(${num})</span></td>
                        <td style="text-align:center;font-weight:bold;color:#667eea;">${puntos}</td>
                        <td style="text-align:center;">${ataquesTexto}</td>
                        <td style="text-align:center;">${bloqueos}</td>
                        <td style="text-align:center;">${aces}</td>
                        <td style="text-align:center;color:#ef4444;">${erroresAtaque}</td>
                        <td style="text-align:center;">${asistencias}</td>
                        <td style="text-align:center;font-weight:bold;color:${efAtaqueColor};">${eficienciaAtaque}%</td>
                        <td style="text-align:center;color:#3b82f6;">${acesServicio}</td>
                        <td style="text-align:center;color:#ef4444;">${erroresServicio}</td>
                        <td style="text-align:center;font-weight:bold;color:${efServColor};">${eficienciaServicio}%</td>
                        <td style="text-align:center;font-weight:bold;">${totalSaques}</td>
                    </tr>`;
                }
                
                return html;
            };
            
            tablaLocal = generarTablaHTML(statsLocalCalculadas, this.jugadoresLocal, homeTeam, false);
            tablaVisitante = generarTablaHTML(statsVisitanteCalculadas, this.jugadoresVisitante, awayTeam, true);
            
            console.log('✅ tablas generadas - Local longitud:', tablaLocal.length, 'Visitante longitud:', tablaVisitante.length);
            
        } else {
            console.log('⚠️ No hay puntos para generar tablas individuales');
            const noDataMsg = '<tr><td colspan="13" style="text-align:center;padding:40px;">No hay puntos registrados para este partido</td></tr>';
            tablaLocal = noDataMsg;
            tablaVisitante = noDataMsg;
        }
        
        let breakPointsHtml = '';
        const breaksGuardados = localStorage.getItem(`breaks_${this.matchId}`);
        if (breaksGuardados) {
            const breaksList = JSON.parse(breaksGuardados);
            if (breaksList.length > 0) {
                breakPointsHtml = '<div style="max-height: 300px; overflow-y: auto;">' + breaksList.slice(-12).reverse().map(b => {
                    const isHome = b.equipo === 'LOCAL';
                    return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: ${isHome ? 'rgba(102,126,234,0.1)' : 'rgba(244,63,94,0.1)'}; border-radius: 10px; margin-bottom: 8px;">
                        <span style="font-size: 13px; font-weight: bold; color: #667eea;">${b.tipo?.toUpperCase() || 'BREAK'}</span>
                        <span style="font-size: 14px; font-weight: bold; color: ${isHome ? '#667eea' : '#f43f5e'};">⚡ ${isHome ? homeTeam : awayTeam}</span>
                        <span style="font-size: 13px; background: #1a1f2e; padding: 4px 12px; border-radius: 20px;">${b.marcador}</span>
                    </div>`;
                }).join('') + '</div>';
            }
        }
        if (!breakPointsHtml) breakPointsHtml = '<div style="text-align: center; padding: 30px; color: #6b7280;">No se detectaron rompes</div>';
        
        let timelineHtml = '';
        const last10points = this.data ? this.data.slice(-10).filter(s => s.scorer) : [];
        if (last10points.length >= 5) {
            const homeLast10 = last10points.filter(s => s.scorer === 'HOME').length;
            const awayLast10 = last10points.filter(s => s.scorer === 'AWAY').length;
            let emoji = '', text = '';
            if (homeLast10 > awayLast10 + 2) { emoji = '🔥'; text = `${homeTeam} dominó el cierre`; }
            else if (awayLast10 > homeLast10 + 2) { emoji = '⚡'; text = `${awayTeam} dominó el cierre`; }
            else { emoji = '⚖️'; text = 'Cierre parejo'; }
            timelineHtml = `<div style="text-align: center; padding: 20px;">
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 15px;">ÚLTIMOS 10 PUNTOS</div>
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
        if (homeBreaks > awayBreaks + 5) interpretationsHtml += `<div style="border-left: 3px solid #10b981; padding: 12px; margin-bottom: 10px;">💪 ROMPS (${homeBreaks} vs ${awayBreaks}) → ${homeTeam} fue muy efectivo rompiendo el saque.</div>`;
        else if (awayBreaks > homeBreaks + 5) interpretationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">⚠️ ROMPS (${homeBreaks} vs ${awayBreaks}) → ${awayTeam} rompió el saque muchas veces.</div>`;
        if (homeClutchPct > 60) interpretationsHtml += `<div style="border-left: 3px solid #10b981; padding: 12px; margin-bottom: 10px;">🏆 BAJO PRESIÓN (${homeClutchPct}%) → ${homeTeam} demostró temple.</div>`;
        else if (homeClutchPct < 35 && homeClutchPct > 0) interpretationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">⚠️ BAJO PRESIÓN (${homeClutchPct}%) → ${homeTeam} mostró debilidad.</div>`;
        
        let recommendationsHtml = '';
        if (homeEfficiency < 45) recommendationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">📌 Mejorar eficiencia en ataque - ${homeTeam} solo ganó el ${homeEfficiency}% de los puntos</div>`;
        if (maxAwayRun > 5) recommendationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">📌 ${awayTeam} tuvo una racha de ${maxAwayRun} puntos. Ajustar bloqueo y recepción.</div>`;
        if (awayBreaks > homeBreaks + 5) recommendationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">📌 ${awayTeam} rompió el saque ${awayBreaks} veces. Variar zona de saque.</div>`;
        if (homeClutchPct < 40 && homeClutchPct > 0) recommendationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">📌 Entrenar presión: ${homeTeam} solo convirtió ${homeClutchPct}% en momentos críticos.</div>`;
        if (homePhaseEff.late < 40 && homePhaseEff.late > 0) recommendationsHtml += `<div style="border-left: 3px solid #ef4444; padding: 12px; margin-bottom: 10px;">📌 Débil en el cierre (${homePhaseEff.late}% en Late Game). Trabajar definición.</div>`;
        if (!recommendationsHtml) recommendationsHtml = '<div style="border-left: 3px solid #10b981; padding: 12px;">🏆 Buen partido! Mantener la estrategia.</div>';
        
        // ============================================
        // CALCULAR EFICIENCIA POR SET (con fallback a datos manuales)
        // ============================================
        const eficienciaPorSet = [];
        const puntosPorSet = [];

        let datosParaEficiencia = null;
        if (this.data && this.data.length > 0 && this.data.some(p => p.scorer)) {
            datosParaEficiencia = this.data;
            console.log('📊 Usando datos del tracker para gráfico');
        } else if (this.puntosJugadores && this.puntosJugadores.length > 0) {
            datosParaEficiencia = this.puntosJugadores;
            console.log('📊 Usando puntos manuales para gráfico de eficiencia por set');
        }

        if (datosParaEficiencia && datosParaEficiencia.length > 0) {
            const setsUnicos = [...new Set(datosParaEficiencia.map(p => p.set || 1))].sort((a, b) => a - b);
            
            for (const setNum of setsUnicos) {
                const puntosSet = datosParaEficiencia.filter(p => (p.set || 1) === setNum);
                
                let localSet = 0, visitanteSet = 0;
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

        console.log('📊 eficienciaPorSet calculado:', eficienciaPorSet);

        // ============================================
        // CALCULAR STATS POR SET PARA FILTROS (usando las variables ya calculadas)
        // ============================================
        const localPorSet = {};
        const visitantePorSet = {};

        // Si tenemos stats calculadas, usarlas para "todos"
        if (statsLocalCalculadas && statsVisitanteCalculadas) {
            localPorSet['todos'] = tablaLocal;
            visitantePorSet['todos'] = tablaVisitante;
        }

        // Calcular stats por set individuales
        if (this.puntosJugadores && this.puntosJugadores.length > 0) {
            const setsUnicosPuntos = [...new Set(this.puntosJugadores.map(p => p.set))];
            
            for (const setNum of setsUnicosPuntos) {
                const puntosSet = this.puntosJugadores.filter(p => p.set === setNum);
                const statsLocalSet = calcularStatsPorJugador(puntosSet, 'LOCAL');
                const statsVisitanteSet = calcularStatsPorJugador(puntosSet, 'VISITANTE');
                
                localPorSet[setNum] = generarTablaHTMLSimple(statsLocalSet, this.jugadoresLocal);
visitantePorSet[setNum] = generarTablaHTMLSimple(statsVisitanteSet, this.jugadoresVisitante);            }
        }
        
        const datosReporte = {
            homeTeam, awayTeam, homeScore, awayScore, fechaHora: new Date().toLocaleString(),
            homeEfficiency, awayEfficiency, maxHomeRun, maxAwayRun, homeBreaks, awayBreaks,
            totalPoints: total, homeClutchPct, homePhaseEff, awayPhaseEff: { early: 0, mid: 0, late: 0 },
            setsHtml, scoreChartImage, momentumChartImage, runsChartImage, phaseChartImage,
            breakPointsHtml, timelineHtml, interpretationsHtml, recommendationsHtml,
            tablaLocal, tablaVisitante, eficienciaPorSet: eficienciaPorSet,
            puntosPorSet: puntosPorSet,
            localPorSet: localPorSet,
            visitantePorSet: visitantePorSet
        };
        
        const reportHtml = ReporteGenerator.generarHTML(datosReporte);
        const blob = new Blob([reportHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_${homeTeam}_vs_${awayTeam}_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.html`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.mostrarFeedbackPartido('📄 Reporte generado correctamente');
        
    } catch(e) {
        console.error('Error al guardar HTML:', e);
        this.mostrarFeedbackPartido('❌ Error al generar el reporte: ' + e.message);
    }
}

}