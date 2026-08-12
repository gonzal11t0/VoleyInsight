// dashboard/js/statsHelper.js

export function calcularStatsPorJugador(datos, equipo) {
    const stats = {};
    for (const punto of datos) {
        if (punto.equipo !== equipo) continue;
        const jugador = punto.jugador;
        if (!stats[jugador]) {
            stats[jugador] = { 
                jugadorNombre: punto.jugadorNombre || punto.nombreJugador || null,
                puntos: 0,
                ataques: 0,
                ataquesConvertidos: 0,
                bloqueos: 0,
                aces: 0,
                erroresAtaque: 0,
                erroresServicio: 0,
                asistencias: 0,
                acesServicio: 0,
                totalSaques: 0,
                puntosPorErrorRival: 0,
                // 🆕 Nuevas estadísticas
                recepcionesPositivas: 0,
                recepcionesNegativas: 0,
                defensasPositivas: 0,
                defensasNegativas: 0,
                totalRecepciones: 0,
                totalDefensas: 0
            };
        }
        
        const s = stats[jugador];
        if (punto.jugadorNombre || punto.nombreJugador) {
            s.jugadorNombre = punto.jugadorNombre || punto.nombreJugador;
        }
        
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
            case 'ERROR':
                // ✅ ERROR: es un error de ataque (o genérico), NO es error de servicio
                s.erroresAtaque++;
                // ❌ ELIMINADO: s.erroresServicio++;
                // ❌ ELIMINADO: s.totalSaques++;
                break;
            case 'ERROR_RIVAL':
                s.puntosPorErrorRival++;
                s.puntos++;
                break;
            // 🆕 Nuevas acciones
            case 'RECEPCION_POSITIVA':
                s.recepcionesPositivas++;
                s.totalRecepciones++;
                break;
            case 'RECEPCION_NEGATIVA':
                s.recepcionesNegativas++;
                s.totalRecepciones++;
                break;
            case 'DEFENSA_POSITIVA':
                s.defensasPositivas++;
                s.totalDefensas++;
                break;
            case 'DEFENSA_NEGATIVA':
                s.defensasNegativas++;
                s.totalDefensas++;
                break;
            case 'ERROR_SAQUE':
                s.erroresServicio++;
                s.totalSaques++;
                break;
        }
        
        if (punto.asistencia) {
            if (!stats[punto.asistencia]) {
                stats[punto.asistencia] = { 
                    jugadorNombre: punto.asistenciaNombre || null,
                    puntos: 0, ataques: 0, ataquesConvertidos: 0, bloqueos: 0, 
                    aces: 0, erroresAtaque: 0, erroresServicio: 0, asistencias: 0, 
                    acesServicio: 0, totalSaques: 0, puntosPorErrorRival: 0,
                    recepcionesPositivas: 0, recepcionesNegativas: 0,
                    defensasPositivas: 0, defensasNegativas: 0,
                    totalRecepciones: 0, totalDefensas: 0
                };
            }
            stats[punto.asistencia].asistencias++;
        }
    }
    
    for (const jugador in stats) {
        const s = stats[jugador];
        s.ataques = s.ataques || 0;
        s.ataquesConvertidos = s.ataquesConvertidos || 0;
        s.eficienciaAtaque = calcularEficienciaAtaqueJugador(s).toFixed(1);
        s.eficienciaServicio = s.totalSaques > 0 ? ((s.acesServicio - s.erroresServicio) / s.totalSaques * 100).toFixed(1) : '0';
        s.puntos = (s.ataquesConvertidos || 0) + (s.bloqueos || 0) + (s.aces || 0) + (s.puntosPorErrorRival || 0);
        
        // 🆕 Eficiencias de recepción y defensa
        s.eficienciaRecepcion = s.totalRecepciones > 0 ? ((s.recepcionesPositivas / s.totalRecepciones) * 100).toFixed(1) : '0';
        s.eficienciaDefensa = s.totalDefensas > 0 ? ((s.defensasPositivas / s.totalDefensas) * 100).toFixed(1) : '0';
    }
    
    return stats;
}

function esNombreGenerico(nombre) {
    return /^jugador\s*#?\s*\d+$/i.test(String(nombre || '').trim());
}

