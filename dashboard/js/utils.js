// dashboard/js/utils.js

// Clase OfflineManager
export class OfflineManager {
    constructor() { this.dbName = 'VoleyInsightDB'; this.dbVersion = 1; this.db = null; }
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { this.db = request.result; resolve(); };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('matches')) db.createObjectStore('matches', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('points')) db.createObjectStore('points', { keyPath: 'id', autoIncrement: true });
            };
        });
    }
    async saveMatchData(matchId, data) {
        if (!this.db) await this.initDB();
        const transaction = this.db.transaction(['matches'], 'readwrite');
        transaction.objectStore('matches').put({ id: matchId, data: data, date: new Date().toISOString() });
    }
    async getMatchData(matchId) {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['matches'], 'readonly');
            const request = transaction.objectStore('matches').get(matchId);
            request.onsuccess = () => resolve(request.result?.data || null);
            request.onerror = () => reject(request.error);
        });
    }
}

// Clase SoundManager
export class SoundManager {
        constructor() { this.enabled = true; this.audioContext = null; this.initAudio(); }
    initAudio() { try { this.audioContext = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} }
    playBeep(frequency, duration, type = 'sine') {
        if (!this.enabled || !this.audioContext) return;
        try {
            if (this.audioContext.state === 'suspended') this.audioContext.resume();
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            oscillator.frequency.value = frequency;
            oscillator.type = type;
            gainNode.gain.value = 0.3;
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, this.audioContext.currentTime + duration);
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch(e) { console.log('Error:', e); }
    }
    playLocalPoint() { this.playBeep(880, 0.3, 'sine'); }
    playAwayPoint() { this.playBeep(440, 0.4, 'sawtooth'); }
    playEndMatch() { this.playBeep(523.25,0.2,'sine'); setTimeout(()=>this.playBeep(659.25,0.2,'sine'),200); setTimeout(()=>this.playBeep(783.99,0.4,'sine'),400); }
    toggle() { this.enabled = !this.enabled; return this.enabled; }
}