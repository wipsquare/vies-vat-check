// test/retry.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkVat,
  createViesClient,
  ViesHttpError,
  ViesNetworkError,
  ViesResponseError
} from '../src/index.js';

const VALID_RESPONSE = JSON.stringify({
  countryCode: 'RO',
  vatNumber: '123456',
  valid: true
});

function okResponse(): Response {
  return new Response(VALID_RESPONSE, {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

test('does not retry by default', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount++;
    throw new TypeError('fetch failed');
  };

  try {
    await assert.rejects(
      () => checkVat({ countryCode: 'RO', vatNumber: '123456' }),
      (error: unknown) => {
        assert.ok(error instanceof ViesNetworkError);
        return true;
      }
    );

    assert.equal(callCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retries on network error and succeeds', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount++;
    if (callCount < 3) {
      throw new TypeError('fetch failed');
    }
    return okResponse();
  };

  try {
    const vies = createViesClient({ retries: 2, retryDelayMs: 10 });

    const result = await vies.checkVat({
      countryCode: 'RO',
      vatNumber: '123456'
    });

    assert.equal(callCount, 3);
    assert.equal(result.valid, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retries on 5xx and succeeds', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount++;
    if (callCount < 2) {
      return new Response('fail', { status: 500 });
    }
    return okResponse();
  };

  try {
    const vies = createViesClient({ retries: 2, retryDelayMs: 10 });

    const result = await vies.checkVat({
      countryCode: 'RO',
      vatNumber: '123456'
    });

    assert.equal(callCount, 2);
    assert.equal(result.valid, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('throws after exhausting all retries on network error', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount++;
    throw new TypeError('fetch failed');
  };

  try {
    const vies = createViesClient({ retries: 2, retryDelayMs: 10 });

    await assert.rejects(
      () => vies.checkVat({ countryCode: 'RO', vatNumber: '123456' }),
      (error: unknown) => {
        assert.ok(error instanceof ViesNetworkError);
        return true;
      }
    );

    assert.equal(callCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('throws after exhausting all retries on 5xx', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount++;
    return new Response('fail', { status: 503 });
  };

  try {
    const vies = createViesClient({ retries: 2, retryDelayMs: 10 });

    await assert.rejects(
      () => vies.checkVat({ countryCode: 'RO', vatNumber: '123456' }),
      (error: unknown) => {
        assert.ok(error instanceof ViesHttpError);
        assert.equal(error.status, 503);
        return true;
      }
    );

    assert.equal(callCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not retry on 4xx', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount++;
    return new Response('bad request', { status: 400 });
  };

  try {
    const vies = createViesClient({ retries: 2, retryDelayMs: 10 });

    await assert.rejects(
      () => vies.checkVat({ countryCode: 'RO', vatNumber: '123456' }),
      (error: unknown) => {
        assert.ok(error instanceof ViesHttpError);
        assert.equal(error.status, 400);
        return true;
      }
    );

    assert.equal(callCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not retry on malformed response', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount++;
    return new Response(
      JSON.stringify({ countryCode: 'RO' }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  };

  try {
    const vies = createViesClient({ retries: 2, retryDelayMs: 10 });

    await assert.rejects(
      () => vies.checkVat({ countryCode: 'RO', vatNumber: '123456' }),
      (error: unknown) => {
        assert.ok(error instanceof ViesResponseError);
        return true;
      }
    );

    assert.equal(callCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retries on timeout and succeeds', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    callCount++;
    if (callCount < 2) {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
        });
      });
    }
    return okResponse();
  };

  try {
    const vies = createViesClient({
      retries: 2,
      retryDelayMs: 10,
      timeoutMs: 50
    });

    const result = await vies.checkVat({
      countryCode: 'RO',
      vatNumber: '123456'
    });

    assert.equal(callCount, 2);
    assert.equal(result.valid, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retries use exponential backoff', async () => {
  const originalFetch = globalThis.fetch;
  const timestamps: number[] = [];

  globalThis.fetch = async () => {
    timestamps.push(Date.now());
    if (timestamps.length < 4) {
      throw new TypeError('fetch failed');
    }
    return okResponse();
  };

  try {
    const vies = createViesClient({ retries: 3, retryDelayMs: 100 });

    await vies.checkVat({ countryCode: 'RO', vatNumber: '123456' });

    assert.equal(timestamps.length, 4);

    const gap1 = timestamps[1]! - timestamps[0]!;
    const gap2 = timestamps[2]! - timestamps[1]!;
    const gap3 = timestamps[3]! - timestamps[2]!;

    // retryDelayMs * 2^0 = 100, * 2^1 = 200, * 2^2 = 400
    // Allow 50ms tolerance for timer imprecision
    assert.ok(gap1 >= 80, `First gap ${gap1}ms should be ~100ms`);
    assert.ok(gap2 >= 160, `Second gap ${gap2}ms should be ~200ms`);
    assert.ok(gap3 >= 320, `Third gap ${gap3}ms should be ~400ms`);
    assert.ok(gap2 > gap1, 'Second gap should be larger than first');
    assert.ok(gap3 > gap2, 'Third gap should be larger than second');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retry works with checkStatus', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async () => {
    callCount++;
    if (callCount < 2) {
      throw new TypeError('fetch failed');
    }
    return new Response(
      JSON.stringify({
        vow: {
          available: true,
          countries: []
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  };

  try {
    const vies = createViesClient({ retries: 2, retryDelayMs: 10 });

    const result = await vies.checkStatus();

    assert.equal(callCount, 2);
    assert.equal(result.available, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});