export function fusionarNombresJugadores(jugadoresLocal = {}, jugadoresVisitante = {}, puntos = []) {
    const resultado = {
        local: { ...(jugadoresLocal || {}) },
        visitante: { ...(jugadoresVisitante || {}) }
    };

    for (const punto of Array.isArray(puntos) ? puntos : []) {
        const numero = Number(punto?.jugador);
        const claveEquipo = punto?.equipo === 'LOCAL'
            ? 'local'
            : punto?.equipo === 'VISITANTE'
                ? 'visitante'
                : null;
        if (!Number.isInteger(numero) || numero <= 0 || !claveEquipo) continue;

        const nombre = String(
            punto.jugadorNombre || punto.nombreJugador || `Jugador #${numero}`
        ).trim();
        const anterior = resultado[claveEquipo][numero];
        if (!anterior || esNombreGenerico(anterior) || !esNombreGenerico(nombre)) {
            resultado[claveEquipo][numero] = nombre;
        }
    }
    return resultado;
}

export function calcularEficienciaAtaqueJugador(statsJugador) {
    const convertidos = Number(statsJugador?.ataquesConvertidos) || 0;
    const errores = Number(statsJugador?.erroresAtaque) || 0;
    const intentos = (Number(statsJugador?.ataques) || 0) + errores;
    return intentos > 0 ? Number(((convertidos - errores) / intentos * 100).toFixed(1)) : 0;
}

export function resumirPuntosEquipo(datos, equipo, stats) {
    const puntosEquipo = (Array.isArray(datos) ? datos : []).filter(punto =>
        punto?.equipoAnota === equipo
    ).length;
    const puntosAtribuidos = Object.values(stats || {}).reduce(
        (total, jugador) => total + (Number(jugador?.puntos) || 0),
        0
    );
    return {
        puntosEquipo,
        puntosAtribuidos,
        sinAtribuir: Math.max(0, puntosEquipo - puntosAtribuidos)
    };
}
export function actualizarTablaConStats(tid, stats, jugadoresLocal, jugadoresVisitante, equipo) {
    const tb = document.getElementById(tid);
    if (!tb) return;
    const nm = equipo === 'LOCAL' ? jugadoresLocal : jugadoresVisitante;
    
    tb.querySelectorAll('tr').forEach(f => {
        const ns = f.querySelector('.numero-jugador');
        if (ns) {
            const n = parseInt(ns.textContent.replace(/[()]/g, ''));
            const st = stats[n];
            if (st) {
                const c = f.querySelectorAll('td');
                if (c.length >= 14) {
                    const ataquesTotales = st.ataques || 0;
                    const ataquesConv = st.ataquesConvertidos || 0;
                    const ataquesTexto = ataquesTotales > 0 ? `${ataquesConv}/${ataquesTotales}` : '0/0';
                    
                    c[1].textContent = st.puntos || 0;
                    c[2].textContent = ataquesTexto;
                    c[3].textContent = st.bloqueos || 0;
                    c[4].textContent = st.aces || 0;
                    c[5].textContent = st.erroresAtaque || 0;
                    c[6].textContent = st.asistencias || 0;
                    
                    const eficienciaAtaque = calcularEficienciaAtaqueJugador(st).toFixed(1);
                    c[7].textContent = `${eficienciaAtaque}%`;
                    
                    // 🆕 RECEPCIÓN
                    c[8].textContent = `${st.recepcionesPositivas || 0}/${st.totalRecepciones || 0}`;
                    const efRec = st.totalRecepciones > 0 ? ((st.recepcionesPositivas / st.totalRecepciones) * 100).toFixed(1) : '0';
                    c[9].textContent = `${efRec}%`;
                    
                    // 🆕 DEFENSA
                    c[10].textContent = `${st.defensasPositivas || 0}/${st.totalDefensas || 0}`;
                    const efDef = st.totalDefensas > 0 ? ((st.defensasPositivas / st.totalDefensas) * 100).toFixed(1) : '0';
                    c[11].textContent = `${efDef}%`;
                    
                    // SERVICIO (se corren)
                    c[12].textContent = st.acesServicio || 0;
                    c[13].textContent = st.erroresServicio || 0;
                    
                    const totalSaques = st.totalSaques || 0;
                    const eficienciaServicio = totalSaques > 0 ? (((st.acesServicio || 0) - (st.erroresServicio || 0)) / totalSaques * 100).toFixed(1) : '0';
                    c[14].textContent = `${eficienciaServicio}%`;
                    c[15].textContent = totalSaques;
                }
            }
        }
    });
}

