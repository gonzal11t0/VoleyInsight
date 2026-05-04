// src/live/liveMonitor.js
const fs = require('fs').promises;
const path = require('path');

class LiveMonitor {
  constructor(matchId, snapshots) {
    this.matchId = matchId;
    this.snapshots = snapshots;
    this.lastUpdate = null;
  }

  async update() {
    const report = this.generateLiveReport();
    const outputPath = path.join('./data', `live_${this.matchId}.json`);
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    return report;
  }

  generateLiveReport() {
    if (this.snapshots.length === 0) return null;
    
    const last = this.snapshots[this.snapshots.length - 1];
    const last10 = this.snapshots.slice(-10);
    const homeLast10 = last10.filter(s => s.scorer === 'HOME').length;
    const awayLast10 = last10.filter(s => s.scorer === 'AWAY').length;
    
    // Momentum actual (últimos 5 puntos)
    const last5 = this.snapshots.slice(-5);
    const homeLast5 = last5.filter(s => s.scorer === 'HOME').length;
    const awayLast5 = last5.filter(s => s.scorer === 'AWAY').length;
    const currentMomentum = homeLast5 - awayLast5;
    
    return {
      timestamp: new Date().toISOString(),
      currentSet: last.set,
      currentScore: { home: last.homeScore, away: last.awayScore },
      currentRun: { home: last.homeRun, away: last.awayRun },
      currentMomentum: currentMomentum,
      momentumText: currentMomentum > 1 ? '🔥 LOCAL DOMINA' : 
                     currentMomentum < -1 ? '⚡ VISITANTE DOMINA' : '⚖️ EQUILIBRADO',
      last10Dominance: {
        home: homeLast10,
        away: awayLast10,
        dominant: homeLast10 > awayLast10 ? 'LOCAL' : awayLast10 > homeLast10 ? 'VISITANTE' : 'NEUTRAL'
      },
      totalPoints: this.snapshots.length,
      breaksToday: this.snapshots.filter(s => s.event.includes('BREAK')).length
    };
  }
}

module.exports = LiveMonitor;