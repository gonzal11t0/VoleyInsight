const logger = require('../utils/logger');

class StateProcessor {
    constructor() {
        this.lastState = null;
        this.homeRun = 0;
        this.awayRun = 0;
        this.breakPoints = new Map();
        this.rotations = { home: 1, away: 1 };
        this.currentSet = null;
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
            serving: apiData.liveState?.serving === 'home'
                ? 'home'
                : apiData.liveState?.serving === 'away'
                    ? 'away'
                    : null,
            totalPoints: setData.homeTeamScore + setData.awayTeamScore
        };
    }

    hasChanged(currentState) {
        return !this.lastState ||
            this.lastState.homeScore !== currentState.homeScore ||
            this.lastState.awayScore !== currentState.awayScore ||
            this.lastState.set !== currentState.set ||
            this.lastState.serving !== currentState.serving;
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
        const isBreak = scorer && serving && ((scorer === 'home' && serving !== 'home') || (scorer === 'away' && serving !== 'away'));
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
        if (!scorer || !serving) return 'POINT';
        const isHomeServing = serving === 'home';
        const isHomeScorer = scorer === 'home';
        if (isHomeServing && isHomeScorer) return 'SIDEOUT_HOME';
        if (!isHomeServing && !isHomeScorer) return 'SIDEOUT_AWAY';
        if (isHomeServing && !isHomeScorer) return 'BREAK_AWAY';
        return 'BREAK_HOME';
    }

    rotateTeam(team) {
        if (team !== 'home' && team !== 'away') return;
        this.rotations[team] = (this.rotations[team] % 6) + 1;
    }

    createSnapshot(currentState, scorer, servingBefore) {
        this.updateRuns(scorer);
        this.updateBreakPoints(scorer, servingBefore);

        const rotationHomeBefore = this.rotations.home;
        const rotationAwayBefore = this.rotations.away;
        const isSideChange = scorer && servingBefore && scorer !== servingBefore;
        if (isSideChange) this.rotateTeam(scorer);

        const servingAfter = scorer || currentState.serving || servingBefore;
        const servingBeforeUpper = servingBefore ? servingBefore.toUpperCase() : null;
        const servingAfterUpper = servingAfter ? servingAfter.toUpperCase() : null;
        return {
            timestamp: new Date().toISOString(),
            set: currentState.set,
            homeTeam: currentState.homeTeam,
            awayTeam: currentState.awayTeam,
            homeScore: currentState.homeScore,
            awayScore: currentState.awayScore,
            scorer: scorer ? (scorer === 'home' ? 'HOME' : 'AWAY') : null,
            // `serving` conserva compatibilidad, pero ahora representa el saque
            // ANTES del rally. Metro devuelve el saque posterior al punto.
            serving: servingBeforeUpper,
            servingBefore: servingBeforeUpper,
            servingAfter: servingAfterUpper,
            homeRun: this.homeRun,
            awayRun: this.awayRun,
            lead: currentState.homeScore - currentState.awayScore,
            phase: this.calculatePhase(currentState.totalPoints),
            event: this.determineEvent(scorer, servingBefore),
            rotacionLocal: rotationHomeBefore,
            rotacionVisitante: rotationAwayBefore,
            equipoSacaba: servingBeforeUpper === 'HOME'
                ? 'LOCAL'
                : servingBeforeUpper === 'AWAY'
                    ? 'VISITANTE'
                    : null,
            rotacionLocalDespues: this.rotations.home,
            rotacionVisitanteDespues: this.rotations.away,
            equipoSacaDespues: servingAfterUpper === 'HOME'
                ? 'LOCAL'
                : servingAfterUpper === 'AWAY'
                    ? 'VISITANTE'
                    : null
        };
    }

    processUpdate(apiData) {
        const currentState = this.extractMatchState(apiData);
        if (!this.hasChanged(currentState)) return null;

        const setChanged = this.currentSet !== null && this.currentSet !== currentState.set;
        if (this.currentSet === null || setChanged) {
            this.rotations = { home: 1, away: 1 };
            this.currentSet = currentState.set;
        }

        const scorer = setChanged ? null : this.determineScorer(currentState);
        const servingBefore = setChanged
            ? currentState.serving
            : this.lastState?.serving || currentState.serving;
        const snapshot = this.createSnapshot(currentState, scorer, servingBefore);
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
        this.rotations = { home: 1, away: 1 };
        this.currentSet = null;
    }
}

module.exports = StateProcessor;
