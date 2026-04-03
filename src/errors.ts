// src/errors.ts

export class ViesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ViesError';
  }
}

export class ViesTimeoutError extends ViesError {
  constructor(timeoutMs: number) {
    super(`VIES request timed out after ${timeoutMs}ms`);
    this.name = 'ViesTimeoutError';
  }
}

export class ViesHttpError extends ViesError {
  public readonly status: number;

  constructor(status: number) {
    super(`VIES request failed with status ${status}`);
    this.name = 'ViesHttpError';
    this.status = status;
  }
}

export class ViesNetworkError extends ViesError {
  public readonly cause: unknown;

  constructor(message = 'VIES network request failed', cause?: unknown) {
    super(message);
    this.name = 'ViesNetworkError';
    this.cause = cause;
  }
}

export class ViesResponseError extends ViesError {
  constructor(message = 'Invalid response from VIES API') {
    super(message);
    this.name = 'ViesResponseError';
  }
}