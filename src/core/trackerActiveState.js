function obtenerMatchIdActivo(config = {}) {
    const value = Number(config?.matchId);
    return Number.isInteger(value) && value > 0 ? value : null;
}

module.exports = { obtenerMatchIdActivo };
