// dashboard/js/statsHelper.js

export function calcularStatsPorJugador(datos, equipo) {
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
                erroresServicio: 0,
                asistencias: 0,
                acesServicio: 0,
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
            case 'ERROR':
                s.erroresAtaque++;
                s.erroresServicio++;
                s.totalSaques++;
                break;
            case 'ERROR_RIVAL':
                s.puntosPorErrorRival++;
                s.puntos++;
                break;
        }
        
        if (punto.asistencia) {
            if (!stats[punto.asistencia]) {
                stats[punto.asistencia] = { 
                    puntos: 0, ataques: 0, ataquesConvertidos: 0, bloqueos: 0, 
                    aces: 0, erroresAtaque: 0, erroresServicio: 0, asistencias: 0, 
                    acesServicio: 0, totalSaques: 0, puntosPorErrorRival: 0
                };
            }
            stats[punto.asistencia].asistencias++;
        }
    }
    
    for (const jugador in stats) {
        const s = stats[jugador];
        s.ataques = s.ataques || 0;
        s.ataquesConvertidos = s.ataquesConvertidos || 0;
        s.eficienciaAtaque = s.ataques > 0 ? ((s.ataquesConvertidos / s.ataques) * 100).toFixed(1) : '0';
        s.eficienciaServicio = s.totalSaques > 0 ? ((s.acesServicio - s.erroresServicio) / s.totalSaques * 100).toFixed(1) : '0';
        s.puntos = (s.ataquesConvertidos || 0) + (s.bloqueos || 0) + (s.aces || 0) + (s.puntosPorErrorRival || 0);
    }
    
    return stats;
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
                if (c.length >= 12) {
                    const ataquesTotales = st.ataques || 0;
                    const ataquesConv = st.ataquesConvertidos || 0;
                    const ataquesTexto = ataquesTotales > 0 ? `${ataquesConv}/${ataquesTotales}` : '0/0';
                    
                    c[1].textContent = st.puntos || 0;
                    c[2].textContent = ataquesTexto;
                    c[3].textContent = st.bloqueos || 0;
                    c[4].textContent = st.aces || 0;
                    c[5].textContent = st.erroresAtaque || 0;
                    c[6].textContent = st.asistencias || 0;
                    
                    const eficienciaAtaque = ataquesTotales > 0 ? ((ataquesConv / ataquesTotales) * 100).toFixed(1) : '0';
                    c[7].textContent = `${eficienciaAtaque}%`;
                    
                    c[8].textContent = st.acesServicio || 0;
                    c[9].textContent = st.erroresServicio || 0;
                    
                    const totalSaques = st.totalSaques || 0;
                    const eficienciaServicio = totalSaques > 0 ? (((st.acesServicio || 0) - (st.erroresServicio || 0)) / totalSaques * 100).toFixed(1) : '0';
                    c[10].textContent = `${eficienciaServicio}%`;
                    c[11].textContent = totalSaques;
                    
                    const ef = parseFloat(eficienciaServicio);
                    c[10].className = `text-center font-semibold ${ef > 10 ? 'text-green-400' : ef < 0 ? 'text-red-400' : 'text-yellow-400'}`;
                }
            }
        }
    });
}

export function renderizarSoloNombres(tid, jugadoresLocal, jugadoresVisitante, equipo) {
    const tb = document.getElementById(tid);
    if (!tb) return;
    const nm = equipo === 'LOCAL' ? jugadoresLocal : jugadoresVisitante;
    const ordenados = Object.entries(nm)
        .filter(([num]) => !isNaN(parseInt(num)) && num !== null && num !== 'null')
        .map(([num, nombre]) => ({ num: parseInt(num), nombre }))
        .sort((a, b) => a.num - b.num);
    
    if (!ordenados.length) { 
        tb.innerHTML = '<tr><td colspan="12" class="text-center py-4 text-gray-500">Esperando datos de jugadores...</td></tr>'; 
        return; 
    }
    
    tb.innerHTML = ordenados.map(j => `<tr class="border-b border-gray-700/50">
        <td class="py-2 font-medium text-xs">${j.nombre} <span class="text-gray-500 numero-jugador">(${j.num})</span></td>
        <td class="text-center">0</td><td class="text-center">0/0</td><td class="text-center">0</td>
        <td class="text-center">0</td><td class="text-center">0</td><td class="text-center">0</td>
        <td class="text-center">0%</td><td class="text-center">0</td><td class="text-center">0</td>
        <td class="text-center">0%</td><td class="text-center">0</td>
    </tr>`).join('');
}

