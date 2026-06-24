// dashboard/js/anotador.js
export class AnotadorManager {
    constructor() {
        this.config = { local: { jugadores: [], liberos: [] }, visitante: { jugadores: [], liberos: [] } };
        this.estado = {
            local: { score: 0, jugadoresLista: [] },
            visitante: { score: 0, jugadoresLista: [] },
            equipo: "LOCAL",
            accion: null,
            set: 1,
            punto: 0,
            historial: []
        };
        this.jugadorSeleccionado = null;
        this.equipoQueSaca = "LOCAL";
        this.matchIdActual = null;
        this.homeTeamName = "LOCAL";
        this.awayTeamName = "VISITANTE";
        this.puntosManuales = [];
        this.init();
    }

    async init() {
        await this.cargarConfiguracion();
        const configGuardada = localStorage.getItem(`config_${this.matchIdActual}`);
        if (configGuardada) {
            this.config = JSON.parse(configGuardada);
            this.renderConfig();
        }
        if ((!this.config.local.jugadores || this.config.local.jugadores.length === 0) && this.matchIdActual) {
            await this.cargarJugadoresDesdeAPI();
            this.renderConfig();
        }
        await this.cargarPuntosManuales();
        this.initKeyboardShortcuts();
        this.setupEventListeners();
    }

    async cargarConfiguracion() {
        try {
            const response = await fetch('/data/config.json');
            if (response.ok) {
                const configData = await response.json();
                this.matchIdActual = configData.matchId;
                this.homeTeamName = configData.homeTeam || "LOCAL";
                this.awayTeamName = configData.awayTeam || "VISITANTE";
                const localLabel = document.getElementById('localLabel');
                const visitanteLabel = document.getElementById('visitanteLabel');
                const btnLocal = document.getElementById('btnLocal');
                const btnVisitante = document.getElementById('btnVisitante');
                if (localLabel) localLabel.textContent = this.homeTeamName;
                if (visitanteLabel) visitanteLabel.textContent = this.awayTeamName;
                if (btnLocal) btnLocal.innerHTML = `🔵 ${this.homeTeamName}`;
                if (btnVisitante) btnVisitante.innerHTML = `🔴 ${this.awayTeamName}`;
                return this.matchIdActual;
            }
        } catch (e) {}
        return 257929;
    }

    async cargarPuntosManuales() {
        try {
            const apiUrl = await this.obtenerUrlApi();
            const response = await fetch(`${apiUrl}/api/puntos/${this.matchIdActual}`);
            if (response.ok) {
                const data = await response.json();
                this.puntosManuales = data.data || [];
                this.actualizarHistorialDesdePuntos();
            }
        } catch (e) {
            console.log('Error cargando puntos manuales:', e);
        }
    }

    async obtenerUrlApi() {
        try {
            const response = await fetch('/data/api_url.txt?_t=' + Date.now());
            if (response.ok) {
                let url = await response.text();
                url = url.trim();
                if (url && (url.startsWith('https') || url.startsWith('http'))) {
                    return url;
                }
            }
        } catch (e) {}
        return 'http://localhost:3002';
    }

    actualizarHistorialDesdePuntos() {
        if (this.puntosManuales.length > 0) {
            this.estado.historial = [...this.puntosManuales];
            this.estado.punto = this.puntosManuales.length;
            const ultimo = this.puntosManuales[this.puntosManuales.length - 1];
            if (ultimo) {
                const partes = ultimo.marcadorDespues.split('-');
                this.estado.local.score = parseInt(partes[0]) || 0;
                this.estado.visitante.score = parseInt(partes[1]) || 0;
                this.estado.set = ultimo.set || 1;
            }
            this.actualizarMarcador();
            this.renderHistorial();
        }
    }

    mostrarFeedback(msg, tipo = 'success') {
        let fb = document.getElementById('feedback');
        if (!fb) return;
        fb.innerText = msg;
        fb.classList.remove('hidden');
        const baseClass = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-sm font-bold z-50';
        if (tipo === 'success') fb.className = `${baseClass} bg-green-500 text-black`;
        else if (tipo === 'error') fb.className = `${baseClass} bg-red-500 text-white`;
        else if (tipo === 'info') fb.className = `${baseClass} bg-blue-500 text-white`;
        setTimeout(() => fb.classList.add('hidden'), 2000);
    }

