const logger = require('../utils/logger');

class StateProcessor {
    constructor() {
        this.lastState = null;
        this.homeRun = 0;
        this.awayRun = 0;
        this.breakPoints = new Map();
    }

    extractMatchState(apiData) {
        const setData = apiData.match.sets[apiData.match.currentSet - 1];
        if (!setData) throw new Error(`Set ${apiData.match.currentSet} not found`);
        return {
            set: apiData.match.currentSet,
            homeTeam: apiData.match.homeTeam?.name || 'LOCAL',
            awayTeam: apiData.match.awayTeam?.name || 'VISITANTE',
            homeScore: setData.homeTeamScore,
            awayScore: setData.awayTeamScore,
            serving: apiData.liveState?.serving === 'home' ? 'home' : 'away',
            totalPoints: setData.homeTeamScore + setData.awayTeamScore
        };
    }

    hasChanged(currentState) {
        return !this.lastState ||
            this.lastState.homeScore !== currentState.homeScore ||
            this.lastState.awayScore !== currentState.awayScore ||
            this.lastState.set !== currentState.set;
    }

    determineScorer(currentState) {
        if (!this.lastState) return null;
        if (currentState.homeScore > this.lastState.homeScore) return 'home';
        if (currentState.awayScore > this.lastState.awayScore) return 'away';
        return null;
    }

    updateRuns(scorer) {
        if (scorer === 'home') { this.homeRun++;
            this.awayRun = 0; } else if (scorer === 'away') { this.awayRun++;
            this.homeRun = 0; }
    }

    updateBreakPoints(scorer, serving) {
        const isBreak = scorer && ((scorer === 'home' && serving !== 'home') || (scorer === 'away' && serving !== 'away'));
        if (isBreak) {
            const key = scorer === 'home' ? 'home' : 'away';
            this.breakPoints.set(key, (this.breakPoints.get(key) || 0) + 1);
        }
    }

    calculatePhase(totalPoints) {
        if (totalPoints < 10) return 'EARLY';
        if (totalPoints < 20) return 'MID';
        return 'LATE';
    }

    determineEvent(scorer, serving) {
        if (!scorer) return 'POINT';
        const isHomeServing = serving === 'home';
        const isHomeScorer = scorer === 'home';
        if (isHomeServing && isHomeScorer) return 'SIDEOUT_HOME';
        if (!isHomeServing && !isHomeScorer) return 'SIDEOUT_AWAY';
        if (isHomeServing && !isHomeScorer) return 'BREAK_AWAY';
        return 'BREAK_HOME';
    }

    createSnapshot(currentState, scorer) {
        this.updateRuns(scorer);
        this.updateBreakPoints(scorer, currentState.serving);
        return {
            timestamp: new Date().toISOString(),
            set: currentState.set,
            homeTeam: currentState.homeTeam,
            awayTeam: currentState.awayTeam,
            homeScore: currentState.homeScore,
            awayScore: currentState.awayScore,
            scorer: scorer ? (scorer === 'home' ? 'HOME' : 'AWAY') : null,
            serving: currentState.serving === 'home' ? 'HOME' : 'AWAY',
            homeRun: this.homeRun,
            awayRun: this.awayRun,
            lead: currentState.homeScore - currentState.awayScore,
            phase: this.calculatePhase(currentState.totalPoints),
            event: this.determineEvent(scorer, currentState.serving)
        };
    }

    processUpdate(apiData) {
        const currentState = this.extractMatchState(apiData);
        if (!this.hasChanged(currentState)) return null;
        const snapshot = this.createSnapshot(currentState, this.determineScorer(currentState));
        logger.debug('State updated', { set: snapshot.set, score: `${snapshot.homeScore}-${snapshot.awayScore}`, scorer: snapshot.scorer });
        this.lastState = currentState;
        return snapshot;
    }

    getBreakPoints() {
        return { home: this.breakPoints.get('home') || 0, away: this.breakPoints.get('away') || 0 };
    }

    getMaxRuns() {
        return { home: this.homeRun, away: this.awayRun };
    }

    reset() {
        this.lastState = null;
        this.homeRun = 0;
        this.awayRun = 0;
        this.breakPoints.clear();
    }
}

module.exports = StateProcessor;