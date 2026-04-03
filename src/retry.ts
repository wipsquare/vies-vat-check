// src/reetry.ts

import { ViesHttpError, ViesResponseError } from './errors.js';

export interface RetryConfig {
  retries: number;
  retryDelayMs: number;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof ViesResponseError) {
    return false;
  }

  if (error instanceof ViesHttpError) {
    return error.status >= 500;
  }

  return true;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= config.retries || !isRetryable(error)) {
        throw error;
      }

      const backoff = config.retryDelayMs * 2 ** attempt;
      await delay(backoff);
    }
  }

  throw lastError;
}