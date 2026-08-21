const crypto = require('crypto');

const POINT_ACTIONS = new Set(['ATAQUE', 'BLOQUEO', 'SAQUE', 'ACE', 'SAQUE MALO', 'ERROR', 'EQUIPO']);
const VALID_TEAMS = new Set(['LOCAL', 'VISITANTE']);

function normalizarEquipo(value) {
    const team = String(value || '').trim().toUpperCase();
    if (['HOME', 'LOCAL'].includes(team)) return 'LOCAL';
    if (['AWAY', 'VISITA', 'VISITANTE'].includes(team)) return 'VISITANTE';
    return null;
}

function normalizarAccion(value, fallback = 'EQUIPO') {
    const action = String(value || '').trim().toUpperCase();
    if (!action) return fallback;
    return action === 'SAQUE BUENO' ? 'SAQUE' : action;
}

function parseScore(value) {
    const match = String(value || '').match(/^\s*(\d+)\s*[-:]\s*(\d+)\s*$/);
    return match ? { home: Number(match[1]), away: Number(match[2]) } : null;
}

function scoreString(home, away) {
    return `${Number(home) || 0}-${Number(away) || 0}`;
}

function isPointEvent(event = {}) {
    return Boolean(normalizarEquipo(event.equipoAnota))
        || POINT_ACTIONS.has(normalizarAccion(event.accion, ''));
}

function activeEvents(events = []) {
    return (Array.isArray(events) ? events : []).filter(event => event?.status !== 'voided');
}

function eventDedupeKey(event = {}) {
    const after = parseScore(event.marcadorDespues);
    return [
        Number(event.matchId) || '',
        Number(event.set) || 1,
        after ? scoreString(after.home, after.away) : String(event.marcadorDespues || ''),
        normalizarEquipo(event.equipoAnota) || '',
        normalizarAccion(event.accion, ''),
        Number(event.jugador) || 0
    ].join('|');
}

function normalizeEvent(event = {}, { matchId, source = 'manual', now = new Date().toISOString() } = {}) {
    const normalized = {
        ...event,
        eventId: String(event.eventId || crypto.randomUUID()),
        matchId: Number(event.matchId || matchId) || null,
        set: Math.max(1, Number(event.set) || 1),
        equipoAnota: normalizarEquipo(event.equipoAnota),
        equipo: normalizarEquipo(event.equipo) || normalizarEquipo(event.equipoAnota),
        accion: normalizarAccion(event.accion, event.equipoAnota ? 'EQUIPO' : ''),
        jugador: Number(event.jugador) > 0 ? Number(event.jugador) : null,
        source: String(event.source || source),
        status: event.status === 'voided' ? 'voided' : 'active',
        createdAt: event.createdAt || event.timestamp || now,
        updatedAt: event.updatedAt || now,
        timestamp: event.timestamp || event.createdAt || now,
        revision: Math.max(1, Number(event.revision) || 1),
        revisionHistory: Array.isArray(event.revisionHistory) ? event.revisionHistory : []
    };
    if (!normalized.equipoAnota) delete normalized.equipoAnota;
    if (!normalized.equipo) delete normalized.equipo;
    if (!normalized.accion) delete normalized.accion;
    return normalized;
}

function normalizeLegacyEvents(events = [], options = {}) {
    return (Array.isArray(events) ? events : []).map(event => normalizeEvent(event, options));
}

function appendEvent(events = [], input = {}, options = {}) {
    const normalized = normalizeEvent(input, options);
    const normalizedScore = parseScore(normalized.marcadorDespues);
    const duplicate = activeEvents(events).find(event => {
        if (isPointEvent(normalized) && isPointEvent(event) && normalizedScore) {
            const existingScore = parseScore(event.marcadorDespues);
            return existingScore
                && Number(event.set) === Number(normalized.set)
                && Number(event.matchId || options.matchId) === Number(normalized.matchId || options.matchId)
                && scoreString(existingScore.home, existingScore.away) === scoreString(normalizedScore.home, normalizedScore.away);
        }
        return eventDedupeKey(event) === eventDedupeKey(normalized);
    });
    if (duplicate && isPointEvent(normalized)) {
        return { events, event: duplicate, duplicate: true };
    }
    return { events: [...events, normalized], event: normalized, duplicate: false };
}

