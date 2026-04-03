// src/index.ts

import {
  postCheckVat,
  type ViesClientConfig,
  type ViesMode,
  type ViesMatch
} from './client.js';
import { getCheckStatus, type CheckStatusResult, type CountryStatus } from './status.js';

export type { ViesMode, ViesClientConfig, ViesMatch };
export type { CheckStatusResult, CountryStatus };

export {
  ViesError,
  ViesHttpError,
  ViesNetworkError,
  ViesResponseError,
  ViesTimeoutError
} from './errors.js';

export interface CheckVatInputSeparate {
  countryCode: string;
  vatNumber: string;
}

export interface CheckVatInputCombined {
  vatNumber: string;
}

export type CheckVatInput = CheckVatInputSeparate | CheckVatInputCombined;

export interface CheckVatResult {
  countryCode: string;
  vatNumber: string;
  valid: boolean;
  requestDate?: string;
  requestIdentifier?: string;
  name?: string;
  address?: string;
  traderName?: string;
  traderStreet?: string;
  traderPostalCode?: string;
  traderCity?: string;
  traderCompanyType?: string;
  traderNameMatch?: ViesMatch;
  traderStreetMatch?: ViesMatch;
  traderPostalCodeMatch?: ViesMatch;
  traderCityMatch?: ViesMatch;
  traderCompanyTypeMatch?: ViesMatch;
}

export interface ViesClient {
  checkVat(input: CheckVatInput): Promise<CheckVatResult>;
  checkStatus(): Promise<CheckStatusResult>;
}

const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI',
  'FR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO',
  'SE', 'SI', 'SK', 'XI'
]);

export function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeVatNumber(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function resolveCheckVatInput(input: CheckVatInput): {
  countryCode: string;
  vatNumber: string;
} {
  if ('countryCode' in input) {
    return {
      countryCode: normalizeCountryCode(input.countryCode),
      vatNumber: normalizeVatNumber(input.vatNumber)
    };
  }

  const normalizedVat = normalizeVatNumber(input.vatNumber);

  return {
    countryCode: normalizedVat.slice(0, 2),
    vatNumber: normalizedVat.slice(2)
  };
}

export function validateInput(input: CheckVatInput): void {
  const { countryCode, vatNumber } = resolveCheckVatInput(input);

  if (!countryCode) {
    throw new Error('countryCode is required');
  }

  if (!vatNumber) {
    throw new Error('vatNumber is required');
  }

  if (!EU_COUNTRY_CODES.has(countryCode)) {
    throw new Error(`Unsupported countryCode: ${countryCode}`);
  }
}

async function checkVatWithConfig(
  input: CheckVatInput,
  config: ViesClientConfig
): Promise<CheckVatResult> {
  validateInput(input);

  const { countryCode, vatNumber } = resolveCheckVatInput(input);

  const data = await postCheckVat(
    {
      countryCode,
      vatNumber
    },
    config
  );

  const result: CheckVatResult = {
    countryCode: data.countryCode ?? countryCode,
    vatNumber: data.vatNumber ?? vatNumber,
    valid: data.valid
  };

  if (data.requestDate !== undefined) {
    result.requestDate = data.requestDate;
  }

  if (data.requestIdentifier !== undefined) {
    result.requestIdentifier = data.requestIdentifier;
  }

  if (data.name !== undefined) {
    result.name = data.name;
  }

  if (data.address !== undefined) {
    result.address = data.address;
  }

  if (data.traderName !== undefined) {
    result.traderName = data.traderName;
  }

  if (data.traderStreet !== undefined) {
    result.traderStreet = data.traderStreet;
  }

  if (data.traderPostalCode !== undefined) {
    result.traderPostalCode = data.traderPostalCode;
  }

  if (data.traderCity !== undefined) {
    result.traderCity = data.traderCity;
  }

  if (data.traderCompanyType !== undefined) {
    result.traderCompanyType = data.traderCompanyType;
  }

  if (data.traderNameMatch !== undefined) {
    result.traderNameMatch = data.traderNameMatch;
  }

  if (data.traderStreetMatch !== undefined) {
    result.traderStreetMatch = data.traderStreetMatch;
  }

  if (data.traderPostalCodeMatch !== undefined) {
    result.traderPostalCodeMatch = data.traderPostalCodeMatch;
  }

  if (data.traderCityMatch !== undefined) {
    result.traderCityMatch = data.traderCityMatch;
  }

  if (data.traderCompanyTypeMatch !== undefined) {
    result.traderCompanyTypeMatch = data.traderCompanyTypeMatch;
  }

  return result;
}

export function createViesClient(config: ViesClientConfig = {}): ViesClient {
  return {
    checkVat(input: CheckVatInput): Promise<CheckVatResult> {
      return checkVatWithConfig(input, config);
    },
    checkStatus(): Promise<CheckStatusResult> {
      return getCheckStatus(config);
    }
  };
}

const defaultClient = createViesClient();

/**
 * Validate a VAT number by passing country code and numeric part separately.
 * Example: { countryCode: 'RO', vatNumber: '47366939' }
 */
export function checkVat(input: CheckVatInputSeparate): Promise<CheckVatResult>;

/**
 * Validate a full VAT number including country prefix.
 * Example: { vatNumber: 'RO47366939' }
 */
export function checkVat(input: CheckVatInputCombined): Promise<CheckVatResult>;

export async function checkVat(input: CheckVatInput): Promise<CheckVatResult> {
  return defaultClient.checkVat(input);
}

export async function checkStatus(): Promise<CheckStatusResult> {
  return defaultClient.checkStatus();
}
