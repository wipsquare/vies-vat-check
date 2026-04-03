import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkVat,
  normalizeCountryCode,
  normalizeVatNumber,
  validateInput
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

test('checkVat returns normalized input', async () => {
  const result = await checkVat({
    countryCode: ' ro ',
    vatNumber: ' 12 34 56 '
  });

  assert.deepEqual(result, {
    countryCode: 'RO',
    vatNumber: '123456',
    valid: false
  });
});