function updateEvent(events = [], eventId, patch = {}, { actor = 'operator', now = new Date().toISOString() } = {}) {
    let updated = null;
    const next = events.map(event => {
        if (String(event.eventId) !== String(eventId)) return event;
        const snapshot = {
            revision: Number(event.revision) || 1,
            updatedAt: event.updatedAt || event.timestamp || now,
            actor,
            data: { ...event, revisionHistory: undefined }
        };
        updated = normalizeEvent({
            ...event,
            ...patch,
            eventId: event.eventId,
            createdAt: event.createdAt,
            updatedAt: now,
            revision: (Number(event.revision) || 1) + 1,
            revisionHistory: [...(event.revisionHistory || []), snapshot]
        }, { matchId: event.matchId, source: event.source, now });
        return updated;
    });
    return { events: next, event: updated, found: Boolean(updated) };
}

function voidEvent(events = [], eventId, options = {}) {
    return updateEvent(events, eventId, { status: 'voided', voidedAt: options.now || new Date().toISOString() }, options);
}

function lastManualScore(events = [], set = null) {
    const candidates = activeEvents(events)
        .filter(isPointEvent)
        .filter(event => !set || Number(event.set) === Number(set))
        .map(event => ({ event, score: parseScore(event.marcadorDespues) }))
        .filter(item => item.score);
    return candidates.reduce((highest, item) => {
        const total = item.score.home + item.score.away;
        const highestTotal = highest.home + highest.away;
        return total > highestTotal ? item.score : highest;
    }, { home: 0, away: 0 });
}

function scoreKey(score = {}) {
    return `${Number(score.home) || 0}-${Number(score.away) || 0}`;
}

function officialHistory(snapshots = [], set = 1) {
    const points = [];
    const gaps = [];
    let previous = { home: 0, away: 0 };
    const officialSnapshots = (Array.isArray(snapshots) ? snapshots : [])
        .filter(snapshot => Number(snapshot?.set) === Number(set))
        .filter(snapshot => Number.isFinite(Number(snapshot?.homeScore)) && Number.isFinite(Number(snapshot?.awayScore)));

    const addPoint = (team, before, after, snapshot) => points.push({
        team,
        before: { ...before },
        after: { ...after },
        timestamp: snapshot?.timestamp || null,
        metroEventId: snapshot?.metroEventId ?? null,
        rotacionLocal: snapshot?.rotacionLocal ?? null,
        rotacionVisitante: snapshot?.rotacionVisitante ?? null,
        rotacionLocalDespues: snapshot?.rotacionLocalDespues ?? null,
        rotacionVisitanteDespues: snapshot?.rotacionVisitanteDespues ?? null,
        equipoSacaba: snapshot?.equipoSacaba ?? null,
        equipoSacaDespues: snapshot?.equipoSacaDespues ?? null
    });

    for (const snapshot of officialSnapshots) {
        const current = {
            home: Number(snapshot.homeScore) || 0,
            away: Number(snapshot.awayScore) || 0
        };
        const deltaHome = current.home - previous.home;
        const deltaAway = current.away - previous.away;
        if (deltaHome === 1 && deltaAway === 0) {
            addPoint('LOCAL', previous, current, snapshot);
        } else if (deltaAway === 1 && deltaHome === 0) {
            addPoint('VISITANTE', previous, current, snapshot);
        } else if (deltaHome > 1 && deltaAway === 0) {
            let before = { ...previous };
            for (let index = 0; index < deltaHome; index++) {
                const after = { home: before.home + 1, away: before.away };
                addPoint('LOCAL', before, after, snapshot);
                before = after;
            }
        } else if (deltaAway > 1 && deltaHome === 0) {
            let before = { ...previous };
            for (let index = 0; index < deltaAway; index++) {
                const after = { home: before.home, away: before.away + 1 };
                addPoint('VISITANTE', before, after, snapshot);
                before = after;
            }
        } else if (deltaHome !== 0 || deltaAway !== 0) {
            gaps.push({ before: { ...previous }, after: { ...current } });
        }
        previous = current;
    }

    const officialScore = officialSnapshots.length ? previous : { home: 0, away: 0 };
    const expected = officialScore.home + officialScore.away;
    const unique = new Set(points.map(point => scoreKey(point.after)));
    const available = expected > 0 || points.length > 0;
    const complete = available && gaps.length === 0 && points.length === expected && unique.size === expected;
    return {
        available,
        complete,
        score: officialScore,
        expected,
        transitions: points,
        gaps
    };
}