export function renderizarTop5ConNombres(sl, sv, jugadoresLocal, jugadoresVisitante) {
    const nl = jugadoresLocal, nv = jugadoresVisitante;
    const todos = [];
    for (const [num, s] of Object.entries(sl)) {
        if (num === 'null' || num === 'NaN' || isNaN(parseInt(num))) continue;
        let ef = parseFloat(s.eficiencia);
        if (isNaN(ef)) ef = 0;
        if (ef > 100) ef = 100;
        todos.push({ num: parseInt(num), nombre: nl[num] || `Jugador ${num}`, equipo: 'LOCAL', puntos: s.puntos || 0, eficiencia: ef.toFixed(1), acesServicio: s.acesServicio || 0 });
    }
    for (const [num, s] of Object.entries(sv)) {
        if (num === 'null' || num === 'NaN' || isNaN(parseInt(num))) continue;
        let ef = parseFloat(s.eficiencia);
        if (isNaN(ef)) ef = 0;
        if (ef > 100) ef = 100;
        todos.push({ num: parseInt(num), nombre: nv[num] || `Jugador ${num}`, equipo: 'VISITANTE', puntos: s.puntos || 0, eficiencia: ef.toFixed(1), acesServicio: s.acesServicio || 0 });
    }
    const top5 = todos.sort((a, b) => b.puntos - a.puntos).slice(0, 5);
    const container = document.getElementById('top5List');
    if (!container) return;
    if (!top5.length) { container.innerHTML = '<div class="text-center text-gray-500">Sin datos</div>'; return; }
    const medallas = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    container.innerHTML = top5.map((j, idx) => `<div class="flex justify-between items-center p-2 bg-dark/30 rounded-lg hover:bg-dark/50 transition-all">
        <div class="flex items-center gap-2">
            <span class="text-xl">${medallas[idx]}</span>
            <div>
                <span class="font-semibold">${j.nombre}</span>
                <span class="text-xs ml-2 px-2 py-0.5 rounded-full ${j.equipo === 'LOCAL' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}">${j.equipo}</span>
            </div>
        </div>
        <div class="flex gap-4">
            <span class="text-primary font-bold">${j.puntos} pts</span>
            <span class="text-gray-400 text-sm">Efi: ${j.eficiencia}%</span>
            ${j.acesServicio > 0 ? `<span class="text-blue-400 text-sm">🎯 ${j.acesServicio} aces</span>` : ''}
        </div>
    </div>`).join('');
}

export function renderizarGraficoPuntos(stats, equipo, jugadoresLocal, jugadoresVisitante, chartPuntosJugadores) {
    const ctx = document.getElementById('puntosJugadoresChart');
    if (!ctx) return;
    if (chartPuntosJugadores) chartPuntosJugadores.destroy();
    const nm = equipo === 'LOCAL' ? jugadoresLocal : jugadoresVisitante;
    const jug = Object.entries(stats).map(([num, s]) => ({ num: parseInt(num), nombre: nm[num] || `J${num}`, puntos: s.puntos })).sort((a, b) => b.puntos - a.puntos).slice(0, 8);
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
    if (!data?.length) return { home: { aces:0, errores:0, totalSaques:0, eficiencia:0 }, away: { aces:0, errores:0, totalSaques:0, eficiencia:0 } };
    let ha=0, he=0, aa=0, ae=0, ht=0, at=0;
    for (const p of data) {
        if (!p.scorer || !p.serving) continue;
        const sacando = p.serving, anotador = p.scorer;
        const esAce = p.event === 'ACE_HOME' || p.event === 'ACE_AWAY';
        const esError = p.event === 'ERROR_SERVICIO_HOME' || p.event === 'ERROR_SERVICIO_AWAY';
        if (sacando === 'HOME') { ht++; if (anotador === 'HOME') { if (esAce) ha++; } else { if (esError) he++; } }
        else if (sacando === 'AWAY') { at++; if (anotador === 'AWAY') { if (esAce) aa++; } else { if (esError) ae++; } }
    }
    if (puntosJugadores?.length) {
        for (const p of puntosJugadores) {
            if (p.accion === 'ACE') { if (p.equipo === 'LOCAL') ha++; else aa++; }
            if (p.accion === 'ERROR') { if (p.equipo === 'LOCAL') he++; else ae++; }
            if (p.accion === 'ACE' || p.accion === 'ERROR' || p.accion === 'ATAQUE') { if (p.equipo === 'LOCAL') ht++; else at++; }
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
        
        const nombre = jugadoresMap[num] || `Jugador ${num}`;
        const ataquesTotales = s.ataques || 0;
        const ataquesConvertidos = s.ataquesConvertidos || 0;
        const ataquesTexto = ataquesTotales > 0 ? `${ataquesConvertidos}/${ataquesTotales}` : '0/0';
        
        let efAtaque = '0';
        if (ataquesTotales > 0) {
            efAtaque = ((ataquesConvertidos / ataquesTotales) * 100).toFixed(1);
        }
        
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
            <td style="text-align:center;color:#3b82f6;">${s.acesServicio || 0}</td>
            <td style="text-align:center;color:#ef4444;">${s.erroresServicio || 0}</td>
            <td style="text-align:center;font-weight:bold;">${efServ}%</td>
            <td style="text-align:center;font-weight:bold;">${totalSaques}</td>
        </tr>`;
    }
    
    return html;
}