const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class DataRepository {
    constructor(matchId, outputDir = './data') {
        this.matchId = matchId;
        this.outputDir = outputDir;
        this.snapshots = [];
    }

    async ensureOutputDir() {
        try {
            await fs.access(this.outputDir);
        } catch {
            await fs.mkdir(this.outputDir, { recursive: true });
            logger.debug('Created output directory', { dir: this.outputDir });
        }
    }

    addSnapshot(snapshot) {
        this.snapshots.push(snapshot);
    }

    getSnapshots() {
        return [...this.snapshots];
    }

    getLastSnapshot() {
        return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
    }

    async saveJSON() {
        try {
            if (this.snapshots.length === 0) return;
            await this.ensureOutputDir();
            const filename = path.join(this.outputDir, `match_${this.matchId}.json`);
            await fs.writeFile(filename, JSON.stringify(this.snapshots, null, 2), 'utf-8');
            logger.info('JSON saved', { filename });
        } catch (error) {
            logger.error('Error saving JSON:', { error: error.message });
        }
    }

    async saveCSV() {
        try {
            if (this.snapshots.length === 0) return;
            await this.ensureOutputDir();
            const headers = ['timestamp', 'set', 'home_team', 'away_team', 'home_score', 'away_score', 'scorer', 'serving', 'home_run', 'away_run', 'lead', 'phase', 'event'];
            const rows = this.snapshots.map(s => [
                s.timestamp, s.set, s.homeTeam, s.awayTeam,
                s.homeScore, s.awayScore, s.scorer || '', s.serving,
                s.homeRun, s.awayRun, s.lead, s.phase, s.event
            ].map(v => String(v).includes(',') ? `"${v}"` : v).join(','));
            const content = [headers.join(','), ...rows].join('\n');
            const filename = path.join(this.outputDir, `match_${this.matchId}.csv`);
            await fs.writeFile(filename, content, 'utf-8');
            logger.info('CSV saved', { filename, records: this.snapshots.length });
        } catch (error) {
            logger.error('Error saving CSV:', { error: error.message });
        }
    }

    async saveAnalysis() {
        try {
            if (this.snapshots.length === 0) return;
            const filename = path.join(this.outputDir, `analysis_${this.matchId}.json`);
            const analysis = {
                matchId: this.matchId,
                totalPoints: this.snapshots.length,
                lastUpdate: new Date().toISOString()
            };
            await fs.writeFile(filename, JSON.stringify(analysis, null, 2), 'utf-8');
            logger.info('Analysis saved', { filename });
        } catch (error) {
            logger.error('Error saving analysis:', { error: error.message });
        }
    }

    getStats() {
        const breaks = { home: 0, away: 0 };
        let maxHomeRun = 0;
        let maxAwayRun = 0;
        for (const s of this.snapshots) {
            if (s.event === 'BREAK_HOME') breaks.home++;
            if (s.event === 'BREAK_AWAY') breaks.away++;
            maxHomeRun = Math.max(maxHomeRun, s.homeRun);
            maxAwayRun = Math.max(maxAwayRun, s.awayRun);
        }
        const momentum = this.calculateMomentum();
        return {
            breaks,
            maxRuns: { home: maxHomeRun, away: maxAwayRun },
            momentum,
            totalEvents: this.snapshots.length
        };
    }

    calculateMomentum() {
        if (this.snapshots.length < 5) return null;
        const last10 = this.snapshots.slice(-10);
        const homePoints = last10.filter(s => s.scorer === 'HOME').length;
        const awayPoints = last10.filter(s => s.scorer === 'AWAY').length;
        if (homePoints > awayPoints + 2) return 'HOME_DOMINANT';
        if (awayPoints > homePoints + 2) return 'AWAY_DOMINANT';
        if (homePoints > awayPoints) return 'HOME_MOMENTUM';
        if (awayPoints > homePoints) return 'AWAY_MOMENTUM';
        return 'NEUTRAL';
    }

    getFinalScore() {
        if (this.snapshots.length === 0) return null;
        const last = this.snapshots[this.snapshots.length - 1];
        return {
            home: last.homeScore,
            away: last.awayScore,
            set: last.set
        };
    }

    escapeCSV(value) {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }

    clear() {
        this.snapshots = [];
    }
}

module.exports = DataRepository;