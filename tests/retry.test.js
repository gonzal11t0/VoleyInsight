const assert = require('node:assert');
const { describe, it, beforeEach } = require('node:test');
const { retry, NetworkError } = require('../services/retry');

describe('Retry Utility', () => {
  it('should succeed on first attempt', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return 'success';
    };
    
    const result = await retry(fn, { attempts: 3, backoffMs: 10 });
    assert.strictEqual(result, 'success');
    assert.strictEqual(calls, 1);
  });
  
  it('should retry on failure and succeed', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) throw new NetworkError('Temporary failure');
      return 'success';
    };
    
    const result = await retry(fn, { attempts: 3, backoffMs: 10 });
    assert.strictEqual(result, 'success');
    assert.strictEqual(calls, 3);
  });
  
  it('should throw after max attempts', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new NetworkError('Persistent failure');
    };
    
    await assert.rejects(
      async () => await retry(fn, { attempts: 3, backoffMs: 10 }),
      (error) => error.message === 'Persistent failure'
    );
    assert.strictEqual(calls, 3);
  });
  
  it('should not retry on non-retryable errors', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new Error('Non-retryable');
    };
    
    const shouldRetry = () => false;
    
    await assert.rejects(
      async () => await retry(fn, { attempts: 3, shouldRetry }),
      (error) => error.message === 'Non-retryable'
    );
    assert.strictEqual(calls, 1);
  });
  
  it('should use exponential backoff', async () => {
    const delays = [];
    let calls = 0;
    
    const fn = async () => {
      calls++;
      throw new NetworkError('Fail');
    };
    
    const originalSetTimeout = global.setTimeout;
    let timeoutCalled = 0;
    
    global.setTimeout = (fn, delay) => {
      delays.push(delay);
      timeoutCalled++;
      return originalSetTimeout(fn, 0); // Execute immediately for test
    };
    
    try {
      await retry(fn, { attempts: 3, backoffMs: 100 });
    } catch (error) {
      // Expected
    }
    
    // First retry: 100ms, second retry: 200ms
    assert.strictEqual(delays.length, 2);
    assert.strictEqual(delays[0], 100);
    assert.strictEqual(delays[1], 200);
    
    global.setTimeout = originalSetTimeout;
  });
});