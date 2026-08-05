class ActivityStatus {
    constructor(inactivitySeconds = 120) {
        this.inactivityMs = inactivitySeconds * 1000;
        this.lastPointAt = null;
        this.inactivityNotified = false;
    }

    reset() {
        this.lastPointAt = null;
        this.inactivityNotified = false;
    }

    update(snapshot = null, now = Date.now()) {
        if (snapshot?.scorer) {
            this.lastPointAt = now;
            this.inactivityNotified = false;
            return { status: 'active', secondsWithoutPoints: 0, shouldNotify: false };
        }

        if (this.lastPointAt === null) {
            return { status: 'waiting', secondsWithoutPoints: 0, shouldNotify: false };
        }

        const secondsWithoutPoints = Math.floor((now - this.lastPointAt) / 1000);
        const inactive = now - this.lastPointAt >= this.inactivityMs;
        const shouldNotify = inactive && !this.inactivityNotified;
        if (shouldNotify) this.inactivityNotified = true;

        return {
            status: inactive ? 'inactive' : 'active',
            secondsWithoutPoints,
            shouldNotify
        };
    }
}

module.exports = ActivityStatus;
