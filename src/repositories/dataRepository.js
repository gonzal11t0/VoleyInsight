const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const {
    readJsonRecoverable,
    writeJsonAtomic,
    writeTextAtomic
} = require('../utils/atomicFile');

class DataRepository {
    static contarPuntosReales(snapshots) {
        return (Array.isArray(snapshots) ? snapshots : [])
            .filter(snapshot => snapshot?.scorer === 'HOME' || snapshot?.scorer === 'AWAY')
            .length;
    }

    constructor(matchId, outputDir = './data') {
        this.matchId = matchId;
        this.outputDir = outputDir;
        this.snapshots = [];
    }

    static parseCSVLine(line = '') {
        const values = [];
        let value = '';
        let quoted = false;
        for (let index = 0; index < line.length; index++) {
            const char = line[index];
            if (char === '"') {
                if (quoted && line[index + 1] === '"') {
                    value += '"';
                    index += 1;
                } else {
                    quoted = !quoted;
                }
            } else if (char === ',' && !quoted) {
                values.push(value);
                value = '';
            } else {
                value += char;
            }
        }
        values.push(value);
        return values;
    }

    static parseCSV(content = '') {
        const lines = String(content).split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) return [];
        const headers = DataRepository.parseCSVLine(lines[0]);
        const numberFields = new Set(['set', 'home_score', 'away_score', 'home_run', 'away_run', 'lead']);
        return lines.slice(1).map(line => {
            const values = DataRepository.parseCSVLine(line);
            const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
            for (const field of numberFields) row[field] = Number(row[field]) || 0;
            return {
                timestamp: row.timestamp || null,
                set: row.set || 1,
                homeTeam: row.home_team || 'LOCAL',
                awayTeam: row.away_team || 'VISITANTE',
                homeScore: row.home_score,
                awayScore: row.away_score,
                scorer: row.scorer || null,
                serving: row.serving || null,
                homeRun: row.home_run,
                awayRun: row.away_run,
                lead: row.lead,
                phase: row.phase || null,
                event: row.event || 'POINT',
                origenPunto: 'csv_preservado'
            };
        });
    }

    static snapshotKey(snapshot = {}) {
        if (snapshot.metroEventId != null) return `metro:${snapshot.metroEventId}`;
        return [
            Number(snapshot.set) || 1,
            Number(snapshot.homeScore) || 0,
            Number(snapshot.awayScore) || 0,
            snapshot.scorer || '',
            snapshot.event || ''
        ].join('|');
    }

    static mergePreservedHistory(primary = [], csv = []) {
        const current = Array.isArray(primary) ? primary : [];
        const preserved = Array.isArray(csv) ? csv : [];
        if (!preserved.length) return [...current];
        if (!current.length) return [...preserved];

        const setsPrimary = new Map();
        for (const snapshot of current) {
            const set = Number(snapshot?.set) || 1;
            if (!setsPrimary.has(set)) setsPrimary.set(set, []);
            setsPrimary.get(set).push(snapshot);
        }

        const additions = [];
        for (const snapshot of preserved) {
            const set = Number(snapshot?.set) || 1;
            const sameSet = setsPrimary.get(set) || [];
            if (!sameSet.length) {
                additions.push(snapshot);
                continue;
            }

            const pointTotals = sameSet
                .filter(item => item?.scorer === 'HOME' || item?.scorer === 'AWAY')
                .map(item => (Number(item.homeScore) || 0) + (Number(item.awayScore) || 0));
            const positiveTotals = sameSet
                .map(item => (Number(item.homeScore) || 0) + (Number(item.awayScore) || 0))
                .filter(total => total > 0);
            const firstKnownPoint = pointTotals.length
                ? Math.min(...pointTotals)
                : positiveTotals.length
                    ? Math.min(...positiveTotals)
                    : Infinity;
            const total = (Number(snapshot.homeScore) || 0) + (Number(snapshot.awayScore) || 0);
            if (total < firstKnownPoint) additions.push(snapshot);
        }

        const byKey = new Map();
        for (const snapshot of [...additions, ...current]) {
            const key = DataRepository.snapshotKey(snapshot);
            const existing = byKey.get(key);
            // El JSON principal conserva más campos que el CSV para un mismo rally.
            if (!existing || Object.keys(snapshot).length >= Object.keys(existing).length) {
                byKey.set(key, snapshot);
            }
        }
        return [...byKey.values()].sort((a, b) => {
            const setDiff = (Number(a.set) || 1) - (Number(b.set) || 1);
            if (setDiff) return setDiff;
            const totalDiff = ((Number(a.homeScore) || 0) + (Number(a.awayScore) || 0))
                - ((Number(b.homeScore) || 0) + (Number(b.awayScore) || 0));
            if (totalDiff) return totalDiff;
            return Date.parse(a.timestamp || 0) - Date.parse(b.timestamp || 0);
        });
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
        const key = DataRepository.snapshotKey(snapshot);
        const duplicate = this.snapshots.some(item => DataRepository.snapshotKey(item) === key);
        if (!duplicate) this.snapshots.push(snapshot);
    }

    async loadJSON() {
        await this.ensureOutputDir();
        const filename = path.join(this.outputDir, `match_${this.matchId}.json`);
        const csvFilename = path.join(this.outputDir, `match_${this.matchId}.csv`);
        const loaded = await readJsonRecoverable(filename, {
            fallback: [],
            validate: Array.isArray
        });
        let csvSnapshots = [];
        try {
            csvSnapshots = DataRepository.parseCSV(await fs.readFile(csvFilename, 'utf-8'));
        } catch (error) {
            if (error.code !== 'ENOENT') logger.warn('No se pudo leer el respaldo CSV', { filename: csvFilename, error: error.message });
        }

        this.snapshots = DataRepository.mergePreservedHistory(loaded.data, csvSnapshots);
        if (loaded.recovered || this.snapshots.length > loaded.data.length) {
            await writeJsonAtomic(filename, this.snapshots, { validate: Array.isArray });
            logger.warn('Historial oficial recuperado desde respaldo', {
                filename,
                source: loaded.recovered ? 'json_bak' : 'csv',
                records: this.snapshots.length
            });
        }
        return this.getSnapshots();
    }

    applyCorrections(corrections) {
        const applied = [];
        for (const correction of Array.isArray(corrections) ? corrections : []) {
            let index = -1;
            if (correction?.undoneEventId) {
                index = this.snapshots.findIndex(snapshot =>
                    snapshot?.metroEventId != null &&
                    String(snapshot.metroEventId) === String(correction.undoneEventId)
                );
            }
            if (index < 0) {
                index = this.snapshots.findIndex(snapshot => {
                    const sameSet = Number(snapshot?.set) === Number(correction?.set);
                    const sameScore =
                        Number(snapshot?.homeScore) === Number(correction?.originalScore?.home) &&
                        Number(snapshot?.awayScore) === Number(correction?.originalScore?.away);
                    const sameScorer = !correction?.scorer ||
                        snapshot?.scorer === correction.scorer.toUpperCase();
                    return sameSet && sameScore && sameScorer;
                });
            }
            if (index < 0) continue;

            const removed = this.snapshots.splice(index);
            applied.push({ correction, removed });
        }
        return {
            applied,
            removedCount: applied.reduce((total, item) => total + item.removed.length, 0)
        };
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
            await writeJsonAtomic(filename, this.snapshots, { validate: Array.isArray });
            logger.info('JSON saved', { filename });
        } catch (error) {
            logger.error('Error saving JSON:', { error: error.message });
            throw error;
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
            await writeTextAtomic(filename, `${content}\n`);
            logger.info('CSV saved', { filename, records: this.snapshots.length });
        } catch (error) {
            logger.error('Error saving CSV:', { error: error.message });
            throw error;
        }
    }

    async saveAnalysis() {
        try {
            if (this.snapshots.length === 0) return;
            const filename = path.join(this.outputDir, `analysis_${this.matchId}.json`);
            const analysis = {
                matchId: this.matchId,
                totalPoints: DataRepository.contarPuntosReales(this.snapshots),
                lastUpdate: new Date().toISOString()
            };
            await writeJsonAtomic(filename, analysis);
            logger.info('Analysis saved', { filename });
        } catch (error) {
            logger.error('Error saving analysis:', { error: error.message });
            throw error;
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
