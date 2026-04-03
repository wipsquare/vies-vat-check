// src/client.ts
import {
  ViesHttpError,
  ViesNetworkError,
  ViesResponseError,
  ViesTimeoutError
} from './errors.js';
import { withRetry } from './retry.js';

export type ViesMode = 'prod' | 'test';

export interface ViesClientConfig {
  mode?: ViesMode;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export interface ViesApiRequest {
  countryCode: string;
  vatNumber: string;
}

interface ViesApiResponseRaw {
  countryCode?: unknown;
  vatNumber?: unknown;
  valid?: unknown;
  requestDate?: unknown;
  requestIdentifier?: unknown;
  name?: unknown;
  address?: unknown;
  traderName?: unknown;
  traderStreet?: unknown;
  traderPostalCode?: unknown;
  traderCity?: unknown;
  traderCompanyType?: unknown;
  traderNameMatch?: unknown;
  traderStreetMatch?: unknown;
  traderPostalCodeMatch?: unknown;
  traderCityMatch?: unknown;
  traderCompanyTypeMatch?: unknown;
}

export type ViesMatch = 'VALID' | 'INVALID' | 'NOT_PROCESSED';

export interface ViesApiResponse {
  valid: boolean;
  countryCode?: string;
  vatNumber?: string;
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

const ENDPOINTS: Record<ViesMode, string> = {
  prod: 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number',
  test: 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-test-service'
};

export async function postCheckVat(
  input: ViesApiRequest,
  config: ViesClientConfig = {}
): Promise<ViesApiResponse> {
  const retries = config.retries ?? 0;
  const retryDelayMs = config.retryDelayMs ?? 500;

  return withRetry(() => executeCheckVat(input, config), {
    retries,
    retryDelayMs
  });
}

async function executeCheckVat(
  input: ViesApiRequest,
  config: ViesClientConfig
): Promise<ViesApiResponse> {
  const mode = config.mode ?? 'prod';
  const timeoutMs = config.timeoutMs ?? 10_000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ENDPOINTS[mode], {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(input),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new ViesHttpError(response.status);
    }

    const json: unknown = await response.json();
    return parseViesApiResponse(json);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ViesTimeoutError(timeoutMs);
    }

    if (error instanceof ViesHttpError || error instanceof ViesResponseError) {
      throw error;
    }

    throw new ViesNetworkError('VIES network request failed', error);
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseViesApiResponse(value: unknown): ViesApiResponse {
  if (!value || typeof value !== 'object') {
    throw new ViesResponseError();
  }

  const data = value as ViesApiResponseRaw;

  if (typeof data.valid !== 'boolean') {
    throw new ViesResponseError('VIES API response is missing a valid boolean');
  }

  const result: ViesApiResponse = {
    valid: data.valid
  };

  if (typeof data.countryCode === 'string') {
    result.countryCode = data.countryCode;
  }

  if (typeof data.vatNumber === 'string') {
    result.vatNumber = data.vatNumber;
  }

  if (typeof data.requestDate === 'string') {
    result.requestDate = data.requestDate;
  }

  if (typeof data.requestIdentifier === 'string') {
    result.requestIdentifier = data.requestIdentifier;
  }

  if (typeof data.name === 'string') {
    result.name = data.name;
  }

  if (typeof data.address === 'string') {
    result.address = data.address;
  }

  if (typeof data.traderName === 'string') {
    result.traderName = data.traderName;
  }

  if (typeof data.traderStreet === 'string') {
    result.traderStreet = data.traderStreet;
  }

  if (typeof data.traderPostalCode === 'string') {
    result.traderPostalCode = data.traderPostalCode;
  }

  if (typeof data.traderCity === 'string') {
    result.traderCity = data.traderCity;
  }

  if (typeof data.traderCompanyType === 'string') {
    result.traderCompanyType = data.traderCompanyType;
  }

  addMatchField(result, 'traderNameMatch', data.traderNameMatch);
  addMatchField(result, 'traderStreetMatch', data.traderStreetMatch);
  addMatchField(result, 'traderPostalCodeMatch', data.traderPostalCodeMatch);
  addMatchField(result, 'traderCityMatch', data.traderCityMatch);
  addMatchField(result, 'traderCompanyTypeMatch', data.traderCompanyTypeMatch);

  return result;
}

function addMatchField(
  result: ViesApiResponse,
  key:
    | 'traderNameMatch'
    | 'traderStreetMatch'
    | 'traderPostalCodeMatch'
    | 'traderCityMatch'
    | 'traderCompanyTypeMatch',
  value: unknown
): void {
  if (value === 'VALID' || value === 'INVALID' || value === 'NOT_PROCESSED') {
    result[key] = value;
  }
}