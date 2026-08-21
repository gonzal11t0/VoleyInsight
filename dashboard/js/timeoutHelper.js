export function deduplicateTimeouts(timeouts = [], toleranceMs = 2500) {
    const result = [];
    for (const timeout of Array.isArray(timeouts) ? timeouts : []) {
        const timestamp = Date.parse(timeout?.timestamp || '');
        const duplicated = result.some(previous => {
            if (previous?.id && timeout?.id && previous.id === timeout.id) return true;
            if (Number(previous?.set || 1) !== Number(timeout?.set || 1)) return false;
            if (previous?.equipo !== timeout?.equipo || previous?.marcador !== timeout?.marcador) return false;
            const previousTime = Date.parse(previous?.timestamp || '');
            return Number.isFinite(timestamp) && Number.isFinite(previousTime)
                ? Math.abs(timestamp - previousTime) <= toleranceMs
                : true;
        });
        if (!duplicated) result.push(timeout);
    }
    return result;
}
