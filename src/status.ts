// src/status.ts

import {
  ViesHttpError,
  ViesNetworkError,
  ViesResponseError,
  ViesTimeoutError
} from './errors.js';
import type { ViesClientConfig, ViesMode } from './client.js';

export interface CountryStatus {
  countryCode: string;
  availability: 'Available' | 'Unavailable' | 'Monitoring Disabled';
}

export interface CheckStatusResult {
  available: boolean;
  countries: CountryStatus[];
}

const STATUS_ENDPOINTS: Record<ViesMode, string> = {
  prod: 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-status',
  test: 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-status'
};

export async function getCheckStatus(
  config: ViesClientConfig = {}
): Promise<CheckStatusResult> {
  const mode = config.mode ?? 'prod';
  const timeoutMs = config.timeoutMs ?? 10_000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(STATUS_ENDPOINTS[mode], {
      method: 'GET',
      headers: {
        accept: 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new ViesHttpError(response.status);
    }

    const json: unknown = await response.json();
    return parseStatusResponse(json);
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

function parseStatusResponse(value: unknown): CheckStatusResult {
  if (!value || typeof value !== 'object') {
    throw new ViesResponseError('Invalid status response from VIES API');
  }

  const root = value as {
    vow?: {
      available?: unknown;
      countries?: unknown;
    };
  };

  if (!root.vow || typeof root.vow !== 'object') {
    throw new ViesResponseError('VIES status response is missing vow');
  }

  if (typeof root.vow.available !== 'boolean') {
    throw new ViesResponseError('VIES status response is missing available boolean');
  }

  const countriesRaw = root.vow.countries;

  if (countriesRaw !== undefined && !Array.isArray(countriesRaw)) {
    throw new ViesResponseError('VIES status response has invalid countries');
  }

  const countries: CountryStatus[] = (countriesRaw ?? []).map((item) => {
    if (!item || typeof item !== 'object') {
      throw new ViesResponseError('Invalid country status entry');
    }

    const entry = item as {
      countryCode?: unknown;
      availability?: unknown;
    };

    if (typeof entry.countryCode !== 'string' || typeof entry.availability !== 'string') {
      throw new ViesResponseError('Invalid country status entry');
    }

    if (
      entry.availability !== 'Available' &&
      entry.availability !== 'Unavailable' &&
      entry.availability !== 'Monitoring Disabled'
    ) {
      throw new ViesResponseError('Invalid country availability value');
    }

    return {
      countryCode: entry.countryCode,
      availability: entry.availability
    };
  });

  return {
    available: root.vow.available,
    countries
  };
}