// test/integration.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { checkStatus, checkVat, createViesClient } from '../src/index.js';

test('integration: checkStatus returns live status data', async () => {
  const result = await checkStatus();

  assert.equal(typeof result.available, 'boolean');
  assert.ok(Array.isArray(result.countries));

  for (const country of result.countries) {
    assert.equal(typeof country.countryCode, 'string');
    assert.ok(
      country.availability === 'Available' ||
        country.availability === 'Unavailable' ||
        country.availability === 'Monitoring Disabled'
    );
  }
});

test('integration: test client calls live VIES test endpoint', async () => {
  const vies = createViesClient({
    mode: 'test',
    timeoutMs: 10000
  });

  const result = await vies.checkVat({
    countryCode: 'DE',
    vatNumber: '100'
  });

  assert.equal(typeof result.valid, 'boolean');
  assert.equal(result.countryCode, 'DE');
  assert.equal(typeof result.vatNumber, 'string');
});

test('integration: fetches live data for Wipsquare VAT', async () => {
  const result = await checkVat({
    countryCode: 'RO',
    vatNumber: '47366939'
  });

  assert.equal(result.countryCode, 'RO');
  assert.equal(result.vatNumber, '47366939');
  assert.equal(typeof result.valid, 'boolean');

  console.dir(result, { depth: null });
});