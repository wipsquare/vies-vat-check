// test/index.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkStatus,
  checkVat,
  createViesClient,
  normalizeCountryCode,
  normalizeVatNumber,
  validateInput,
  ViesHttpError,
  ViesNetworkError,
  ViesResponseError
} from '../src/index.js';

test('normalizeCountryCode uppercases and trims', () => {
  assert.equal(normalizeCountryCode(' ro '), 'RO');
});

test('normalizeVatNumber removes spaces', () => {
  assert.equal(normalizeVatNumber(' 12 34 56 '), '123456');
});

test('validateInput throws when countryCode is missing', () => {
  assert.throws(
    () => validateInput({ countryCode: '', vatNumber: '123' }),
    /countryCode is required/
  );
});

test('validateInput throws when vatNumber is missing', () => {
  assert.throws(
    () => validateInput({ countryCode: 'RO', vatNumber: '   ' }),
    /vatNumber is required/
  );
});

test('validateInput throws for unsupported country', () => {
  assert.throws(
    () => validateInput({ countryCode: 'US', vatNumber: '123' }),
    /Unsupported countryCode: US/
  );
});

test('checkVat uses prod endpoint by default and returns full response fields', async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = '';
  let calledMethod = '';
  let calledBody = '';

  globalThis.fetch = async (input, init) => {
    calledUrl = String(input);
    calledMethod = init?.method ?? '';
    calledBody = String(init?.body ?? '');

    return new Response(
      JSON.stringify({
        countryCode: 'RO',
        vatNumber: '123456',
        valid: true,
        requestDate: '2026-04-03',
        requestIdentifier: 'req-123',
        name: 'ACME SRL',
        address: 'Bucharest',
        traderName: 'ACME SRL',
        traderStreet: 'Main Street 1',
        traderPostalCode: '010101',
        traderCity: 'Bucharest',
        traderCompanyType: 'SRL',
        traderNameMatch: 'VALID',
        traderStreetMatch: 'VALID',
        traderPostalCodeMatch: 'VALID',
        traderCityMatch: 'INVALID',
        traderCompanyTypeMatch: 'NOT_PROCESSED'
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  };

  try {
    const result = await checkVat({
      countryCode: ' ro ',
      vatNumber: ' 12 34 56 '
    });

    assert.equal(
      calledUrl,
      'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number'
    );
    assert.equal(calledMethod, 'POST');
    assert.equal(
      calledBody,
      JSON.stringify({
        countryCode: 'RO',
        vatNumber: '123456'
      })
    );

    assert.deepEqual(result, {
      countryCode: 'RO',
      vatNumber: '123456',
      valid: true,
      requestDate: '2026-04-03',
      requestIdentifier: 'req-123',
      name: 'ACME SRL',
      address: 'Bucharest',
      traderName: 'ACME SRL',
      traderStreet: 'Main Street 1',
      traderPostalCode: '010101',
      traderCity: 'Bucharest',
      traderCompanyType: 'SRL',
      traderNameMatch: 'VALID',
      traderStreetMatch: 'VALID',
      traderPostalCodeMatch: 'VALID',
      traderCityMatch: 'INVALID',
      traderCompanyTypeMatch: 'NOT_PROCESSED'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('client uses test endpoint when configured', async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = '';

  globalThis.fetch = async (input) => {
    calledUrl = String(input);

    return new Response(
      JSON.stringify({
        valid: false
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  };

  try {
    const vies = createViesClient({ mode: 'test' });

    const result = await vies.checkVat({
      countryCode: 'RO',
      vatNumber: '123456'
    });

    assert.equal(
      calledUrl,
      'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-test-service'
    );

    assert.deepEqual(result, {
      countryCode: 'RO',
      vatNumber: '123456',
      valid: false
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkVat throws ViesHttpError on non-200 response', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response('fail', {
      status: 500
    });

  try {
    await assert.rejects(
      () => checkVat({ countryCode: 'RO', vatNumber: '123456' }),
      (error: unknown) => {
        assert.ok(error instanceof ViesHttpError);
        assert.equal(error.status, 500);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkVat throws ViesResponseError on malformed response', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        countryCode: 'RO'
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );

  try {
    await assert.rejects(
      () => checkVat({ countryCode: 'RO', vatNumber: '123456' }),
      (error: unknown) => {
        assert.ok(error instanceof ViesResponseError);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkVat throws ViesNetworkError on fetch failure', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
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
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkStatus returns parsed status response', async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = '';
  let calledMethod = '';

  globalThis.fetch = async (input, init) => {
    calledUrl = String(input);
    calledMethod = init?.method ?? '';

    return new Response(
      JSON.stringify({
        vow: {
          available: true,
          countries: [
            {
              countryCode: 'RO',
              availability: 'Available'
            },
            {
              countryCode: 'DE',
              availability: 'Unavailable'
            }
          ]
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  };

  try {
    const result = await checkStatus();

    assert.equal(
      calledUrl,
      'https://ec.europa.eu/taxation_customs/vies/rest-api/check-status'
    );
    assert.equal(calledMethod, 'GET');

    assert.deepEqual(result, {
      available: true,
      countries: [
        {
          countryCode: 'RO',
          availability: 'Available'
        },
        {
          countryCode: 'DE',
          availability: 'Unavailable'
        }
      ]
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkStatus throws ViesResponseError on malformed response', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        vow: {
          countries: []
        }
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );

  try {
    await assert.rejects(
      () => checkStatus(),
      (error: unknown) => {
        assert.ok(error instanceof ViesResponseError);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('client checkStatus uses configured test mode', async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = '';

  globalThis.fetch = async (input) => {
    calledUrl = String(input);

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
    const vies = createViesClient({ mode: 'test' });

    const result = await vies.checkStatus();

    assert.equal(
      calledUrl,
      'https://ec.europa.eu/taxation_customs/vies/rest-api/check-status'
    );

    assert.deepEqual(result, {
      available: true,
      countries: []
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkVat accepts full VAT code in a single string', async () => {
  const originalFetch = globalThis.fetch;
  let calledBody = '';

  globalThis.fetch = async (_input, init) => {
    calledBody = String(init?.body ?? '');

    return new Response(
      JSON.stringify({
        countryCode: 'RO',
        vatNumber: '47366939',
        valid: true
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    );
  };

  try {
    const result = await checkVat({
      vatNumber: 'RO47366939'
    });

    assert.equal(
      calledBody,
      JSON.stringify({
        countryCode: 'RO',
        vatNumber: '47366939'
      })
    );

    assert.deepEqual(result, {
      countryCode: 'RO',
      vatNumber: '47366939',
      valid: true
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('validateInput accepts full VAT code in a single string', () => {
  assert.doesNotThrow(() => validateInput({ vatNumber: 'RO47366939' }));
});