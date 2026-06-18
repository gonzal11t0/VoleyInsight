const VolleyballMetrics = require('./volleyballMetrics');

class PerformanceAnalyzer {
    constructor(snapshots) {
        this.snapshots = snapshots;
        this.metrics = new VolleyballMetrics(snapshots);
    }

    generateFullReport() {
        return this.metrics.generateFullReport();
    }

    exportForDashboard() {
        const r = this.generateFullReport();
        return {
            matchInfo: r.matchInfo,
            basicStats: r.basicStats,
            advancedMetrics: {
                breaks: r.advancedMetrics?.breakPointEfficiency,
                sideout: r.advancedMetrics?.sideoutPercentage,
                momentum: r.advancedMetrics?.momentumIndex,
                clutch: r.advancedMetrics?.clutchPerformance,
                phases: r.advancedMetrics?.phaseAnalysis,
                runImpact: r.advancedMetrics?.runImpact
            },
            insights: r.summary?.insights,
            recommendations: r.summary?.recommendations,
            keyTakeaways: r.summary?.keyTakeaways,
            executiveSummary: r.summary?.executiveSummary
        };
    }
}

module.exports = PerformanceAnalyzer;