// src/export/htmlExporter.js
const fs = require('fs').promises;
const path = require('path');
const PerformanceAnalyzer = require('../analytics/performanceAnalyzer');

class HTMLExporter {
    constructor(matchId, snapshots) {
        this.matchId = matchId;
        this.analyzer = new PerformanceAnalyzer(snapshots);
        this.report = this.analyzer.generateFullReport();
    }

    async generateHTML() {
        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Análisis Técnico - ${this.report.matchInfo.homeTeam} vs ${this.report.matchInfo.awayTeam}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header .score {
            font-size: 3em;
            font-weight: bold;
            margin: 20px 0;
        }
        .content { padding: 40px; }
        .section {
            margin-bottom: 40px;
            background: #f8f9fa;
            border-radius: 15px;
            padding: 25px;
            border-left: 5px solid #667eea;
        }
        .section h2 {
            color: #667eea;
            margin-bottom: 20px;
            font-size: 1.8em;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-card .value {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
        }
        .stat-card .label {
            color: #666;
            margin-top: 10px;
        }
        .insight {
            background: #fff3cd;
            border-left: 5px solid #ffc107;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
        }
        .recommendation {
            background: #d1ecf1;
            border-left: 5px solid #17a2b8;
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
        }
        .badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
        }
        .badge-home { background: #28a745; color: white; }
        .badge-away { background: #dc3545; color: white; }
        .progress-bar {
            background: #e0e0e0;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            background: #667eea;
            height: 30px;
            line-height: 30px;
            color: white;
            text-align: center;
            transition: width 0.3s;
        }
        .two-columns {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        @media (max-width: 768px) {
            .two-columns { grid-template-columns: 1fr; }
            .stats-grid { grid-template-columns: 1fr; }
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            border-top: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Análisis Técnico de Partido</h1>
            <div class="score">
                ${this.report.matchInfo.homeTeam} ${this.report.matchInfo.finalScore} ${this.report.matchInfo.awayTeam}
            </div>
            <p>Duración: ${this.report.matchInfo.totalDuration} | Total de puntos: ${this.report.matchInfo.totalPoints}</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>🎯 Eficiencia General</h2>
                <div class="two-columns">
                    <div class="stat-card">
                        <div class="value">${this.report.efficiency.overall.home}%</div>
                        <div class="label">${this.report.matchInfo.homeTeam}</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${this.report.efficiency.overall.home}%">
                                ${this.report.efficiency.overall.home}%
                            </div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="value">${this.report.efficiency.overall.away}%</div>
                        <div class="label">${this.report.matchInfo.awayTeam}</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${this.report.efficiency.overall.away}%">
                                ${this.report.efficiency.overall.away}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>📈 Métricas Clave</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="value">${this.report.efficiency.breaks.home}</div>
                        <div class="label">Breaks - ${this.report.matchInfo.homeTeam}</div>
                    </div>
                    <div class="stat-card">
                        <div class="value">${this.report.efficiency.breaks.away}</div>
                        <div class="label">Breaks - ${this.report.matchInfo.awayTeam}</div>
                    </div>
                    <div class="stat-card">
                        <div class="value">${this.report.efficiency.runs.homeMax}</div>
                        <div class="label">Racha Máxima - ${this.report.matchInfo.homeTeam}</div>
                    </div>
                    <div class="stat-card">
                        <div class="value">${this.report.efficiency.runs.awayMax}</div>
                        <div class="label">Racha Máxima - ${this.report.matchInfo.awayTeam}</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>⚡ Rendimiento Bajo Presión</h2>
                <div class="two-columns">
                    <div>
                        <h3>Alta Presión (puntos definitorios)</h3>
                        <div class="stat-card">
                            <div class="value">${this.report.pressure.pressureAnalysis.highPressure.homeEfficiency}%</div>
                            <div class="label">${this.report.matchInfo.homeTeam}</div>
                        </div>
                        <div class="stat-card">
                            <div class="value">${this.report.pressure.pressureAnalysis.highPressure.awayEfficiency}%</div>
                            <div class="label">${this.report.matchInfo.awayTeam}</div>
                        </div>
                    </div>
                    <div>
                        <h3>Baja Presión (puntos sin tensión)</h3>
                        <div class="stat-card">
                            <div class="value">${this.report.pressure.pressureAnalysis.lowPressure.homeEfficiency}%</div>
                            <div class="label">${this.report.matchInfo.homeTeam}</div>
                        </div>
                        <div class="stat-card">
                            <div class="value">${this.report.pressure.pressureAnalysis.lowPressure.awayEfficiency}%</div>
                            <div class="label">${this.report.matchInfo.awayTeam}</div>
                        </div>
                    </div>
                </div>
                <div class="insight">
                    <strong>💡 Análisis:</strong> ${this.report.pressure.conclusion}
                </div>
            </div>
            
            <div class="section">
                <h2>💡 Insights Clave</h2>
                ${this.report.keyInsights.map(insight => `
                    <div class="insight">${insight}</div>
                `).join('')}
                ${this.report.keyInsights.length === 0 ? '<p>No se detectaron insights significativos en este partido.</p>' : ''}
            </div>
            
            <div class="section">
                <h2>🎯 Recomendaciones Tácticas</h2>
                ${this.report.recommendations.map(rec => `
                    <div class="recommendation">📌 ${rec}</div>
                `).join('')}
                ${this.report.recommendations.length === 0 ? '<p>No hay recomendaciones específicas para este partido.</p>' : ''}
            </div>
            
            <div class="section">
                <h2>🔄 Cambios de Momentum</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="value">${this.report.momentum.totalSwings}</div>
                        <div class="label">Total de Cambios de Dominancia</div>
                    </div>
                    ${this.report.momentum.biggestSwing ? `
                        <div class="stat-card">
                            <div class="value">Punto ${this.report.momentum.biggestSwing.point}</div>
                            <div class="label">Mayor Cambio de Momentum</div>
                            <small>Magnitud: ${this.report.momentum.biggestSwing.swingMagnitude}</small>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="section">
                <h2>🔍 Patrones Detectados</h2>
                ${this.report.patterns.closeGames.length > 0 ? `
                    <div class="insight">
                        <strong>🎯 Puntos Cerrados:</strong> ${this.report.patterns.closeGames.length} puntos con diferencia de 1
                    </div>
                ` : ''}
                ${this.report.patterns.afterRun.length > 0 ? `
                    <div class="insight">
                        <strong>🔄 Recuperaciones:</strong> ${this.report.patterns.afterRun.length} veces que un equipo respondió después de una racha rival
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div class="footer">
            <p>Reporte generado automáticamente por VoleyInsight v2.9</p>
            <p>Fecha: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
    `;

        const outputPath = path.join('./data', `report_${this.matchId}.html`);
        await fs.writeFile(outputPath, html, 'utf-8');
        return outputPath;
    }
}

module.exports = HTMLExporter;