export function renderizarSoloNombres(tid, jugadoresLocal, jugadoresVisitante, equipo, stats = {}) {
    const tb = document.getElementById(tid);
    if (!tb) return;
    const nm = equipo === 'LOCAL' ? jugadoresLocal : jugadoresVisitante;
    const numeros = new Set([...Object.keys(nm || {}), ...Object.keys(stats || {})]);
    const ordenados = [...numeros]
        .filter(num => !isNaN(parseInt(num)) && num !== null && num !== 'null')
        .map(num => {
            const numero = parseInt(num);
            return {
                num: numero,
                nombre: nm?.[numero] || stats?.[numero]?.jugadorNombre || `Jugador #${numero}`
            };
        })
        .sort((a, b) => a.num - b.num);
    
    if (!ordenados.length) { 
        tb.innerHTML = '<tr><td colspan="16" class="text-center py-4 text-gray-500">Esperando datos de jugadores...</td></tr>'; 
        return; 
    }
    
    tb.innerHTML = ordenados.map(j => `<tr class="border-b border-gray-700/50">
        <td class="py-2 font-medium text-xs">${j.nombre} <span class="text-gray-500 numero-jugador">(${j.num})</span></td>
        <td class="text-center">0</td>
        <td class="text-center">0/0</td>
        <td class="text-center">0</td>
        <td class="text-center">0</td>
        <td class="text-center">0</td>
        <td class="text-center">0</td>
        <td class="text-center">0%</td>
        <td class="text-center">0/0</td>
        <td class="text-center">0%</td>
        <td class="text-center">0/0</td>
        <td class="text-center">0%</td>
        <td class="text-center">0</td>
        <td class="text-center">0</td>
        <td class="text-center">0%</td>
        <td class="text-center">0</td>
    </tr>`).join('');
}   
export function renderizarTop5ConNombres(sl, sv, jugadoresLocal, jugadoresVisitante) {
    const nl = jugadoresLocal, nv = jugadoresVisitante;
    const todos = [];
    for (const [num, s] of Object.entries(sl)) {
        if (num === 'null' || num === 'NaN' || isNaN(parseInt(num))) continue;
        const ef = calcularEficienciaAtaqueJugador(s);
        todos.push({ num: parseInt(num), nombre: nl[num] || s.jugadorNombre || `Jugador #${num}`, equipo: 'LOCAL', puntos: s.puntos || 0, eficiencia: ef.toFixed(1), acesServicio: s.acesServicio || 0 });
    }
    for (const [num, s] of Object.entries(sv)) {
        if (num === 'null' || num === 'NaN' || isNaN(parseInt(num))) continue;
        const ef = calcularEficienciaAtaqueJugador(s);
        todos.push({ num: parseInt(num), nombre: nv[num] || s.jugadorNombre || `Jugador #${num}`, equipo: 'VISITANTE', puntos: s.puntos || 0, eficiencia: ef.toFixed(1), acesServicio: s.acesServicio || 0 });
    }
    const top5 = todos.sort((a, b) =>
        b.puntos - a.puntos || Number(b.eficiencia) - Number(a.eficiencia)
    ).slice(0, 5);
    const container = document.getElementById('top5List');
    if (!container) return;
    if (!top5.length) { container.innerHTML = '<div class="text-center text-gray-500">Sin datos</div>'; return; }
    const medallas = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    container.innerHTML = top5.map((j, idx) => `<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-2 bg-dark/30 rounded-lg hover:bg-dark/50 transition-all">
        <div class="flex items-center gap-2 min-w-0">
            <span class="text-xl">${medallas[idx]}</span>
            <div>
                <span class="font-semibold break-words">${j.nombre}</span>
                <span class="text-xs ml-2 px-2 py-0.5 rounded-full ${j.equipo === 'LOCAL' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}">${j.equipo}</span>
            </div>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 pl-8 sm:pl-0">
            <span class="text-primary font-bold">${j.puntos} pts</span>
            <span class="text-gray-400 text-sm">Efi: ${j.eficiencia}%</span>
            ${j.acesServicio > 0 ? `<span class="text-blue-400 text-sm">🎯 ${j.acesServicio} SAQUE</span>` : ''}
        </div>
    </div>`).join('');
}

