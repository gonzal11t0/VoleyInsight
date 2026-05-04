    const assert = require('node:assert');
const { describe, it, beforeEach, afterEach } = require('node:test');

// Mock para no hacer requests reales en tests
class MockMetroVoleyAPI {
  constructor(matchId) {
    this.matchId = matchId;
    this.shouldFail = false;
  }

  async fetchUpdates() {
    if (this.shouldFail) {
      throw new Error('API error');
    }
    
    return {
      match: {
        currentSet: 1,
        sets: [{ homeTeamScore: 10, awayTeamScore: 8 }],
        homeTeam: { name: 'Team A' },
        awayTeam: { name: 'Team B' }
      },
      liveState: { serving: 'home' }
    };
  }

  validateResponse(data) {
    if (!data?.match?.sets) {
      throw new Error('Invalid response');
    }
    return data;
  }
}

describe('API Service', () => {
  let api;
  
  beforeEach(() => {
    api = new MockMetroVoleyAPI(123456);
  });
  
  it('should fetch match updates successfully', async () => {
    const data = await api.fetchUpdates();
    
    assert.ok(data);
    assert.ok(data.match);
    assert.ok(data.match.sets);
    assert.strictEqual(data.match.currentSet, 1);
  });
  
  it('should validate response structure', () => {
    const validData = {
      match: {
        sets: [{ homeTeamScore: 10, awayTeamScore: 8 }]
      }
    };
    
    const invalidData = { foo: 'bar' };
    
    assert.doesNotThrow(() => api.validateResponse(validData));
    assert.throws(() => api.validateResponse(invalidData));
  });
  
  it('should handle API errors', async () => {
    api.shouldFail = true;
    
    await assert.rejects(
      async () => await api.fetchUpdates(),
      (error) => error.message === 'API error'
    );
  });
});