function officialPointTransitions(snapshots = [], set = 1) {
    return officialHistory(snapshots, set).transitions;
}

function recoveryStatus(events = [], snapshots = [], set = 1) {
    const setNumber = Number(set) || 1;
    const manualScore = lastManualScore(events, set);
    const history = officialHistory(snapshots, setNumber);
    const officialScore = history.score;
    const manualPoints = activeEvents(events)
        .filter(isPointEvent)
        .filter(event => Number(event.set) === setNumber)
        .map(event => ({ event, score: parseScore(event.marcadorDespues) }))
        .filter(item => item.score);
    const officialByScore = new Map(history.transitions.map(transition => [scoreKey(transition.after), transition]));
    const manualByScore = new Map();
    let duplicateManual = false;
    let wrongTeam = false;
    for (const item of manualPoints) {
        const key = scoreKey(item.score);
        if (manualByScore.has(key)) duplicateManual = true;
        manualByScore.set(key, item);
        const official = officialByScore.get(key);
        if (official && normalizarEquipo(item.event.equipoAnota) !== official.team) wrongTeam = true;
    }

    const extraManual = history.complete
        ? [...manualByScore.keys()].filter(key => !officialByScore.has(key))
        : [];
    const scoreAhead = history.available && (
        manualScore.home > officialScore.home || manualScore.away > officialScore.away
    );
    const conflict = history.available && history.complete && (
        scoreAhead || duplicateManual || wrongTeam || extraManual.length > 0
    );
    const missingTransitions = history.complete && !conflict
        ? history.transitions.filter(transition => !manualByScore.has(scoreKey(transition.after)))
        : [];
    const missingHome = missingTransitions.filter(item => item.team === 'LOCAL').length;
    const missingAway = missingTransitions.filter(item => item.team === 'VISITANTE').length;
    const missing = missingTransitions.length;
    const reason = !history.available
        ? 'official-unavailable'
        : !history.complete
            ? 'official-incomplete'
            : conflict
                ? 'conflict'
                : missing > 0
                    ? 'missing-events'
                    : 'synchronized';
    return {
        set: setNumber,
        manualScore,
        officialScore,
        manualCount: manualPoints.length,
        officialCount: history.expected,
        missing,
        missingHome,
        missingAway,
        order: missingTransitions.map(item => item.team),
        missingTransitions,
        exactOrder: history.complete,
        conflict,
        conflictDetails: {
            scoreAhead,
            duplicateManual,
            wrongTeam,
            extraManual: extraManual.length
        },
        officialAvailable: history.available,
        officialComplete: history.complete,
        reason,
        canRecover: history.complete && !conflict && missing > 0
    };
}

