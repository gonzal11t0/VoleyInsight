const assert = require('node:assert');
const { describe, it, beforeEach } = require('node:test');
const StateProcessor = require('../core/stateProcessor');

describe('StateProcessor', () => {
  let processor;
  
  beforeEach(() => {
    processor = new StateProcessor();
  });
  
  describe('extractMatchState', () => {
    it('should extract match state from API data', () => {
      const apiData = {
        match: {
          currentSet: 1,
          sets: [{ homeTeamScore: 10, awayTeamScore: 8 }],
          homeTeam: { name: 'Team A' },
          awayTeam: { name: 'Team B' }
        },
        liveState: { serving: 'home' }
      };
      
      const state = processor.extractMatchState(apiData);
      
      assert.strictEqual(state.set, 1);
      assert.strictEqual(state.homeTeam, 'Team A');
      assert.strictEqual(state.awayTeam, 'Team B');
      assert.strictEqual(state.homeScore, 10);
      assert.strictEqual(state.awayScore, 8);
      assert.strictEqual(state.serving, 'home');
    });
    
    it('should throw if set not found', () => {
      const apiData = {
        match: {
          currentSet: 2,
          sets: [{ homeTeamScore: 10, awayTeamScore: 8 }],
          homeTeam: { name: 'Team A' },
          awayTeam: { name: 'Team B' }
        },
        liveState: { serving: 'home' }
      };
      
      assert.throws(() => processor.extractMatchState(apiData));
    });
  });
  
  describe('hasChanged', () => {
    it('should detect score change', () => {
      const state1 = { set: 1, homeScore: 10, awayScore: 8 };
      const state2 = { set: 1, homeScore: 11, awayScore: 8 };
      
      processor.lastState = state1;
      assert.strictEqual(processor.hasChanged(state2), true);
    });
    
    it('should detect set change', () => {
      const state1 = { set: 1, homeScore: 25, awayScore: 20 };
      const state2 = { set: 2, homeScore: 0, awayScore: 0 };
      
      processor.lastState = state1;
      assert.strictEqual(processor.hasChanged(state2), true);
    });
    
    it('should not detect change when scores are same', () => {
      const state1 = { set: 1, homeScore: 10, awayScore: 8 };
      const state2 = { set: 1, homeScore: 10, awayScore: 8 };
      
      processor.lastState = state1;
      assert.strictEqual(processor.hasChanged(state2), false);
    });
    
    it('should detect change on first state', () => {
      const state = { set: 1, homeScore: 0, awayScore: 0 };
      assert.strictEqual(processor.hasChanged(state), true);
    });
  });
  
  describe('determineScorer', () => {
    it('should identify home scorer', () => {
      const last = { homeScore: 10, awayScore: 8 };
      const current = { homeScore: 11, awayScore: 8 };
      
      processor.lastState = last;
      assert.strictEqual(processor.determineScorer(current), 'home');
    });
    
    it('should identify away scorer', () => {
      const last = { homeScore: 10, awayScore: 8 };
      const current = { homeScore: 10, awayScore: 9 };
      
      processor.lastState = last;
      assert.strictEqual(processor.determineScorer(current), 'away');
    });
    
    it('should return null if no change', () => {
      const last = { homeScore: 10, awayScore: 8 };
      const current = { homeScore: 10, awayScore: 8 };
      
      processor.lastState = last;
      assert.strictEqual(processor.determineScorer(current), null);
    });
    
    it('should return null on first state', () => {
      const current = { homeScore: 10, awayScore: 8 };
      assert.strictEqual(processor.determineScorer(current), null);
    });
  });
  
  describe('updateRuns', () => {
    it('should update home run', () => {
      processor.updateRuns('home');
      assert.strictEqual(processor.homeRun, 1);
      assert.strictEqual(processor.awayRun, 0);
      
      processor.updateRuns('home');
      assert.strictEqual(processor.homeRun, 2);
      assert.strictEqual(processor.awayRun, 0);
    });
    
    it('should update away run', () => {
      processor.updateRuns('away');
      assert.strictEqual(processor.homeRun, 0);
      assert.strictEqual(processor.awayRun, 1);
      
      processor.updateRuns('away');
      assert.strictEqual(processor.homeRun, 0);
      assert.strictEqual(processor.awayRun, 2);
    });
    
    it('should reset opposite run', () => {
      processor.homeRun = 3;
      processor.awayRun = 0;
      
      processor.updateRuns('away');
      assert.strictEqual(processor.homeRun, 0);
      assert.strictEqual(processor.awayRun, 1);
    });
  });
  
  describe('calculatePhase', () => {
    it('should return EARLY for less than 10 points', () => {
      assert.strictEqual(processor.calculatePhase(5), 'EARLY');
      assert.strictEqual(processor.calculatePhase(9), 'EARLY');
    });
    
    it('should return MID for 10-19 points', () => {
      assert.strictEqual(processor.calculatePhase(10), 'MID');
      assert.strictEqual(processor.calculatePhase(15), 'MID');
      assert.strictEqual(processor.calculatePhase(19), 'MID');
    });
    
    it('should return LATE for 20 or more points', () => {
      assert.strictEqual(processor.calculatePhase(20), 'LATE');
      assert.strictEqual(processor.calculatePhase(25), 'LATE');
      assert.strictEqual(processor.calculatePhase(30), 'LATE');
    });
  });
  
  describe('determineEvent', () => {
    it('should detect SIDEOUT_HOME', () => {
      assert.strictEqual(processor.determineEvent('home', 'home'), 'SIDEOUT_HOME');
    });
    
    it('should detect SIDEOUT_AWAY', () => {
      assert.strictEqual(processor.determineEvent('away', 'away'), 'SIDEOUT_AWAY');
    });
    
    it('should detect BREAK_HOME', () => {
      assert.strictEqual(processor.determineEvent('home', 'away'), 'BREAK_HOME');
    });
    
    it('should detect BREAK_AWAY', () => {
      assert.strictEqual(processor.determineEvent('away', 'home'), 'BREAK_AWAY');
    });
    
    it('should return POINT when no scorer', () => {
      assert.strictEqual(processor.determineEvent(null, 'home'), 'POINT');
    });
  });
  
  describe('createSnapshot', () => {
    it('should create complete snapshot', () => {
      const currentState = {
        set: 1,
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        homeScore: 11,
        awayScore: 9,
        serving: 'home',
        totalPoints: 20
      };
      
      const snapshot = processor.createSnapshot(currentState, 'home');
      
      assert.strictEqual(snapshot.set, 1);
      assert.strictEqual(snapshot.homeTeam, 'Team A');
      assert.strictEqual(snapshot.awayTeam, 'Team B');
      assert.strictEqual(snapshot.homeScore, 11);
      assert.strictEqual(snapshot.awayScore, 9);
      assert.strictEqual(snapshot.scorer, 'HOME');
      assert.strictEqual(snapshot.serving, 'HOME');
      assert.strictEqual(snapshot.lead, 2);
      assert.strictEqual(snapshot.phase, 'LATE');
      assert.strictEqual(snapshot.event, 'SIDEOUT_HOME');
      assert.ok(snapshot.timestamp);
    });
    
    it('should update runs when creating snapshot', () => {
      const currentState = {
        set: 1,
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        homeScore: 11,
        awayScore: 9,
        serving: 'home',
        totalPoints: 20
      };
      
      processor.createSnapshot(currentState, 'home');
      assert.strictEqual(processor.homeRun, 1);
      
      processor.createSnapshot(currentState, 'home');
      assert.strictEqual(processor.homeRun, 2);
    });
  });
  
  describe('processUpdate', () => {
    it('should process complete update', () => {
      const apiData = {
        match: {
          currentSet: 1,
          sets: [{ homeTeamScore: 10, awayTeamScore: 8 }],
          homeTeam: { name: 'Team A' },
          awayTeam: { name: 'Team B' }
        },
        liveState: { serving: 'home' }
      };
      
      const snapshot = processor.processUpdate(apiData);
      
      assert.ok(snapshot);
      assert.strictEqual(snapshot.homeScore, 10);
      assert.strictEqual(snapshot.awayScore, 8);
    });
    
    it('should return null on no change', () => {
      const apiData = {
        match: {
          currentSet: 1,
          sets: [{ homeTeamScore: 0, awayTeamScore: 0 }],
          homeTeam: { name: 'Team A' },
          awayTeam: { name: 'Team B' }
        },
        liveState: { serving: 'home' }
      };
      
      processor.processUpdate(apiData);
      const second = processor.processUpdate(apiData);
      
      assert.strictEqual(second, null);
    });
  });
});