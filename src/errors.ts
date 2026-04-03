// src/errors.ts

export class ViesError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ViesError';
    Object.setPrototypeOf(this, new.target.prototype);
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
  constructor(message = 'VIES network request failed', cause?: unknown) {
    super(message, { cause });
    this.name = 'ViesNetworkError';
  }
}

export class ViesResponseError extends ViesError {
  constructor(message = 'Invalid response from VIES API') {
    super(message);
    this.name = 'ViesResponseError';
  }
}