    async guardarTimeout() {
        if (!this.estado.equipo) {
            this.mostrarFeedback('❌ Seleccioná un equipo primero', 'error');
            return;
        }
        const timeout = {
            id: `timeout_${Date.now()}`,
            timestamp: new Date().toISOString(),
            set: this.estado.set,
            equipo: this.estado.equipo,
            marcador: `${this.estado.local.score}-${this.estado.visitante.score}`
        };
        let timeoutsGuardados = JSON.parse(localStorage.getItem(`timeouts_${this.matchIdActual}`) || '[]');
        timeoutsGuardados.push(timeout);
        localStorage.setItem(`timeouts_${this.matchIdActual}`, JSON.stringify(timeoutsGuardados));
        this.mostrarFeedback(`⏸️ TIMEOUT registrado para ${this.estado.equipo === 'LOCAL' ? this.homeTeamName : this.awayTeamName} en Set ${this.estado.set} (${timeout.marcador})`, 'info');
    }

    guardarBreak() {
        if (!this.estado.equipo) {
            this.mostrarFeedback('❌ Seleccioná un equipo primero', 'error');
            return;
        }
        const breakPoint = {
            timestamp: new Date().toISOString(),
            set: this.estado.set,
            equipo: this.estado.equipo,
            tipo: 'break',
            marcador: `${this.estado.local.score}-${this.estado.visitante.score}`
        };
        let breaksGuardados = JSON.parse(localStorage.getItem(`breaks_${this.matchIdActual}`) || '[]');
        breaksGuardados.push(breakPoint);
        localStorage.setItem(`breaks_${this.matchIdActual}`, JSON.stringify(breaksGuardados));
        this.mostrarFeedback(`⚡ BREAK! ${this.estado.equipo === 'LOCAL' ? this.homeTeamName : this.awayTeamName} rompe el saque (${breakPoint.marcador})`, 'success');
    }

