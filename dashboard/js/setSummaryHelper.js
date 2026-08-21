function scoreFromPoint(point = {}) {
    let home = Number(point.homeScore);
    let away = Number(point.awayScore);
    if ((!Number.isFinite(home) || !Number.isFinite(away)) && point.marcadorDespues) {
        [home, away] = String(point.marcadorDespues).split('-').map(Number);
    }
    return Number.isFinite(home) && Number.isFinite(away) ? { home, away } : null;
}

function setFinished(home, away, set, config = {}) {
    const decisive = Number(set) === Number(config.maxSets || 5);
    const target = decisive ? Number(config.puntosSetDecisivo || 15) : Number(config.puntosSetNormal || 25);
    return Math.max(home, away) >= target && Math.abs(home - away) >= 2;
}

export function latestFinishedSet(points = [], config = {}) {
    const sets = new Map();
    for (const point of points) {
        const set = Number(point?.set || 1);
        const score = scoreFromPoint(point);
        if (!Number.isInteger(set) || !score) continue;
        sets.set(set, score);
    }
    const numbers = [...sets.keys()].sort((a, b) => a - b);
    return numbers
        .filter((set, index) => index < numbers.length - 1 || setFinished(sets.get(set).home, sets.get(set).away, set, config))
        .map(set => ({ set, ...sets.get(set) }))
        .at(-1) || null;
}

export function topScorerForSet(manualPoints = [], set, homeNames = {}, awayNames = {}) {
    const totals = new Map();
    manualPoints
        .filter(point => Number(point?.set || 1) === Number(set) && ['LOCAL', 'VISITANTE'].includes(point?.equipoAnota))
        .filter(point => Number(point?.jugador) > 0)
        .forEach(point => {
            const key = `${point.equipoAnota}:${Number(point.jugador)}`;
            totals.set(key, (totals.get(key) || 0) + 1);
        });
    const winner = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!winner) return null;
    const [team, number] = winner[0].split(':');
    const names = team === 'LOCAL' ? homeNames : awayNames;
    return {
        team,
        number: Number(number),
        name: names?.[number] || `Jugador #${number}`,
        points: winner[1]
    };
}

export function buildSetSummary({
    officialPoints = [],
    manualPoints = [],
    config = {},
    homeTeam = 'LOCAL',
    awayTeam = 'VISITANTE',
    homeNames = {},
    awayNames = {}
} = {}) {
    const score = latestFinishedSet(officialPoints.length ? officialPoints : manualPoints, config);
    if (!score) return null;
    const manualSet = manualPoints.filter(point => Number(point?.set || 1) === score.set && ['LOCAL', 'VISITANTE'].includes(point?.equipoAnota));
    const officialSet = officialPoints.filter(point => Number(point?.set || 1) === score.set && ['HOME', 'AWAY'].includes(point?.scorer));
    const expected = officialSet.length || score.home + score.away;
    const coverage = expected > 0 ? Math.min(100, Number(((manualSet.length / expected) * 100).toFixed(0))) : 0;
    return {
        ...score,
        winner: score.home > score.away ? homeTeam : awayTeam,
        topScorer: topScorerForSet(manualPoints, score.set, homeNames, awayNames),
        coverage,
        manualPoints: manualSet.length,
        expectedPoints: expected
    };
}
