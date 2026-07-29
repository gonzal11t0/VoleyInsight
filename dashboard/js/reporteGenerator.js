// dashboard/js/reporteGenerator.js
export class ReporteGenerator {
    static generarHTML(d) {
        const {
            homeTeam, awayTeam, homeScore, awayScore, fechaHora,
            homeEfficiency, awayEfficiency, maxHomeRun, maxAwayRun,
            homeBreaks, awayBreaks, totalPoints, homeClutchPct,
            homePhaseEff, awayPhaseEff, setsHtml,
            scoreChartImage, momentumChartImage, runsChartImage, phaseChartImage,
            breakPointsHtml, timelineHtml, interpretationsHtml, recommendationsHtml,
            tablaLocal, tablaVisitante,
            eficienciaPorSet = [],
            localPorSet = {},
            visitantePorSet = {},
            rotacionesHtml = '',
            logoDataUrl = ''

        } = d;

        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" integrity="sha512-GsLlZN/3F2ErC5ifS5QtgpiJtWd43JWSuIgh7mbzZ8zBps+dvLusV+eNQATqgA/HdeKFVgA5v3S/cIrLF7QnIg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <title>${homeTeam} vs ${awayTeam} - Reporte VoleyInsight</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Inter',sans-serif;background:#0a0c15;padding:16px;}
    .container{max-width:1400px;margin:0 auto;background:#1a1f2e;border-radius:32px;overflow:visible;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);}
    .header{background:linear-gradient(135deg,#1a1f2e 0%,#0f1119 100%);padding:30px 20px;text-align:center;border-bottom:1px solid rgba(102,126,234,0.2);position:relative;}
    .header::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#667eea,#764ba2,#f43f5e);}
    .report-logo{display:block;width:min(360px,80%);height:auto;margin:0 auto 18px;}
    .header h1{font-size:28px;font-weight:800;background:linear-gradient(135deg,#667eea,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:20px;}
    .score-container{display:flex;justify-content:center;align-items:center;gap:24px;flex-wrap:wrap;}
    .team-score{text-align:center;padding:12px 20px;background:rgba(255,255,255,0.03);border-radius:20px;}
    .team-name{font-size:16px;font-weight:600;color:#9ca3af;}
    .score-number{font-size:48px;font-weight:800;line-height:1;}
    .vs-badge{font-size:18px;font-weight:700;background:linear-gradient(135deg,#667eea,#764ba2);padding:8px 20px;border-radius:60px;color:white;}
    .date{font-size:12px;color:#6b7280;margin-top:16px;display:inline-block;background:rgba(255,255,255,0.03);padding:6px 12px;border-radius:40px;}
    .save-banner{background:#1a1f2e;margin:20px;padding:16px;border-radius:16px;border-left:4px solid #10b981;text-align:center;}
    .save-banner p{color:#e5e7eb;font-size:14px;margin-bottom:8px;}
    .save-banner kbd{background:#2d3748;padding:4px 8px;border-radius:6px;font-family:monospace;font-size:12px;margin:0 4px;}
    .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;padding:24px;background:#0f1119;}
    .stat-card{background:#1a1f2e;border-radius:20px;padding:16px 12px;text-align:center;border:1px solid #2d3748;position:relative;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
    .stat-number{position:absolute;top:8px;right:12px;font-size:10px;font-weight:700;color:#667eea;background:rgba(102,126,234,0.15);padding:2px 6px;border-radius:20px;}
    .stat-value{font-size:32px;font-weight:800;color:#667eea;}
    .stat-label{font-size:11px;font-weight:500;color:#9ca3af;margin-top:8px;text-transform:uppercase;}
    .section{margin:20px;padding:20px;background:#0f1119;border-radius:24px;border:1px solid #2d3748;page-break-inside:avoid;break-inside:avoid;}
    .section-title{font-size:20px;font-weight:700;color:#667eea;margin-bottom:20px;padding-bottom:10px;border-bottom:2px solid #2d3748;}
    .sets-container{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;}
    .chart-container{background:#1a1f2e;border-radius:16px;padding:16px;text-align:center;min-height:350px;height:auto;}
    .chart-container img, .chart-container canvas{max-width:100%;height:auto;border-radius:12px;}
    table{width:100%;border-collapse:collapse;background:#1a1f2e;border-radius:16px;overflow-x:auto;}
    th{background:#0f1119;padding:12px 8px;text-align:center;color:#9ca3af;font-weight:600;font-size:11px;text-transform:uppercase;border-bottom:1px solid #2d3748;}
    td{padding:10px 8px;text-align:center;border-bottom:1px solid #2d3748;color:#e5e7eb;font-size:12px;}
    tr:hover td{background:rgba(102,126,234,0.05);}
    .glosario{margin:20px;padding:20px;background:#0f1119;border-radius:24px;border:1px solid #2d3748;position:relative;page-break-inside:avoid;break-inside:avoid;}
    .glosario-title{font-size:20px;font-weight:800;color:#667eea;margin-bottom:20px;text-align:center;}
    .glosario-item{display:flex;gap:12px;margin-bottom:12px;padding:10px;background:#1a1f2e;border-radius:16px;border:1px solid #2d3748;}
    .glosario-numero{font-weight:800;color:#667eea;min-width:40px;font-size:14px;}
    .glosario-desc{color:#e5e7eb;font-size:12px;line-height:1.4;}
    .footer{text-align:center;padding:24px;background:#0f1119;border-top:1px solid #2d3748;color:#6b7280;font-size:12px;}
    #eficienciaPorSetChart, canvas {
        max-height: 400px !important;
        height: 400px !important;
        min-height: 400px !important;
        width: 100% !important;
    }
    .chart-container canvas {
        display: block !important;
        width: 100% !important;
        height: auto !important;
        max-height: 400px !important;
    }
    .section p, .section div:not(.chart-container):not(.stat-card):not(.filtros-container),
    .section div[id*="metricInterpretations"], .section div[id*="actionableRecommendations"],
    .section div[id*="timeline"], .section div[id*="breakPointsList"],
    #metricInterpretations div, #actionableRecommendations div, #timeline div, #breakPointsList div {
        color: #e5e7eb !important;
    }
    @media (max-width:768px){
        body{padding:12px;}
        .section{margin:12px;padding:16px;}
        .stats-grid{gap:10px;padding:16px;grid-template-columns:repeat(2,1fr);}
        .stat-value{font-size:24px;}
        .score-number{font-size:36px;}
        .section-title{font-size:18px;}
        th,td{padding:8px 4px;font-size:10px;}
        .glosario-item{flex-direction:column;gap:6px;}
        #eficienciaPorSetChart, canvas {
            height: 300px !important;
            max-height: 300px !important;
        }
    }
    @media print {
        body{background:white;padding:0;margin:0;}
        .container{max-width:100%;margin:0;padding:0;background:white;box-shadow:none;}
        .save-banner, #btnDescargarPDF{display:none !important;}
        .header, .stat-card, .section, .glosario, .chart-container, table, .stats-grid, .footer, .save-banner {
            background:white !important;
            border:1px solid #ddd !important;
        }
        .stat-value, .section-title, .glosario-title, .header h1, .stat-number {
            background:none !important;
            color:#667eea !important;
        }
        .team-name, .stat-label, .date, .footer, td, th, .glosario-desc, .vs-badge {
            color:#333 !important;
        }
        td{background:white !important;}
        .section, .stats-grid, .glosario, .sets-container, .chart-container, table {
            page-break-inside:avoid !important;
            page-break-before:avoid !important;
            page-break-after:avoid !important;
            break-inside:avoid !important;
        }
        .section-title{page-break-after:avoid !important;break-after:avoid !important;}
        .chart-container{page-break-inside:avoid !important;break-inside:avoid !important;min-height:400px !important;height:auto !important;}
        #eficienciaPorSetChart, canvas{height:400px !important;max-height:400px !important;min-height:400px !important;}
        h1, h2, h3, .section-title, .glosario-title{page-break-after:avoid;break-after:avoid;}
    }
</style>
</head>
<body>
    <div class="container">
        <div style="text-align:center;margin:20px 0;">
            <button id="btnDescargarPDF" style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:60px;padding:12px 24px;font-size:16px;font-weight:bold;cursor:pointer;">📄 DESCARGAR REPORTE EN PDF</button>
        </div>
        <div class="header">
            ${logoDataUrl
                ? `<img class="report-logo" src="${logoDataUrl}" alt="VoleyInsight">`
                : '<h1>🏐 VoleyInsight</h1>'}
            <div class="score-container">
                <div class="team-score"><div class="team-name">${homeTeam}</div><div class="score-number" style="color:#3b82f6;">${homeScore}</div></div>
                <div class="vs-badge">VS</div>
                <div class="team-score"><div class="team-name">${awayTeam}</div><div class="score-number" style="color:#ef4444;">${awayScore}</div></div>
            </div>
            <div class="date">📅 ${fechaHora}</div>
        </div>
        <div class="save-banner">
            <p>💾 <strong>¿Cómo guardar este reporte?</strong></p>
            <p class="desktop-save">📌 En computadora: presioná <kbd>Ctrl + S</kbd> (Windows) o <kbd>Cmd + S</kbd> (Mac)</p>
            <p class="mobile-save">📌 En celular: tocá los tres puntos <kbd>⋯</kbd> → <kbd>Descargar</kbd> o <kbd>Guardar página</kbd></p>
            <p style="font-size:12px;margin-top:8px;color:#9ca3af;">✅ El archivo se guardará en tu dispositivo y podrás verlo cuando quieras</p>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-number">(1)</div><div class="stat-value">${maxHomeRun}</div><div class="stat-label">Racha ${homeTeam}</div></div>
            <div class="stat-card"><div class="stat-number">(2)</div><div class="stat-value">${maxAwayRun}</div><div class="stat-label">Racha ${awayTeam}</div></div>
            <div class="stat-card"><div class="stat-number">(3)</div><div class="stat-value">${homeBreaks}</div><div class="stat-label">Quiebres ${homeTeam}</div></div>
            <div class="stat-card"><div class="stat-number">(4)</div><div class="stat-value">${awayBreaks}</div><div class="stat-label">Quiebres ${awayTeam}</div></div>
            <div class="stat-card"><div class="stat-number">(5)</div><div class="stat-value">${homeEfficiency}%</div><div class="stat-label">Eficiencia ${homeTeam}</div></div>
            <div class="stat-card"><div class="stat-number">(6)</div><div class="stat-value">${awayEfficiency}%</div><div class="stat-label">Eficiencia ${awayTeam}</div></div>
            <div class="stat-card"><div class="stat-number">(7)</div><div class="stat-value">${homeClutchPct}%</div><div class="stat-label">Bajo presión</div></div>
            <div class="stat-card"><div class="stat-number">(8)</div><div class="stat-value">${totalPoints}</div><div class="stat-label">Puntos Totales</div></div>
        </div>
        <div class="section"><div class="section-title">📊 SETS</div><div class="sets-container">${setsHtml}</div></div>
        <div class="section">
            <div class="section-title">📈 EVOLUCIÓN DE EFICIENCIA POR SET</div>
            <div class="chart-container" style="min-height:400px;display:flex;justify-content:center;align-items:center;">
                <canvas id="eficienciaPorSetChart" style="width:100%;height:350px;min-height:350px;"></canvas>
            </div>
        </div>
        <div class="section"><div class="section-title">📈 Evolución del Marcador</div><div class="chart-container">${scoreChartImage?`<img src="${scoreChartImage}" alt="Evolución del Marcador">`:'<div class="text-center text-gray-400 py-8">Gráfico no disponible</div>'}</div></div>
        <div class="section"><div class="section-title">⚡ Índice de Momentum <span style="font-size:12px;">(9)</span></div><div class="chart-container">${momentumChartImage?`<img src="${momentumChartImage}" alt="Índice de Momentum">`:'<div class="text-center text-gray-400 py-8">Gráfico no disponible</div>'}</div></div>
        <div class="section"><div class="section-title">🔥 Mapa de Rachas</div><div class="chart-container">${runsChartImage?`<img src="${runsChartImage}" alt="Mapa de Rachas">`:'<div class="text-center text-gray-400 py-8">Gráfico no disponible</div>'}</div></div>
        <div class="section">
            <div class="section-title">🎯 Eficiencia por Fase <span style="font-size:12px;">(10,11,12)</span></div>
            <div class="phase-container" style="display:flex;justify-content:space-around;gap:16px;flex-wrap:wrap;">
                <div class="phase-card" style="flex:1;text-align:center;padding:16px;background:#1a1f2e;border-radius:20px;">
                    <div class="phase-value" style="font-size:28px;font-weight:800;display:flex;justify-content:center;gap:20px;">
                        <span style="color:#3b82f6;">${homePhaseEff?.early||0}%</span>
                        <span style="color:#ef4444;">${awayPhaseEff?.early||0}%</span>
                    </div>
                    <div style="font-size:11px;color:#9ca3af;margin-top:8px;">Early (puntos 1-10)</div>
                </div>
                <div class="phase-card" style="flex:1;text-align:center;padding:16px;background:#1a1f2e;border-radius:20px;">
                    <div class="phase-value" style="font-size:28px;font-weight:800;display:flex;justify-content:center;gap:20px;">
                        <span style="color:#3b82f6;">${homePhaseEff?.mid||0}%</span>
                        <span style="color:#ef4444;">${awayPhaseEff?.mid||0}%</span>
                    </div>
                    <div style="font-size:11px;color:#9ca3af;margin-top:8px;">Mid (puntos 11-20)</div>
                </div>
                <div class="phase-card" style="flex:1;text-align:center;padding:16px;background:#1a1f2e;border-radius:20px;">
                    <div class="phase-value" style="font-size:28px;font-weight:800;display:flex;justify-content:center;gap:20px;">
                        <span style="color:#3b82f6;">${homePhaseEff?.late||0}%</span>
                        <span style="color:#ef4444;">${awayPhaseEff?.late||0}%</span>
                    </div>
                    <div style="font-size:11px;color:#9ca3af;margin-top:8px;">Late (puntos 21+)</div>
                </div>
            </div>
            ${phaseChartImage?`<div class="chart-container" style="margin-top:16px;"><img src="${phaseChartImage}" alt="Eficiencia por Fase"></div>`:''}
        </div>
        <div class="section">
            <div class="section-title">💎 RENDIMIENTO BAJO PRESIÓN <span style="font-size:12px;">(7)</span></div>
            <div class="clutch-bar" style="background:#1a1f2e;border-radius:60px;overflow:hidden;margin-bottom:16px;">
                <div class="clutch-fill" style="width:${homeClutchPct}%;background:linear-gradient(90deg,#667eea,#764ba2);padding:12px 16px;text-align:center;color:white;font-weight:700;">${homeTeam} ${homeClutchPct}%</div>
            </div>
            <div class="clutch-bar" style="background:#1a1f2e;border-radius:60px;overflow:hidden;">
                <div class="clutch-fill" style="width:${100-homeClutchPct}%;background:linear-gradient(90deg,#f43f5e,#e11d48);padding:12px 16px;text-align:center;color:white;font-weight:700;">${awayTeam} ${100-homeClutchPct}%</div>
            </div>
        </div>
        <div class="section"><div class="section-title">🔍 Puntos de Quiebre</div><div>${breakPointsHtml||'<div class="text-center text-gray-400 py-4">No se detectaron quiebres</div>'}</div></div>
        <div class="section"><div class="section-title">📖 Qué significan estos números</div><div>${interpretationsHtml||'<div class="text-center text-gray-400 py-4">Esperando datos...</div>'}</div></div>
        <div class="section"><div class="section-title">🎯 Qué cambiar para el próximo partido</div><div>${recommendationsHtml||'<div class="text-center text-gray-400 py-4">Esperando datos...</div>'}</div></div>
        <div class="section"><div class="section-title">⏱️ Timeline de Eventos Críticos</div><div>${timelineHtml||'<div class="text-center text-gray-400 py-8">Esperando más datos...</div>'}</div></div>
        <div class="section">
            <div class="section-title">🔵 ${homeTeam} - ESTADÍSTICAS INDIVIDUALES (Todos los sets)</div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;min-width:600px;">
                    <thead>
                        <tr>
                            <th>Jugador</th>
                            <th>PTS</th>
                            <th>ATA</th>
                            <th>BLO</th>
                            <th>ACE</th>
                            <th>ERR</th>
                            <th>ASIS</th>
                            <th>EFI%</th>
                            <th>📥 REC</th>
                            <th>REC%</th>
                            <th>🛡️ DEF</th>
                            <th>DEF%</th>
                            <th>🏐 SAQUE</th>
                            <th>❌ ERR SERV</th>
                            <th>📊 EFI SERV%</th>
                            <th>🏐 TOT SERV</th>
                        </tr>
                    </thead>
                    <tbody>${tablaLocal || '<tr><td colspan="16" style="text-align:center;padding:40px;">Sin datos</td></tr>'}</tbody>
                </table>
            </div>
        </div>
        <div class="section">
            <div class="section-title">🔴 ${awayTeam} - ESTADÍSTICAS INDIVIDUALES (Todos los sets)</div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;min-width:600px;">
                    <thead>
                        <tr>
                            <th>Jugador</th>
                            <th>PTS</th>
                            <th>ATA</th>
                            <th>BLO</th>
                            <th>ACE</th>
                            <th>ERR</th>
                            <th>ASIS</th>
                            <th>EFI%</th>
                            <th>📥 REC</th>
                            <th>REC%</th>
                            <th>🛡️ DEF</th>
                            <th>DEF%</th>
                            <th>🏐 SAQUE</th>
                            <th>❌ ERR SERV</th>
                            <th>📊 EFI SERV%</th>
                            <th>🏐 TOT SERV</th>
                        </tr>
                    </thead>
                    <tbody>${tablaVisitante || '<tr><td colspan="16" style="text-align:center;padding:40px;">Sin datos</td></tr>'}</tbody>
                </table>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 🆕 ROTACIONES - SECCIÓN INDEPENDIENTE -->
        <!-- ============================================================ -->
        ${rotacionesHtml || '<div class="section"><div class="section-title">🔄 EFICIENCIA POR ROTACIÓN</div><div class="text-center text-gray-400 py-4">No hay suficientes datos para calcular rotaciones</div></div>'}

        <!-- ============================================================ -->
        <!-- GLOSARIO -->
        <!-- ============================================================ -->
        <div class="glosario">
            <div class="glosario-title">📖 ¿QUÉ SIGNIFICAN ESTOS NÚMEROS?</div>
            
            <!-- 1. RACHA MÁXIMA -->
            <div class="glosario-item">
                <div class="glosario-numero">🔥</div>
                <div class="glosario-desc">
                    <strong>RACHA MÁXIMA</strong><br>
                    Puntos seguidos que hizo un equipo sin que el rival anote.<br>
                    <span style="color: #10b981;">✅ <strong>¿Qué significa?</strong> Si es >5, el equipo dominó momentos del partido.</span><br>
                    <span style="color: #f59e0b;">💡 <strong>¿Qué hacer si es bajo?</strong> Trabajar la consistencia y evitar errores no forzados.</span>
                </div>
            </div>
            
            <!-- 2. QUIEBRES -->
            <div class="glosario-item">
                <div class="glosario-numero">⚡</div>
                <div class="glosario-desc">
                    <strong>QUIEBRES (BREAKS)</strong><br>
                    Puntos que ganaste cuando el rival estaba sacando.<br>
                    <span style="color: #10b981;">✅ <strong>¿Qué significa?</strong> Si es >8, tu recepción y contraataque funcionan bien.</span><br>
                    <span style="color: #f59e0b;">💡 <strong>¿Qué hacer si es bajo?</strong> Mejorar la recepción de saque y la definición en contraataque.</span>
                </div>
            </div>
            
            <!-- 3. EFICIENCIA GENERAL -->
            <div class="glosario-item">
                <div class="glosario-numero">📊</div>
                <div class="glosario-desc">
                    <strong>EFICIENCIA GENERAL</strong><br>
                    Porcentaje de puntos que ganaste del total jugados.<br>
                    <span style="color: #10b981;">✅ <strong>¿Qué significa?</strong> >55% = dominaste | 45-55% = partido parejo | &lt;45% = te superaron.</span><br>
                    <span style="color: #f59e0b;">💡 <strong>¿Qué hacer si es baja?</strong> Reducir errores no forzados y mejorar la efectividad en ataque.</span>
                </div>
            </div>
            
            <!-- 4. CLUTCH (BAJO PRESIÓN) -->
            <div class="glosario-item">
                <div class="glosario-numero">🎭</div>
                <div class="glosario-desc">
                    <strong>RENDIMIENTO BAJO PRESIÓN (CLUTCH)</strong><br>
                    Porcentaje de puntos ganados en momentos clave (set point o diferencia ≤2).<br>
                    <span style="color: #10b981;">✅ <strong>¿Qué significa?</strong> >60% = fortaleza mental | &lt;40% = se achica bajo presión.</span><br>
                    <span style="color: #f59e0b;">💡 <strong>¿Qué hacer si es bajo?</strong> Entrenar definición de sets con marcador 20-20, 23-23, set point en contra.</span>
                </div>
            </div>
            
            <!-- 5. EFICIENCIA DE SERVICIO -->
            <div class="glosario-item">
                <div class="glosario-numero">🏐</div>
                <div class="glosario-desc">
                    <strong>EFICIENCIA DE SERVICIO</strong><br>
                    (Aces - Errores de saque) / Total de saques × 100.<br>
                    <span style="color: #10b981;">✅ <strong>¿Qué significa?</strong> >10% = excelente | 0% a 10% = regular | &lt;0% = muchos errores.</span><br>
                    <span style="color: #f59e0b;">💡 <strong>¿Qué hacer si es negativa?</strong> Priorizar efectividad sobre potencia. Sacar más seguro y bien colocado.</span>
                </div>
            </div>
            
            <!-- 6. SIDEOUT% -->
            <div class="glosario-item">
                <div class="glosario-numero">🔄</div>
                <div class="glosario-desc">
                    <strong>SIDEOUT%</strong><br>
                    Puntos que convertís cuando tenés el saque.<br>
                    <span style="color: #10b981;">✅ <strong>¿Qué significa?</strong> >60% = excelente | 45-60% = normal | &lt;45% = problema.</span><br>
                    <span style="color: #f59e0b;">💡 <strong>¿Qué hacer si es bajo?</strong> Mejorar la definición en ataque y reducir errores cuando se tiene el saque.</span>
                </div>
            </div>
            
            <!-- 7. BREAKPOINT% -->
            <div class="glosario-item">
                <div class="glosario-numero">⚡</div>
                <div class="glosario-desc">
                    <strong>BREAKPOINT%</strong><br>
                    Puntos que convertís cuando el rival tiene el saque.<br>
                    <span style="color: #10b981;">✅ <strong>¿Qué significa?</strong> >40% = excelente | 25-40% = normal | &lt;25% = problema.</span><br>
                    <span style="color: #f59e0b;">💡 <strong>¿Qué hacer si es bajo?</strong> Reforzar la recepción de saque y la transición ofensiva.</span>
                </div>
            </div>
            
            <!-- 8. FASES DEL SET -->
            <div class="glosario-item">
                <div class="glosario-numero">📈</div>
                <div class="glosario-desc">
                    <strong>FASES DEL SET</strong><br>
                    Rendimiento en diferentes momentos del set.<br>
                    <span style="color: #3b82f6;">🔵 <strong>Early</strong> (puntos 1-10): Arranque del set</span><br>
                    <span style="color: #8b5cf6;">🟣 <strong>Mid</strong> (puntos 11-20): Desarrollo del set</span><br>
                    <span style="color: #ef4444;">🔴 <strong>Late</strong> (puntos 21+): Cierre del set</span><br>
                    <span style="color: #f59e0b;">💡 <strong>¿Qué hacer?</strong> Si una fase es baja, trabajar específicamente esa parte del juego.</span>
                </div>
            </div>
        </div>
    </div>
    <script>
        const eficienciaData = ${JSON.stringify(eficienciaPorSet)};
        console.log('📊 Reporte - eficienciaData:', eficienciaData);

        if (eficienciaData.length > 0) {
            const canvas = document.getElementById('eficienciaPorSetChart');
            if (canvas) {
                new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: eficienciaData.map(function(d) { return d.set; }),
                        datasets: [
                            {
                                label: '${homeTeam}',
                                data: eficienciaData.map(function(d) { return parseFloat(d.local); }),
                                borderColor: '#3b82f6',
                                backgroundColor: 'rgba(59,130,246,0.1)',
                                borderWidth: 3,
                                fill: true,
                                tension: 0.3,
                                pointRadius: 5,
                                pointBackgroundColor: '#3b82f6'
                            },
                            {
                                label: '${awayTeam}',
                                data: eficienciaData.map(function(d) { return parseFloat(d.visitante); }),
                                borderColor: '#ef4444',
                                backgroundColor: 'rgba(239,68,68,0.1)',
                                borderWidth: 3,
                                fill: true,
                                tension: 0.3,
                                pointRadius: 5,
                                pointBackgroundColor: '#ef4444'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { labels: { color: '#fff' } },
                            tooltip: { callbacks: { label: function(context) { return context.dataset.label + ': ' + context.raw + '%'; } } }
                        },
                        scales: {
                            y: { ticks: { color: '#9ca3af', callback: function(v) { return v + '%'; } }, min: 0, max: 100, grid: { color: '#1f2937' } },
                            x: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } }
                        }
                    }
                });
            }
        }
        
        document.getElementById('btnDescargarPDF').addEventListener('click', function() {
            const element = document.querySelector('.container');
            const opt = {
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: 'reporte_${homeTeam}_vs_${awayTeam}.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
        });
    </script>
</body>
</html>`;
    }
}