    renderConfig() {
        const render = (equipo, data, containerId, liberosContainerId) => {
            const container = document.getElementById(containerId);
            const liberosContainer = document.getElementById(liberosContainerId);
            if (container) {
                container.innerHTML = data.jugadores.map(n => `<button class="config-jugador bg-gray-700 w-12 h-12 rounded-xl font-bold" data-equipo="${equipo}" data-num="${n}">${n}</button>`).join('');
            }
            if (liberosContainer) {
                liberosContainer.innerHTML = data.jugadores.map(n => `<button class="config-libero ${data.liberos.includes(n) ? 'bg-yellow-500 text-black' : 'bg-gray-600'} px-3 py-1 rounded text-sm" data-equipo="${equipo}" data-num="${n}">${data.liberos.includes(n) ? '🛡️' : '[L]'}</button>`).join('');
            }
        };
        render('local', this.config.local, 'configLocal', 'configLocalLiberos');
        render('visitante', this.config.visitante, 'configVisitante', 'configVisitanteLiberos');
        document.querySelectorAll('.config-jugador').forEach(btn => {
            btn.onclick = () => {
                let eq = btn.dataset.equipo;
                let n = parseInt(btn.dataset.num);
                this.config[eq].jugadores = this.config[eq].jugadores.filter(x => x !== n);
                this.config[eq].liberos = this.config[eq].liberos.filter(x => x !== n);
                this.renderConfig();
                localStorage.setItem(`config_${this.matchIdActual}`, JSON.stringify(this.config));
            };
        });
        document.querySelectorAll('.config-libero').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                let eq = btn.dataset.equipo;
                let n = parseInt(btn.dataset.num);
                if (this.config[eq].liberos.includes(n)) {
                    this.config[eq].liberos = this.config[eq].liberos.filter(x => x !== n);
                } else {
                    this.config[eq].liberos.push(n);
                }
                this.renderConfig();
                localStorage.setItem(`config_${this.matchIdActual}`, JSON.stringify(this.config));
            };
        });
    }

    comenzarPartido() {
        this.estado.local.jugadoresLista = [...this.config.local.jugadores].sort((a, b) => a - b);
        this.estado.visitante.jugadoresLista = [...this.config.visitante.jugadores].sort((a, b) => a - b);
        this.estado.local.score = 0;
        this.estado.visitante.score = 0;
        this.estado.set = 1;
        this.estado.punto = 0;
        this.estado.historial = [];
        this.estado.accion = null;
        this.jugadorSeleccionado = null;
        this.equipoQueSaca = "LOCAL";
        this.puntosManuales = [];
        this.actualizarBadgeSaque();
        this.actualizarCancha();
        this.renderizarBanco();
        const selectorSet = document.getElementById('selectorSet');
        if (selectorSet) selectorSet.value = 1;
        const pantallaConfig = document.getElementById('pantallaConfig');
        const pantallaAnotacion = document.getElementById('pantallaAnotacion');
        if (pantallaConfig) pantallaConfig.classList.add('hidden');
        if (pantallaAnotacion) pantallaAnotacion.classList.remove('hidden');
        this.initAnotacion();
        localStorage.setItem(`config_${this.matchIdActual}`, JSON.stringify(this.config));
    }

    actualizarBadgeSaque() {
        const badge = document.getElementById('servingBadge');
        if (!badge) return;
        badge.innerHTML = `🏐 SACA ${this.equipoQueSaca === 'LOCAL' ? this.homeTeamName : this.awayTeamName}`;
        badge.style.background = this.equipoQueSaca === 'LOCAL' ? '#1e3a5f' : '#3b1e3f';
    }

    toggleSaque() {
        this.equipoQueSaca = this.equipoQueSaca === 'LOCAL' ? 'VISITANTE' : 'LOCAL';
        this.actualizarBadgeSaque();
    }

    actualizarCancha() {
        let jugadoresLista = this.estado.equipo === 'LOCAL' ? this.estado.local.jugadoresLista : this.estado.visitante.jugadoresLista;
        const primeros6 = jugadoresLista.slice(0, 6);
        const container = document.getElementById('canchaGrid');
        if (!container) return;
        container.innerHTML = primeros6.map(n => `
            <button class="jugador-btn py-3 rounded-xl bg-gray-700 font-bold text-xl ${this.jugadorSeleccionado === n ? 'seleccionado' : ''}" data-jugador="${n}">
                ${n}
            </button>
        `).join('');
        document.querySelectorAll('#canchaGrid .jugador-btn').forEach(b => {
            b.onclick = () => {
                const num = parseInt(b.dataset.jugador);
                this.jugadorSeleccionado = num;
                this.mostrarFeedback(`👕 Jugador ${this.jugadorSeleccionado} seleccionado`, 'info');
                this.actualizarCancha();
                this.renderizarBanco();
            };
        });
    }

    renderizarBanco() {
        let bancoEquipo, nombreEquipo, claseEquipo;
        if (this.estado.equipo === 'LOCAL') {
            bancoEquipo = this.estado.local.jugadoresLista.slice(6);
            nombreEquipo = this.homeTeamName;
            claseEquipo = 'local';
        } else {
            bancoEquipo = this.estado.visitante.jugadoresLista.slice(6);
            nombreEquipo = this.awayTeamName;
            claseEquipo = 'visitante';
        }
        const container = document.getElementById('bancoContainer');
        if (!container) return;
        if (bancoEquipo.length > 0) {
            let html = `<div class="banco-seccion">
                <div class="banco-header">
                    <span class="banco-equipo-nombre ${claseEquipo}">${this.estado.equipo === 'LOCAL' ? '🔵' : '🔴'} ${nombreEquipo}</span>
                    <span class="banco-badge">suplentes</span>
                </div>
                <div class="banco-grid">
            `;
            bancoEquipo.forEach(n => {
                html += `<button class="banco-item bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-bold ${this.jugadorSeleccionado === n ? 'seleccionado' : ''}" data-jugador="${n}">${n}</button>`;
            });
            html += `</div></div>`;
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="text-gray-500 text-center text-sm">Sin suplentes</div>';
        }
        document.querySelectorAll('#bancoContainer .banco-item').forEach(b => {
            b.onclick = () => {
                const num = parseInt(b.dataset.jugador);
                this.jugadorSeleccionado = num;
                this.mostrarFeedback(`👕 Suplente ${this.jugadorSeleccionado} seleccionado`, 'info');
                this.actualizarCancha();
                this.renderizarBanco();
            };
        });
    }

    actualizarMarcador() {
        const localScore = document.getElementById('localScore');
        const visitanteScore = document.getElementById('visitanteScore');
        const currentPoint = document.getElementById('currentPoint');
        const selectorSet = document.getElementById('selectorSet');
        if (localScore) localScore.innerText = this.estado.local.score;
        if (visitanteScore) visitanteScore.innerText = this.estado.visitante.score;
        if (currentPoint) currentPoint.innerText = this.estado.punto;
        if (selectorSet && selectorSet.value != this.estado.set) selectorSet.value = this.estado.set;
    }

    renderHistorial() {
        const container = document.getElementById('historial');
        if (!container) return;
        if (this.estado.historial.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-center">Esperando puntos...</div>';
            return;
        }
        container.innerHTML = this.estado.historial.slice().reverse().slice(0, 10).map(p => {
            let accionDisplay = p.accion === 'ERROR' ? '❌ ERROR' : (p.accion === 'ERROR_RIVAL' ? '❌ ERR RIVAL' : p.accion);
            let jugadorDisplay = p.jugador ? `J${p.jugador}` : 'RIVAL';
            return `<div class="flex justify-between py-1 border-b border-gray-700">
                <span class="text-${p.equipoAnota === 'LOCAL' ? 'blue' : 'red'}-400 font-bold">${p.equipoAnota === 'LOCAL' ? this.homeTeamName : this.awayTeamName}</span>
                <span>${jugadorDisplay}</span>
                <span class="text-gray-400">${accionDisplay}</span>
            </div>`;
        }).join('');
    }

    initAnotacion() {
        this.actualizarCancha();
        this.renderizarBanco();
        this.actualizarMarcador();
        const btnLocal = document.getElementById('btnLocal');
        if (btnLocal) btnLocal.click();
        const selectorSet = document.getElementById('selectorSet');
        if (selectorSet) {
            selectorSet.value = this.estado.set;
            selectorSet.onchange = () => {
                const nuevoSet = parseInt(selectorSet.value);
                if (nuevoSet !== this.estado.set) {
                    this.estado.local.score = 0;
                    this.estado.visitante.score = 0;
                    this.estado.punto = 0;
                    this.estado.set = nuevoSet;
                    this.actualizarMarcador();
                    this.mostrarFeedback(`📊 Cambiado a Set ${nuevoSet} - Marcador 0-0`, 'info');
                } else {
                    this.estado.set = nuevoSet;
                    this.actualizarMarcador();
                    this.mostrarFeedback(`📊 Set ${nuevoSet} seleccionado`, 'info');
                }
            };
        }
    }

    async cargarJugadoresDesdeAPI() {
        if (this.config.local.jugadores.length > 0 || this.config.visitante.jugadores.length > 0) return true;
        try {
            const response = await fetch(`/data/full_${this.matchIdActual}.json?_t=${Date.now()}`);
            if (response.ok) {
                const fullData = await response.json();
                const court = fullData.liveState?.court;
                if (court) {
                    const jugadoresLocal = [],
                        jugadoresVisitante = [],
                        liberosLocal = [],
                        liberosVisitante = [];
                    if (court.home?.positions) {
                        for (const [pos, info] of Object.entries(court.home.positions)) {
                            if (info.number && info.lastName) {
                                jugadoresLocal.push(info.number);
                                if (info.isLibero) liberosLocal.push(info.number);
                            }
                        }
                    }
                    if (court.home?.bench) {
                        for (const info of court.home.bench) {
                            if (info.number && info.lastName && !jugadoresLocal.includes(info.number)) {
                                jugadoresLocal.push(info.number);
                                if (info.isLibero) liberosLocal.push(info.number);
                            }
                        }
                    }
                    if (court.away?.positions) {
                        for (const [pos, info] of Object.entries(court.away.positions)) {
                            if (info.number && info.lastName) {
                                jugadoresVisitante.push(info.number);
                                if (info.isLibero) liberosVisitante.push(info.number);
                            }
                        }
                    }
                    if (court.away?.bench) {
                        for (const info of court.away.bench) {
                            if (info.number && info.lastName && !jugadoresVisitante.includes(info.number)) {
                                jugadoresVisitante.push(info.number);
                                if (info.isLibero) liberosVisitante.push(info.number);
                            }
                        }
                    }
                    if (jugadoresLocal.length) {
                        this.config.local.jugadores = jugadoresLocal.sort((a, b) => a - b);
                        this.config.local.liberos = liberosLocal;
                    }
                    if (jugadoresVisitante.length) {
                        this.config.visitante.jugadores = jugadoresVisitante.sort((a, b) => a - b);
                        this.config.visitante.liberos = liberosVisitante;
                    }
                    this.renderConfig();
                    return true;
                }
            }
        } catch (e) {
            console.log('Error cargando jugadores desde API:', e);
        }
        return false;
    }

    determinarEquipoQueAnota() {
        if (this.estado.accion === 'ERROR' || this.estado.accion === 'FALTA') {
            return this.estado.equipo === 'LOCAL' ? 'VISITANTE' : 'LOCAL';
        }
        return this.estado.equipo;
    }

    async guardarPunto() {
        if (!this.estado.accion) {
            this.mostrarFeedback('❌ Seleccioná una ACCIÓN', 'error');
            return;
        }
        if (!this.jugadorSeleccionado) {
            this.mostrarFeedback('❌ Seleccioná un JUGADOR', 'error');
            const canchaGrid = document.getElementById('canchaGrid');
            if (canchaGrid) {
                canchaGrid.classList.add('error-highlight');
                setTimeout(() => canchaGrid.classList.remove('error-highlight'), 500);
            }
            return;
        }
        const equipoQueAnota = this.determinarEquipoQueAnota();
        const jugadorQueAnota = this.jugadorSeleccionado;
        const marcadorAntes = `${this.estado.local.score}-${this.estado.visitante.score}`;
        if (equipoQueAnota === 'LOCAL') {
            this.estado.local.score++;
        } else {
            this.estado.visitante.score++;
        }
        const marcadorDespues = `${this.estado.local.score}-${this.estado.visitante.score}`;
        const punto = {
            timestamp: new Date().toISOString(),
            set: this.estado.set,
            punto: this.estado.punto + 1,
            equipo: this.estado.equipo,
            equipoAnota: equipoQueAnota,
            jugador: jugadorQueAnota,
            accion: this.estado.accion,
            asistencia: null,
            marcadorAntes: marcadorAntes,
            marcadorDespues: marcadorDespues
        };

        try {
            const apiUrl = await this.obtenerUrlApi();
            const response = await fetch(`${apiUrl}/api/puntos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId: this.matchIdActual, punto: punto })
            });
            if (!response.ok) throw new Error('Error al guardar el punto en el servidor');
            
            this.puntosManuales.push(punto);
            this.estado.punto++;
            this.estado.historial.push(punto);
            this.actualizarMarcador();
            this.renderHistorial();

            this.jugadorSeleccionado = null;
            this.estado.accion = null;
            document.querySelectorAll('#canchaGrid .jugador-btn, #bancoContainer .banco-item').forEach(btn => {
                btn.classList.remove('seleccionado');
            });
            this.toggleSaque();
            
            if (jugadorQueAnota) {
                this.mostrarFeedback(`✅ Punto de ${equipoQueAnota === 'LOCAL' ? this.homeTeamName : this.awayTeamName} - J${jugadorQueAnota}`, 'success');
            } else {
                this.mostrarFeedback(`✅ Punto para ${equipoQueAnota === 'LOCAL' ? this.homeTeamName : this.awayTeamName}`, 'success');
            }
        } catch (e) {
            console.error('Error guardando punto:', e);
            this.mostrarFeedback('❌ Error al guardar el punto en el servidor', 'error');
        }
    }

    deshacer() {
        if (!this.estado.historial.length) {
            this.mostrarFeedback('⚠️ No hay puntos para deshacer', 'error');
            return;
        }
        let ultimo = this.estado.historial.pop();
        if (ultimo.equipoAnota === 'LOCAL') {
            this.estado.local.score--;
            this.mostrarFeedback(`↩️ Deshecho: punto de ${this.homeTeamName}`, 'info');
        } else {
            this.estado.visitante.score--;
            this.mostrarFeedback(`↩️ Deshecho: punto de ${this.awayTeamName}`, 'info');
        }
        this.estado.punto--;
        this.actualizarMarcador();
        this.renderHistorial();
        document.querySelectorAll('#canchaGrid .jugador-btn, #bancoContainer .banco-item').forEach(btn => {
            btn.classList.remove('seleccionado');
        });
        this.jugadorSeleccionado = null;
    }

    navegarJugador(direccion) {
        const btns = document.querySelectorAll('#canchaGrid .jugador-btn, #bancoContainer .banco-item');
        if (btns.length === 0) return;
        let currentIndex = -1;
        for (let i = 0; i < btns.length; i++) {
            if (btns[i].classList.contains('seleccionado')) {
                currentIndex = i;
                break;
            }
        }
        if (direccion === 'next') currentIndex = (currentIndex + 1) % btns.length;
        else if (direccion === 'prev') currentIndex = (currentIndex - 1 + btns.length) % btns.length;
        if (currentIndex === -1) currentIndex = 0;
        btns[currentIndex].click();
    }

    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            const key = e.key.toLowerCase();
            if (key === 'q') { e.preventDefault();
                document.getElementById('btnLocal')?.click(); } else if (key === 'w') { e.preventDefault();
                document.getElementById('btnVisitante')?.click(); } else if (key === 'a') { e.preventDefault();
                document.querySelector('.accion-rapida-btn[data-accion="ATAQUE"]')?.click(); } else if (key === 's') { e.preventDefault();
                document.querySelector('.accion-rapida-btn[data-accion="BLOQUEO"]')?.click(); } else if (key === 'd') { e.preventDefault();
                document.querySelector('.accion-rapida-btn[data-accion="ACE"]')?.click(); } else if (key === 'f') { e.preventDefault();
                document.getElementById('btnErrorRival')?.click(); } else if (key === 'r') { e.preventDefault();
                document.querySelector('.accion-rapida-btn[data-accion="ERROR"]')?.click(); } else if (key === 'b') { e.preventDefault();
                this.guardarBreak(); } else if (key === 't') { e.preventDefault();
                this.guardarTimeout(); } else if (key === 'h') { e.preventDefault();
                document.querySelector('.accion-rapida-btn[data-accion="OTRO"]')?.click(); } else if (key === 'enter') { e.preventDefault();
                this.guardarPunto(); } else if (key === 'z') { e.preventDefault();
                this.deshacer(); } else if (/^[0-9]$/.test(key)) {
                e.preventDefault();
                const numero = parseInt(key);
                const btns = document.querySelectorAll('#canchaGrid .jugador-btn, #bancoContainer .banco-item');
                for (let btn of btns) {
                    if (parseInt(btn.dataset.jugador) === numero) { btn.click(); break; }
                }
            } else if (key === '+' || key === '=') { e.preventDefault();
                this.navegarJugador('next'); } else if (key === '-') { e.preventDefault();
                this.navegarJugador('prev'); }
        });
    }

    setupEventListeners() {
        const addLocal = document.getElementById('addLocal');
        const addVisitante = document.getElementById('addVisitante');
        const btnTimeout = document.getElementById('btnTimeout');
        const btnBreak = document.getElementById('btnBreak');
        const comenzarBtn = document.getElementById('comenzarBtn');
        const btnLocal = document.getElementById('btnLocal');
        const btnVisitante = document.getElementById('btnVisitante');
        const btnErrorRival = document.getElementById('btnErrorRival');
        const confirmarBtn = document.getElementById('confirmarBtn');
        const deshacerBtn = document.getElementById('deshacerBtn');

        if (addLocal) {
            addLocal.onclick = () => {
                let n = parseInt(document.getElementById('nuevoLocal')?.value);
                if (n && !this.config.local.jugadores.includes(n)) {
                    this.config.local.jugadores.push(n);
                    this.config.local.jugadores.sort((a, b) => a - b);
                    this.renderConfig();
                    localStorage.setItem(`config_${this.matchIdActual}`, JSON.stringify(this.config));
                }
            };
        }

        if (addVisitante) {
            addVisitante.onclick = () => {
                let n = parseInt(document.getElementById('nuevoVisitante')?.value);
                if (n && !this.config.visitante.jugadores.includes(n)) {
                    this.config.visitante.jugadores.push(n);
                    this.config.visitante.jugadores.sort((a, b) => a - b);
                    this.renderConfig();
                    localStorage.setItem(`config_${this.matchIdActual}`, JSON.stringify(this.config));
                }
            };
        }

        if (btnTimeout) btnTimeout.onclick = () => this.guardarTimeout();
        if (btnBreak) btnBreak.onclick = () => this.guardarBreak();
        if (comenzarBtn) comenzarBtn.onclick = () => this.comenzarPartido();

        if (btnLocal) {
            btnLocal.onclick = () => {
                this.estado.equipo = 'LOCAL';
                this.jugadorSeleccionado = null;
                this.estado.accion = null;
                document.querySelectorAll('#canchaGrid .jugador-btn, #bancoContainer .banco-item').forEach(btn => {
                    btn.classList.remove('seleccionado');
                });
                document.querySelectorAll('.accion-rapida-btn').forEach(b => b.classList.remove('seleccionado'));
                if (btnErrorRival) btnErrorRival.classList.remove('seleccionado');
                btnLocal.classList.add('bg-blue-700');
                if (btnVisitante) {
                    btnVisitante.classList.remove('bg-blue-700');
                    btnVisitante.classList.add('bg-gray-700');
                }
                this.actualizarCancha();
                this.renderizarBanco();
                this.mostrarFeedback(`🔵 ${this.homeTeamName} seleccionado`, 'info');
            };
        }

        if (btnVisitante) {
            btnVisitante.onclick = () => {
                this.estado.equipo = 'VISITANTE';
                this.jugadorSeleccionado = null;
                this.estado.accion = null;
                document.querySelectorAll('#canchaGrid .jugador-btn, #bancoContainer .banco-item').forEach(btn => {
                    btn.classList.remove('seleccionado');
                });
                document.querySelectorAll('.accion-rapida-btn').forEach(b => b.classList.remove('seleccionado'));
                if (btnErrorRival) btnErrorRival.classList.remove('seleccionado');
                btnVisitante.classList.add('bg-blue-700');
                if (btnLocal) {
                    btnLocal.classList.remove('bg-blue-700');
                    btnLocal.classList.add('bg-gray-700');
                }
                this.actualizarCancha();
                this.renderizarBanco();
                this.mostrarFeedback(`🔴 ${this.awayTeamName} seleccionado`, 'info');
            };
        }

        if (btnErrorRival) {
            btnErrorRival.onclick = () => {
                this.estado.accion = 'ERROR_RIVAL';
                document.querySelectorAll('.accion-rapida-btn').forEach(b => b.classList.remove('seleccionado'));
                btnErrorRival.classList.add('seleccionado');
                this.mostrarFeedback(`❌ ERROR DEL RIVAL seleccionado - El punto será para tu equipo`, 'info');
            };
        }

        document.querySelectorAll('.accion-rapida-btn').forEach(btn => {
            btn.onclick = () => {
                this.estado.accion = btn.dataset.accion;
                if (btnErrorRival) btnErrorRival.classList.remove('seleccionado');
                document.querySelectorAll('.accion-rapida-btn').forEach(b => b.classList.remove('seleccionado'));
                btn.classList.add('seleccionado');
                this.mostrarFeedback(`⚡ ${btn.dataset.accion} seleccionado`, 'info');
            };
        });

        if (confirmarBtn) confirmarBtn.onclick = () => this.guardarPunto();
        if (deshacerBtn) deshacerBtn.onclick = () => this.deshacer();
    }
}