// src/utils/colorLogger.js
const logger = require('./logger');

class ColorLogger {
    static colors = {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
    };

    static highlight(text, color) {
        return `${this.colors[color]}${text}${this.colors.reset}`;
    }

    static printBreak(snapshot) {
        const team = snapshot.scorer === 'HOME' ? snapshot.homeTeam : snapshot.awayTeam;
        console.log(
            this.highlight('⚡ BREAK!', 'yellow'),
            this.highlight(team, 'bright'),
            this.highlight(`rompe el saque!`, 'white'),
            `[${snapshot.homeScore}-${snapshot.awayScore}]`
        );
    }

    static printRun(snapshot) {
        const team = snapshot.homeRun >= 3 ? snapshot.homeTeam : snapshot.awayTeam;
        const run = snapshot.homeRun >= 3 ? snapshot.homeRun : snapshot.awayRun;
        console.log(
            this.highlight('🔥 RACHA!', 'red'),
            this.highlight(team, 'bright'),
            this.highlight(`${run} puntos seguidos!`, 'white')
        );
    }

    static printSetPoint(snapshot) {
        const team = snapshot.homeScore >= 24 ? snapshot.homeTeam : snapshot.awayTeam;
        console.log(
            this.highlight('🎯 SET POINT!', 'magenta'),
            this.highlight(team, 'bright'),
            this.highlight(`a punto de cerrar el set ${snapshot.set}`, 'white')
        );
    }

    static printCloseGame(snapshot) {
        console.log(
            this.highlight('🤯 PARTIDO CERCADO!', 'cyan'),
            this.highlight(`${snapshot.homeScore}-${snapshot.awayScore}`, 'bright')
        );
    }

    static printMomentum(momentum) {
        if (momentum > 1) {
            console.log(this.highlight('📈 LOCAL CON MOMENTUM', 'green'));
        } else if (momentum < -1) {
            console.log(this.highlight('📈 VISITANTE CON MOMENTUM', 'green'));
        }
    }
}

module.exports = ColorLogger;