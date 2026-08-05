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
        const currentSet = Number(apiData.match.currentSet) || 1;
        const setData = apiData.match.sets[currentSet - 1];
        if (!setData) throw new Error(`Set ${currentSet} not found`);
        const homeScore = Number(setData.homeTeamScore) || 0;
        const awayScore = Number(setData.awayTeamScore) || 0;
        return {
            set: currentSet,
            homeTeam: apiData.match.homeTeam?.name || 'LOCAL',
            awayTeam: apiData.match.awayTeam?.name || 'VISITANTE',
            homeScore,
            awayScore,
            serving: apiData.liveState?.serving === 'home'
                ? 'home'
                : apiData.liveState?.serving === 'away'
                    ? 'away'
                    : null,
            totalPoints: homeScore + awayScore
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
        const isBreak = scorer && serving && scorer === serving;
        if (isBreak) {
            const key = scorer === 'home' ? 'home' : 'away';
            this.breakPoints.set(key, (this.breakPoints.get(key) || 0) + 1);
        }
    }

    calculatePhase(totalPoints) {
        if (totalPoints <= 10) return 'EARLY';
        if (totalPoints <= 20) return 'MID';
        return 'LATE';
    }

    determineEvent(scorer, serving) {
        if (!scorer || !serving) return 'POINT';
        const isHomeServing = serving === 'home';
        const isHomeScorer = scorer === 'home';
        if (isHomeServing && isHomeScorer) return 'BREAK_HOME';
        if (!isHomeServing && !isHomeScorer) return 'BREAK_AWAY';
        if (isHomeServing && !isHomeScorer) return 'SIDEOUT_AWAY';
        return 'SIDEOUT_HOME';
    }

    rotateTeam(team) {
        if (team !== 'home' && team !== 'away') return;
        this.rotations[team] = (this.rotations[team] % 6) + 1;
    }

    createSnapshot(currentState, scorer, servingBefore, metadata = {}) {
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
            timestamp: metadata.timestamp || new Date().toISOString(),
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
                    : null,
            origenPunto: metadata.source || (scorer ? 'score_delta' : 'estado_api'),
            metroEventId: metadata.eventId ? String(metadata.eventId) : null
        };
    }

    extractTimeline(apiData) {
        const timelines = [apiData?.timeline, apiData?.liveState?.timeline]
            .filter(Array.isArray);
        const eventsById = new Map();

        for (const event of timelines.flat()) {
            const key = event?.id != null
                ? String(event.id)
                : `${event?.type || 'EVENT'}:${event?.timestamp || ''}:${JSON.stringify(event?.score || {})}`;
            eventsById.set(key, event);
        }

        return [...eventsById.values()];
    }

    resolveTimelineSequence(apiData, previousState, currentState) {
        const events = this.extractTimeline(apiData)
            .filter(event =>
                event?.type === 'SCORE_POINT' &&
                event?.undone !== true &&
                Number(event?.setNumber || currentState.set) === currentState.set &&
                Number.isFinite(Number(event?.score?.home)) &&
                Number.isFinite(Number(event?.score?.away))
            )
            .sort((a, b) => {
                const timeDiff = Date.parse(a.timestamp || 0) - Date.parse(b.timestamp || 0);
                if (timeDiff) return timeDiff;
                return Number(a.id || 0) - Number(b.id || 0);
            });

        let expectedHome = previousState.homeScore;
        let expectedAway = previousState.awayScore;
        const previousTotal = expectedHome + expectedAway;
        const currentTotal = currentState.homeScore + currentState.awayScore;
        const sequence = [];

        for (const event of events) {
            const homeScore = Number(event.score.home);
            const awayScore = Number(event.score.away);
            const total = homeScore + awayScore;
            if (total <= previousTotal || total > currentTotal) continue;

            let scorer = null;
            if (homeScore === expectedHome + 1 && awayScore === expectedAway) scorer = 'home';
            if (awayScore === expectedAway + 1 && homeScore === expectedHome) scorer = 'away';
            if (!scorer) continue;

            sequence.push({
                scorer,
                homeScore,
                awayScore,
                timestamp: event.timestamp || null,
                eventId: event.id ?? null,
                source: 'metro_timeline'
            });
            expectedHome = homeScore;
            expectedAway = awayScore;
        }

        const expectedLength = currentTotal - previousTotal;
        if (
            sequence.length !== expectedLength ||
            expectedHome !== currentState.homeScore ||
            expectedAway !== currentState.awayScore
        ) {
            return null;
        }

        return sequence;
    }

    resolveScoreSequence(apiData, previousState, currentState) {
        const deltaHome = currentState.homeScore - previousState.homeScore;
        const deltaAway = currentState.awayScore - previousState.awayScore;
        if (deltaHome < 0 || deltaAway < 0) return null;

        const deltaTotal = deltaHome + deltaAway;
        if (deltaTotal === 0) return [];

        const timelineSequence = this.resolveTimelineSequence(apiData, previousState, currentState);
        if (timelineSequence) return timelineSequence;

        // Si todos los puntos fueron del mismo equipo, el orden es inequívoco
        // aunque Metro ya no incluya esos eventos en su timeline.
        if (deltaHome > 0 && deltaAway === 0) {
            return Array.from({ length: deltaHome }, (_, index) => ({
                scorer: 'home',
                homeScore: previousState.homeScore + index + 1,
                awayScore: previousState.awayScore,
                timestamp: null,
                eventId: null,
                source: deltaHome > 1 ? 'score_gap_same_team' : 'score_delta'
            }));
        }
        if (deltaAway > 0 && deltaHome === 0) {
            return Array.from({ length: deltaAway }, (_, index) => ({
                scorer: 'away',
                homeScore: previousState.homeScore,
                awayScore: previousState.awayScore + index + 1,
                timestamp: null,
                eventId: null,
                source: deltaAway > 1 ? 'score_gap_same_team' : 'score_delta'
            }));
        }

        // Si subieron los dos equipos y la timeline no permite reconstruir el
        // orden, no inventamos rallies ni rotaciones.
        return null;
    }

    createAmbiguousGapSnapshot(currentState, servingBefore, previousState) {
        const snapshot = this.createSnapshot(currentState, null, servingBefore, {
            source: 'score_gap_ambiguous'
        });
        snapshot.event = 'SCORE_GAP_AMBIGUOUS';
        snapshot.sincronizacionOficial = 'ambigua';
        snapshot.scoreGap = {
            home: currentState.homeScore - previousState.homeScore,
            away: currentState.awayScore - previousState.awayScore,
            total: currentState.totalPoints - previousState.totalPoints
        };
        return snapshot;
    }

    processUpdates(apiData) {
        const currentState = this.extractMatchState(apiData);
        if (!this.hasChanged(currentState)) return [];

        const setChanged = this.currentSet !== null && this.currentSet !== currentState.set;
        if (this.currentSet === null || setChanged) {
            this.rotations = { home: 1, away: 1 };
            this.currentSet = currentState.set;
        }

        if (!this.lastState || setChanged) {
            const snapshot = this.createSnapshot(currentState, null, currentState.serving);
            logger.debug('State updated', { set: snapshot.set, score: `${snapshot.homeScore}-${snapshot.awayScore}`, scorer: null });
            this.lastState = currentState;
            return [snapshot];
        }

        const previousState = this.lastState;
        const servingBefore = previousState.serving || currentState.serving;
        const scoreChanged =
            previousState.homeScore !== currentState.homeScore ||
            previousState.awayScore !== currentState.awayScore;

        if (!scoreChanged) {
            const snapshot = this.createSnapshot(currentState, null, servingBefore);
            this.lastState = currentState;
            return [snapshot];
        }

        const sequence = this.resolveScoreSequence(apiData, previousState, currentState);
        if (!sequence) {
            const snapshot = this.createAmbiguousGapSnapshot(currentState, servingBefore, previousState);
            logger.warn('No se pudo reconstruir el orden de un salto de marcador', {
                set: currentState.set,
                from: `${previousState.homeScore}-${previousState.awayScore}`,
                to: `${currentState.homeScore}-${currentState.awayScore}`
            });
            this.lastState = currentState;
            return [snapshot];
        }

        const snapshots = [];
        let serving = servingBefore;
        for (const point of sequence) {
            const intermediateState = {
                ...currentState,
                homeScore: point.homeScore,
                awayScore: point.awayScore,
                totalPoints: point.homeScore + point.awayScore,
                serving: point.scorer
            };
            const snapshot = this.createSnapshot(intermediateState, point.scorer, serving, point);
            snapshots.push(snapshot);
            serving = point.scorer;
            logger.debug('State updated', {
                set: snapshot.set,
                score: `${snapshot.homeScore}-${snapshot.awayScore}`,
                scorer: snapshot.scorer,
                source: snapshot.origenPunto
            });
        }

        this.lastState = currentState;
        return snapshots;
    }

    // Compatibilidad para consumidores antiguos: en una actualización con
    // varios rallies devuelve el último. El tracker usa processUpdates().
    processUpdate(apiData) {
        const snapshots = this.processUpdates(apiData);
        return snapshots.length ? snapshots[snapshots.length - 1] : null;
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