export function renderizarTarjetasMoviles(containerId, stats, jugadoresMap) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const numeros = new Set([
        ...Object.keys(jugadoresMap || {}),
        ...Object.keys(stats || {})
    ]);
    const jugadores = [...numeros]
        .filter(numero => Number.isFinite(Number(numero)))
        .map(numero => ({
            numero: Number(numero),
            nombre: jugadoresMap?.[numero] || stats?.[numero]?.jugadorNombre || `Jugador #${numero}`
        }))
        .sort((a, b) => a.numero - b.numero);

    if (!jugadores.length) {
        container.innerHTML = '<div class="text-center text-gray-500 py-4">Esperando datos de jugadores...</div>';
        return;
    }

    container.innerHTML = jugadores.map(jugador => {
        const s = stats?.[jugador.numero] || {};
        const ataques = Number(s.ataques) || 0;
        const convertidos = Number(s.ataquesConvertidos) || 0;
        const recepciones = Number(s.totalRecepciones) || 0;
        const defensas = Number(s.totalDefensas) || 0;
        const saques = Number(s.totalSaques) || 0;
        const efAtaque = calcularEficienciaAtaqueJugador(s);
        const efRecepcion = recepciones ? ((Number(s.recepcionesPositivas) || 0) / recepciones * 100).toFixed(1) : '0';
        const efDefensa = defensas ? ((Number(s.defensasPositivas) || 0) / defensas * 100).toFixed(1) : '0';
        const efServicio = saques ? (((Number(s.acesServicio) || 0) - (Number(s.erroresServicio) || 0)) / saques * 100).toFixed(1) : '0';
        return `<details class="jugador-card-movil bg-dark/40 border border-white/10 rounded-xl overflow-hidden">
            <summary class="flex items-center justify-between gap-3 p-3 cursor-pointer">
                <span class="font-semibold text-sm">${jugador.nombre} <span class="text-gray-500">#${jugador.numero}</span></span>
                <span class="text-primary font-bold whitespace-nowrap">${Number(s.puntos) || 0} pts</span>
            </summary>
            <div class="grid grid-cols-3 gap-2 p-3 pt-0 text-center">
                <div><span>ATA</span><strong>${convertidos}/${ataques}</strong></div>
                <div><span>EFI ATA</span><strong>${efAtaque}%</strong></div>
                <div><span>BLO</span><strong>${Number(s.bloqueos) || 0}</strong></div>
                <div><span>ACE</span><strong>${Number(s.aces) || 0}</strong></div>
                <div><span>ERR ATA</span><strong>${Number(s.erroresAtaque) || 0}</strong></div>
                <div><span>ASIS</span><strong>${Number(s.asistencias) || 0}</strong></div>
                <div><span>REC+</span><strong>${Number(s.recepcionesPositivas) || 0}/${recepciones}</strong></div>
                <div><span>EFI REC</span><strong>${efRecepcion}%</strong></div>
                <div><span>DEF+</span><strong>${Number(s.defensasPositivas) || 0}/${defensas}</strong></div>
                <div><span>EFI DEF</span><strong>${efDefensa}%</strong></div>
                <div><span>SAQUE</span><strong>${Number(s.acesServicio) || 0}/${saques}</strong></div>
                <div><span>EFI SERV</span><strong>${efServicio}%</strong></div>
            </div>
        </details>`;
    }).join('');
}

export function renderizarGraficoPuntos(stats, equipo, jugadoresLocal, jugadoresVisitante, chartPuntosJugadores) {
    const ctx = document.getElementById('puntosJugadoresChart');
    if (!ctx) return;
    if (chartPuntosJugadores) chartPuntosJugadores.destroy();
    const nm = equipo === 'LOCAL' ? jugadoresLocal : jugadoresVisitante;
    const jug = Object.entries(stats).map(([num, s]) => ({ num: parseInt(num), nombre: nm[num] || s.jugadorNombre || `J${num}`, puntos: s.puntos })).sort((a, b) => b.puntos - a.puntos).slice(0, 8);
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: jug.map(j => j.nombre.length > 20 ? j.nombre.substring(0,18)+'...' : j.nombre),
            datasets: [{ label: 'Puntos', data: jug.map(j => j.puntos), backgroundColor: equipo === 'LOCAL' ? '#3b82f6' : '#ef4444', borderRadius: 4 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#fff' } },
                tooltip: { callbacks: { label: ctx => `${ctx.raw} puntos` } }
            },
            scales: {
                y: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
                x: { ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 45 } }
            }
        }
    });
}

