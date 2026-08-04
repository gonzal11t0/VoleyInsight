class VolleyballMetrics {
    constructor(snapshots) {
        this.snapshots = snapshots;
        this.homeTeam = snapshots[0]?.homeTeam || 'LOCAL';
        this.awayTeam = snapshots[0]?.awayTeam || 'VISITANTE';
    }

    calculateBreakPointEfficiency() {
        const breaks = this.snapshots.filter(s => s.event?.includes('BREAK') && s.scorer);
        const homeBreaks = breaks.filter(b => b.event === 'BREAK_HOME').length;
        const awayBreaks = breaks.filter(b => b.event === 'BREAK_AWAY').length;
        const homeOpp = this.snapshots.filter(s => s.scorer && s.serving === 'AWAY').length;
        const awayOpp = this.snapshots.filter(s => s.scorer && s.serving === 'HOME').length;
        const homeEff = homeOpp > 0 ? (homeBreaks / homeOpp * 100).toFixed(1) : 0;
        const awayEff = awayOpp > 0 ? (awayBreaks / awayOpp * 100).toFixed(1) : 0;
        let interp = "📊 Eficiencia en breaks equilibrada.";
        if (homeEff > 45 && awayEff > 45) interp = "⚡ Ambos equipos son muy efectivos rompiendo el saque rival.";
        else if (homeEff > 45) interp = `⚡ ${this.homeTeam} es letal en breaks (${homeEff}%).`;
        else if (awayEff > 45) interp = `⚡ ${this.awayTeam} es letal en breaks (${awayEff}%).`;
        else if (homeEff < 25 && awayEff < 25) interp = "⚠️ Ambos equipos tienen dificultades para romper el saque rival.";
        return {
            breaks: { home: homeBreaks, away: awayBreaks },
            opportunities: { home: homeOpp, away: awayOpp },
            efficiency: { home: homeEff, away: awayEff },
            interpretation: interp
        };
    }

    calculateSideoutPercentage() {
        const sideouts = this.snapshots.filter(s => s.event?.includes('SIDEOUT') && s.scorer);
        const homeSide = sideouts.filter(s => s.event === 'SIDEOUT_HOME').length;
        const awaySide = sideouts.filter(s => s.event === 'SIDEOUT_AWAY').length;
        const homeServes = this.snapshots.filter(s => s.scorer && s.serving === 'HOME').length;
        const awayServes = this.snapshots.filter(s => s.scorer && s.serving === 'AWAY').length;
        const homePct = homeServes > 0 ? (homeSide / homeServes * 100).toFixed(1) : 0;
        const awayPct = awayServes > 0 ? (awaySide / awayServes * 100).toFixed(1) : 0;
        let interp = "📊 Sideout equilibrado.";
        if (homePct > 65 && awayPct > 65) interp = "🏐 Excelente consistencia en servicio.";
        else if (homePct > 65) interp = `🏐 ${this.homeTeam} es sólido en sideout (${homePct}%).`;
        else if (awayPct > 65) interp = `🏐 ${this.awayTeam} es sólido en sideout (${awayPct}%).`;
        else if (homePct < 50 && awayPct < 50) interp = "⚠️ Problemas en el servicio: ambos equipos pierden muchos puntos cuando sacan.";
        return {
            sideouts: { home: homeSide, away: awaySide },
            totalServingPoints: { home: homeServes, away: awayServes },
            percentage: { home: homePct, away: awayPct },
            interpretation: interp
        };
    }

    calculateMomentumIndex() {
        const windowSize = 5;
        const momentumPoints = [];
        for (let i = windowSize - 1; i < this.snapshots.length; i++) {
            const window = this.snapshots.slice(i - windowSize + 1, i + 1);
            const h = window.filter(w => w.scorer === 'HOME').length;
            const a = window.filter(w => w.scorer === 'AWAY').length;
            momentumPoints.push({
                point: i + 1,
                momentum: parseFloat(((h - a) / windowSize).toFixed(2)),
                dominant: (h - a) / windowSize > 0.4 ? this.homeTeam : (h - a) / windowSize < -0.4 ? this.awayTeam : 'NEUTRAL'
            });
        }
        const maxM = Math.max(...momentumPoints.map(m => Math.abs(m.momentum))) || 0;
        const domH = momentumPoints.filter(m => m.dominant === this.homeTeam).length;
        const domA = momentumPoints.filter(m => m.dominant === this.awayTeam).length;
        const domN = momentumPoints.filter(m => m.dominant === 'NEUTRAL').length;
        const total = momentumPoints.length || 1;
        let interp = "📊 Momentum equilibrado.";
        if (domH / total > 0.6) interp = `🔥 ${this.homeTeam} dominó el ${(domH / total * 100).toFixed(0)}% del partido.`;
        else if (domA / total > 0.6) interp = `🔥 ${this.awayTeam} dominó el ${(domA / total * 100).toFixed(0)}% del partido.`;
        else if (Math.abs(domH - domA) / total < 0.15) interp = "🔄 Partido de momentum cambiante. Alta competitividad.";
        else if (maxM > 0.8) interp = "⚡ Picos de dominancia extrema detectados.";
        return {
            series: momentumPoints,
            peak: momentumPoints.find(m => Math.abs(m.momentum) === maxM),
            dominancePercentage: { home: (domH / total * 100).toFixed(1), away: (domA / total * 100).toFixed(1), neutral: (domN / total * 100).toFixed(1) },
            interpretation: interp
        };
    }

    calculateClutchPerformance() {
        const clutch = this.snapshots.filter(s => {
            const sp = (s.homeScore >= 24 && s.homeScore > s.awayScore) || (s.awayScore >= 24 && s.awayScore > s.homeScore);
            const close = Math.abs(s.lead) <= 2;
            return (sp || (close && s.phase === 'LATE')) && s.scorer;
        });
        const total = clutch.length;
        const homeC = clutch.filter(c => c.scorer === 'HOME').length;
        const awayC = clutch.filter(c => c.scorer === 'AWAY').length;
        const critical = clutch.filter(c => (c.homeScore >= 24 && c.homeScore > c.awayScore) || (c.awayScore >= 24 && c.awayScore > c.homeScore) || c.lead === 0);
        const homeCrit = critical.filter(c => c.scorer === 'HOME').length;
        const awayCrit = critical.filter(c => c.scorer === 'AWAY').length;
        const homeEff = total > 0 ? (homeC / total * 100).toFixed(1) : 0;
        const awayEff = total > 0 ? (awayC / total * 100).toFixed(1) : 0;
        let interp = "📊 Rendimiento equilibrado bajo presión.";
        if (homeEff > 65 && awayEff < 35) interp = `🏆 ${this.homeTeam} es un equipo CLUTCH! Convierte ${homeEff}% de puntos críticos.`;
        else if (awayEff > 65 && homeEff < 35) interp = `🏆 ${this.awayTeam} es un equipo CLUTCH! Convierte ${awayEff}% de puntos críticos.`;
        else if (homeEff > 60 && awayEff > 60) interp = "💎 Ambos equipos demuestran fortaleza bajo presión.";
        else if (homeEff < 35 && awayEff < 35) interp = "⚠️ Problemas críticos: ambos equipos muestran debilidad en momentos de presión.";
        else if (critical.length > 0 && homeCrit > awayCrit + 2) interp = `🎯 ${this.homeTeam} brilla en los momentos más críticos (${homeCrit}/${critical.length} puntos clave).`;
        else if (critical.length > 0 && awayCrit > homeCrit + 2) interp = `🎯 ${this.awayTeam} brilla en los momentos más críticos (${awayCrit}/${critical.length} puntos clave).`;
        return {
            totalClutchPoints: total,
            criticalClutchPoints: critical.length,
            efficiency: { home: homeEff, away: awayEff },
            criticalEfficiency: { home: critical.length ? (homeCrit / critical.length * 100).toFixed(1) : 0, away: critical.length ? (awayCrit / critical.length * 100).toFixed(1) : 0 },
            interpretation: interp
        };
    }

    calculatePhaseEfficiency() {
        const phases = { EARLY: { home: 0, away: 0, total: 0 }, MID: { home: 0, away: 0, total: 0 }, LATE: { home: 0, away: 0, total: 0 } };
        this.snapshots.forEach(s => {
            if (s.scorer && phases[s.phase]) {
                phases[s.phase][s.scorer === 'HOME' ? 'home' : 'away']++;
                phases[s.phase].total++;
            }
        });
        const eff = {
            EARLY: { home: phases.EARLY.total ? (phases.EARLY.home / phases.EARLY.total * 100).toFixed(1) : 0, away: phases.EARLY.total ? (phases.EARLY.away / phases.EARLY.total * 100).toFixed(1) : 0, totalPoints: phases.EARLY.total },
            MID: { home: phases.MID.total ? (phases.MID.home / phases.MID.total * 100).toFixed(1) : 0, away: phases.MID.total ? (phases.MID.away / phases.MID.total * 100).toFixed(1) : 0, totalPoints: phases.MID.total },
            LATE: { home: phases.LATE.total ? (phases.LATE.home / phases.LATE.total * 100).toFixed(1) : 0, away: phases.LATE.total ? (phases.LATE.away / phases.LATE.total * 100).toFixed(1) : 0, totalPoints: phases.LATE.total }
        };
        const homeLate = parseFloat(eff.LATE.home),
            awayLate = parseFloat(eff.LATE.away),
            homeEarly = parseFloat(eff.EARLY.home),
            awayEarly = parseFloat(eff.EARLY.away);
        let interp = "📊 Rendimiento consistente a lo largo de las fases.";
        if (homeLate > 60 && homeEarly < 40) interp = `📈 ${this.homeTeam} es un equipo de remontada: débil al inicio (${eff.EARLY.home}%) pero fuerte al final (${eff.LATE.home}%).`;
        else if (awayLate > 60 && awayEarly < 40) interp = `📈 ${this.awayTeam} es un equipo de remontada: débil al inicio (${eff.EARLY.away}%) pero fuerte al final (${eff.LATE.away}%).`;
        else if (homeEarly > 60 && homeLate < 40) interp = `⚠️ ${this.homeTeam} se desinfla al final: fuerte al inicio (${eff.EARLY.home}%) pero débil en el cierre (${eff.LATE.home}%).`;
        else if (awayEarly > 60 && awayLate < 40) interp = `⚠️ ${this.awayTeam} se desinfla al final: fuerte al inicio (${eff.EARLY.away}%) pero débil en el cierre (${eff.LATE.away}%).`;
        const strengths = [],
            weaknesses = [];
        if (parseFloat(eff.EARLY.home) > 55) strengths.push(`${this.homeTeam} es fuerte en Early Game`);
        if (parseFloat(eff.MID.home) > 55) strengths.push(`${this.homeTeam} es fuerte en Mid Game`);
        if (parseFloat(eff.LATE.home) > 55) strengths.push(`${this.homeTeam} es fuerte en Late Game`);
        if (parseFloat(eff.EARLY.home) < 40) weaknesses.push(`${this.homeTeam} es débil en Early Game`);
        if (parseFloat(eff.MID.home) < 40) weaknesses.push(`${this.homeTeam} es débil en Mid Game`);
        if (parseFloat(eff.LATE.home) < 40) weaknesses.push(`${this.homeTeam} es débil en Late Game`);
        return { efficiency: eff, strengths, weaknesses, interpretation: interp };
    }

    calculateRunImpact() {
        const runs = [];
        let current = { team: null, points: 0, startPoint: 0, startScore: null };
        for (let i = 0; i < this.snapshots.length; i++) {
            const s = this.snapshots[i];
            if (s.scorer === current.team) current.points++;
            else {
                if (current.team && current.points >= 3) runs.push({ ...current, endPoint: i });
                current = { team: s.scorer, points: 1, startPoint: i + 1, startScore: `${s.homeScore}-${s.awayScore}` };
            }
        }
        const responses = runs.map(run => {
            const next = this.snapshots.slice(run.endPoint, run.endPoint + 3).find(p => p.scorer)?.scorer;
            return {
                runTeam: run.team === 'HOME' ? this.homeTeam : this.awayTeam,
                runPoints: run.points,
                startPoint: run.startPoint,
                response: next ? (next === 'HOME' ? this.homeTeam : this.awayTeam) : null,
                wasEffective: next && next !== run.team
            };
        });
        const effective = responses.filter(r => r.wasEffective).length;
        const total = runs.length;
        const rate = total > 0 ? (effective / total * 100).toFixed(1) : 0;
        let interp = "📊 Capacidad de recuperación normal.";
        if (rate > 60) interp = `🔄 Excelente capacidad de recuperación: responden después del ${rate}% de las rachas rivales.`;
        else if (rate < 30 && total > 2) interp = `⚠️ Problemas de resiliencia: solo responden después del ${rate}% de las rachas rivales.`;
        return {
            runs: runs.map(r => ({ team: r.team === 'HOME' ? this.homeTeam : this.awayTeam, points: r.points, startPoint: r.startPoint, startScore: r.startScore })),
            responses,
            recoveryRate: rate,
            interpretation: interp
        };
    }

    generateFullReport() {
        const breaks = this.calculateBreakPointEfficiency();
        const sideout = this.calculateSideoutPercentage();
        const momentum = this.calculateMomentumIndex();
        const clutch = this.calculateClutchPerformance();
        const phase = this.calculatePhaseEfficiency();
        const runImpact = this.calculateRunImpact();
        const points = this.snapshots.filter(s => s.scorer);
        const total = points.length;
        const homePts = points.filter(p => p.scorer === 'HOME').length;
        const awayPts = points.filter(p => p.scorer === 'AWAY').length;
        const last = this.snapshots[this.snapshots.length - 1];
        const summary = this.generateSummary(breaks, sideout, clutch, phase, runImpact);
        return {
            matchInfo: {
                homeTeam: this.homeTeam,
                awayTeam: this.awayTeam,
                finalScore: last ? `${last.homeScore}-${last.awayScore}` : '0-0',
                totalPoints: total,
                winner: last ? (last.homeScore > last.awayScore ? this.homeTeam : this.awayTeam) : null
            },
            basicStats: {
                points: { home: homePts, away: awayPts },
                pointsPercentage: { home: ((homePts / total) * 100).toFixed(1), away: ((awayPts / total) * 100).toFixed(1) }
            },
            advancedMetrics: {
                breakPointEfficiency: breaks,
                sideoutPercentage: sideout,
                momentumIndex: momentum,
                clutchPerformance: clutch,
                phaseAnalysis: phase,
                runImpact: runImpact
            },
            summary
        };
    }

    generateSummary(breaks, sideout, clutch, phase, runImpact) {
        const insights = [],
            recommendations = [];
        const hb = parseFloat(breaks.efficiency.home),
            ab = parseFloat(breaks.efficiency.away);
        if (hb > 45) insights.push(`⚡ ${this.homeTeam} es letal en breaks: ${hb}%`);
        if (ab > 45) insights.push(`⚡ ${this.awayTeam} es letal en breaks: ${ab}%`);
        const hc = parseFloat(clutch.efficiency.home),
            ac = parseFloat(clutch.efficiency.away);
        if (hc > 60) insights.push(`🏆 ${this.homeTeam} rinde bajo presión: ${hc}%`);
        else if (hc < 35 && hc > 0) recommendations.push(`🎯 Trabajar presión: ${this.homeTeam} convierte solo ${hc}% en momentos clave`);
        if (ac > 60) insights.push(`🏆 ${this.awayTeam} rinde bajo presión: ${ac}%`);
        else if (ac < 35 && ac > 0) recommendations.push(`🎯 Trabajar presión: ${this.awayTeam} convierte solo ${ac}%`);
        if (phase.weaknesses.length) recommendations.push(...phase.weaknesses.map(w => `📌 ${w}. Ajustar estrategia.`));
        const rr = parseFloat(runImpact.recoveryRate);
        if (rr > 60) insights.push(`🔄 Buena resiliencia: responden después del ${rr}% de las rachas rivales`);
        else if (rr < 30 && rr > 0) recommendations.push(`🔄 Mejorar respuesta tras rachas: solo responden en ${rr}%`);
        const last = this.snapshots[this.snapshots.length - 1];
        let winnerMsg = "No hay datos suficientes.";
        if (last) {
            const winner = last.homeScore > last.awayScore ? this.homeTeam : this.awayTeam;
            const loser = last.homeScore > last.awayScore ? this.awayTeam : this.homeTeam;
            const reason = (winner === this.homeTeam ? parseFloat(hc) : parseFloat(ac)) > 60 ? `Clave: fortaleza en momentos críticos` : (winner === this.homeTeam ? hb : ab) > 45 ? `Clave: efectividad en breaks` : "Partido parejo, detalles marcaron la diferencia.";
            winnerMsg = `🏆 **${winner}** derrotó a ${loser} por ${last.homeScore}-${last.awayScore}. ${reason}`;
        }
        return { executiveSummary: winnerMsg, insights, recommendations, keyTakeaways: this.generateKeyTakeaways(breaks, sideout, clutch, phase) };
    }

    generateKeyTakeaways(breaks, sideout, clutch, phase) {
        const takeaways = [];
        const hb = parseFloat(breaks.efficiency.home),
            hs = parseFloat(sideout.percentage.home);
        const ab = parseFloat(breaks.efficiency.away),
            aso = parseFloat(sideout.percentage.away);
        if (hb > hs) takeaways.push(`${this.homeTeam} es más peligroso cuando NO saca (${hb}% en breaks) que cuando saca (${hs}% en sideout).`);
        if (ab > aso) takeaways.push(`${this.awayTeam} es más peligroso cuando NO saca (${ab}% en breaks) que cuando saca (${aso}% en sideout).`);
        const bestHome = this.getBestPhase(phase.efficiency, 'home');
        const bestAway = this.getBestPhase(phase.efficiency, 'away');
        if (bestHome) takeaways.push(`${this.homeTeam} domina en ${bestHome.phase}: ${bestHome.percentage}% de eficiencia.`);
        if (bestAway) takeaways.push(`${this.awayTeam} domina en ${bestAway.phase}: ${bestAway.percentage}% de eficiencia.`);
        return takeaways;
    }

    getBestPhase(efficiency, team) {
        const phases = ['EARLY', 'MID', 'LATE'];
        let best = { phase: null, percentage: 0 };
        for (const p of phases) {
            const pct = parseFloat(efficiency[p][team]);
            if (pct > best.percentage && efficiency[p].totalPoints > 5) {
                best = { phase: p === 'EARLY' ? 'Early Game (1-10)' : p === 'MID' ? 'Mid Game (11-20)' : 'Late Game (21+)', percentage: pct };
            }
        }
        return best.percentage > 0 ? best : null;
    }
}

module.exports = VolleyballMetrics;