function mergeRecoveryEvents(events = [], created = []) {
    const merged = [...events];
    const ordered = [...created].sort((a, b) => {
        const setDiff = (Number(a.set) || 1) - (Number(b.set) || 1);
        if (setDiff) return setDiff;
        const scoreA = parseScore(a.marcadorDespues) || { home: 0, away: 0 };
        const scoreB = parseScore(b.marcadorDespues) || { home: 0, away: 0 };
        return (scoreA.home + scoreA.away) - (scoreB.home + scoreB.away);
    });
    for (const event of ordered) {
        const eventScore = parseScore(event.marcadorDespues);
        const eventTotal = eventScore ? eventScore.home + eventScore.away : Infinity;
        let insertAt = merged.findIndex(existing => {
            const existingSet = Number(existing?.set) || 1;
            if (existingSet > Number(event.set)) return true;
            if (existingSet !== Number(event.set) || !isPointEvent(existing)) return false;
            const existingScore = parseScore(existing.marcadorDespues);
            return existingScore && existingScore.home + existingScore.away > eventTotal;
        });
        if (insertAt < 0) insertAt = merged.length;
        merged.splice(insertAt, 0, event);
    }
    return merged;
}

function createRecoveryEvents(events = [], snapshots = [], {
    matchId,
    set = 1,
    homeRotation = null,
    awayRotation = null,
    now = new Date().toISOString()
} = {}) {
    const status = recoveryStatus(events, snapshots, set);
    if (!status.canRecover) return { status, created: [], events };
    const firstMissing = status.missingTransitions[0];
    const trailingGap = firstMissing
        && firstMissing.before.home === status.manualScore.home
        && firstMissing.before.away === status.manualScore.away;
    const created = status.missingTransitions.map((transition, index) => {
        const before = transition.before;
        const after = transition.after;
        const team = transition.team;
        const event = normalizeEvent({
            set,
            punto: after.home + after.away,
            equipoAnota: team,
            equipo: team,
            accion: 'EQUIPO',
            jugador: null,
            marcadorAntes: scoreString(before.home, before.away),
            marcadorDespues: scoreString(after.home, after.away),
            rotacionLocal: transition.rotacionLocal ?? (trailingGap ? homeRotation : null),
            rotacionLocalDespues: transition.rotacionLocalDespues ?? transition.rotacionLocal ?? (trailingGap ? homeRotation : null),
            rotacionVisitante: transition.rotacionVisitante ?? (trailingGap ? awayRotation : null),
            rotacionVisitanteDespues: transition.rotacionVisitanteDespues ?? transition.rotacionVisitante ?? (trailingGap ? awayRotation : null),
            equipoSacaba: transition.equipoSacaba ?? null,
            equipoSacaDespues: transition.equipoSacaDespues ?? team,
            source: 'recovery',
            recovery: true,
            ordenIncierto: false,
            metroEventId: transition.metroEventId,
            timestamp: transition.timestamp || new Date(Date.parse(now) + index).toISOString()
        }, { matchId, source: 'recovery', now });
        return event;
    });
    return { status, created, events: mergeRecoveryEvents(events, created) };
}

function coverageBySet(events = [], snapshots = []) {
    const sets = new Set([
        ...activeEvents(events).map(event => Number(event.set) || 1),
        ...(Array.isArray(snapshots) ? snapshots : []).map(snapshot => Number(snapshot.set) || 1)
    ]);
    return [...sets].sort((a, b) => a - b).map(set => {
        const history = officialHistory(snapshots, set);
        const status = recoveryStatus(events, snapshots, set);
        const official = history.expected;
        const manual = status.manualCount;
        const covered = history.complete
            ? Math.max(0, official - status.missing)
            : Math.min(manual, official || manual);
        return {
            set,
            official,
            manual,
            covered,
            percentage: official > 0 ? Math.min(100, Math.round((covered / official) * 1000) / 10) : null,
            complete: history.complete && !status.conflict && status.missing === 0,
            officialAvailable: history.available,
            officialComplete: history.complete,
            recoverable: status.canRecover
        };
    });
}

module.exports = {
    POINT_ACTIONS,
    normalizarEquipo,
    normalizarAccion,
    parseScore,
    scoreString,
    isPointEvent,
    activeEvents,
    eventDedupeKey,
    normalizeEvent,
    normalizeLegacyEvents,
    appendEvent,
    updateEvent,
    voidEvent,
    lastManualScore,
    officialHistory,
    officialPointTransitions,
    recoveryStatus,
    createRecoveryEvents,
    mergeRecoveryEvents,
    coverageBySet
};