export function calcularEstadisticasServicio(data, puntosJugadores) {
    let ha=0, he=0, aa=0, ae=0, ht=0, at=0;
    for (const p of data || []) {
        const sacando = p.servingBefore || p.serving;
        if (!p.scorer || !sacando) continue;
        const esAce = p.event === 'ACE_HOME' || p.event === 'ACE_AWAY';
        const esError = p.event === 'ERROR_SERVICIO_HOME' || p.event === 'ERROR_SERVICIO_AWAY';
        if (sacando === 'HOME') { ht++; if (esAce) ha++; if (esError) he++; }
        else if (sacando === 'AWAY') { at++; if (esAce) aa++; if (esError) ae++; }
    }
    if (puntosJugadores?.length) {
        // El anotador manual identifica aces y errores; el total de saques viene
        // de los rallies oficiales para evitar sumar dos veces los mismos puntos.
        ha = 0; he = 0; aa = 0; ae = 0;
        for (const p of puntosJugadores) {
            if (p.accion === 'ACE') { if (p.equipo === 'LOCAL') ha++; else aa++; }
            if (p.accion === 'ERROR_SAQUE') { if (p.equipo === 'LOCAL') he++; else ae++; }
        }
        if (ht + at === 0) {
            for (const p of puntosJugadores) {
                if (p.equipoSacaba === 'LOCAL') ht++;
                else if (p.equipoSacaba === 'VISITANTE') at++;
            }
        }
    }
    const hef = ht > 0 ? ((ha - he) / ht * 100).toFixed(1) : 0;
    const aef = at > 0 ? ((aa - ae) / at * 100).toFixed(1) : 0;
    return { home: { aces: ha, errores: he, totalSaques: ht, eficiencia: hef }, away: { aces: aa, errores: ae, totalSaques: at, eficiencia: aef } };
}

export function generarTablaHTMLSimple(stats, jugadoresMap) {
    if (!stats || Object.keys(stats).length === 0) return '';
    
    let html = '';
    const ordenados = Object.entries(stats).sort((a, b) => b[1].puntos - a[1].puntos);
    
    for (const [numJugador, s] of ordenados) {
        const num = parseInt(numJugador);
        if (isNaN(num)) continue;
        
        const nombre = jugadoresMap[num] || s.jugadorNombre || `Jugador #${num}`;
        const ataquesTotales = s.ataques || 0;
        const ataquesConvertidos = s.ataquesConvertidos || 0;
        const ataquesTexto = ataquesTotales > 0 ? `${ataquesConvertidos}/${ataquesTotales}` : '0/0';
        
        const efAtaque = calcularEficienciaAtaqueJugador(s).toFixed(1);
        
        let efServ = '0';
        const totalSaques = s.totalSaques || 0;
        if (totalSaques > 0) {
            efServ = ((s.acesServicio - s.erroresServicio) / totalSaques * 100).toFixed(1);
        }
        
        html += `<tr style="border-bottom:1px solid #374151;">
            <td style="padding:12px;font-weight:500;">${nombre} <span style="color:#6b7280;">(${num})</span></td>
            <td style="text-align:center;font-weight:bold;color:#667eea;">${s.puntos || 0}</td>
            <td style="text-align:center;">${ataquesTexto}</td>
            <td style="text-align:center;">${s.bloqueos || 0}</td>
            <td style="text-align:center;">${s.aces || 0}</td>
            <td style="text-align:center;color:#ef4444;">${s.erroresAtaque || 0}</td>
            <td style="text-align:center;">${s.asistencias || 0}</td>
            <td style="text-align:center;font-weight:bold;">${efAtaque}%</td>
            <td style="text-align:center;">${s.recepcionesPositivas || 0}/${s.totalRecepciones || 0}</td>
            <td style="text-align:center;">${s.eficienciaRecepcion || 0}%</td>
            <td style="text-align:center;">${s.defensasPositivas || 0}/${s.totalDefensas || 0}</td>
            <td style="text-align:center;">${s.eficienciaDefensa || 0}%</td>
            <td style="text-align:center;color:#3b82f6;">${s.acesServicio || 0}</td>
            <td style="text-align:center;color:#ef4444;">${s.erroresServicio || 0}</td>
            <td style="text-align:center;font-weight:bold;">${efServ}%</td>
            <td style="text-align:center;font-weight:bold;">${totalSaques}</td>
        </tr>`;
    }
    
    return html;
}
