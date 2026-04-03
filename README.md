# @wipsquare/vies-vat-check

TypeScript client for validating EU VAT numbers with the VIES API.

## Requirements

- Node.js 20 or later

## Install

```bash
npm install @wipsquare/vies-vat-check
```

## Features

- Validate EU VAT numbers with VIES
- Pass VAT input either as separate country/code values or as a full VAT string
- Switch between production and test mode with a configured client
- Automatic retries with exponential backoff
- Check VIES service status
- Typed errors
- TypeScript support included

## Usage

### Validate a VAT number with separate country code and number

```ts
import { checkVat } from '@wipsquare/vies-vat-check';

const result = await checkVat({
  countryCode: 'RO',
  vatNumber: '47366939'
});

console.log(result);
```

### Validate a full VAT number

```ts
import { checkVat } from '@wipsquare/vies-vat-check';

const result = await checkVat({
  vatNumber: 'RO47366939'
});

console.log(result);
```

Example response:

```ts
{
  countryCode: 'RO',
  vatNumber: '47366939',
  valid: true,
  requestDate: '2026-04-03T18:37:16.613Z',
  requestIdentifier: '',
  name: 'WIPSQUARE S.R.L.',
  address: 'ORŞ. CISNĂDIE 555300 STR. MARCEL IANCU Nr. 3 Sc. A Et. PARTER Ap. 3',
  traderName: '---',
  traderStreet: '---',
  traderPostalCode: '---',
  traderCity: '---',
  traderCompanyType: '---',
  traderNameMatch: 'NOT_PROCESSED',
  traderStreetMatch: 'NOT_PROCESSED',
  traderPostalCodeMatch: 'NOT_PROCESSED',
  traderCityMatch: 'NOT_PROCESSED',
  traderCompanyTypeMatch: 'NOT_PROCESSED'
}
```

### Use a configured client

```ts
import { createViesClient } from '@wipsquare/vies-vat-check';

const vies = createViesClient({
  mode: 'test',
  timeoutMs: 10000
});

const result = await vies.checkVat({
  vatNumber: 'DE100'
});

console.log(result);
```

### Retry on failure

```ts
import { createViesClient } from '@wipsquare/vies-vat-check';

const vies = createViesClient({
  retries: 2,
  retryDelayMs: 500
});

const result = await vies.checkVat({
  vatNumber: 'RO47366939'
});

console.log(result);
```

This retries up to 2 times with exponential backoff: 500ms after the first failure, 1000ms after the second. Retries apply to timeouts, network errors, and 5xx responses. Client errors (4xx) and malformed responses are not retried.

### Check VIES service status

```ts
import { checkStatus } from '@wipsquare/vies-vat-check';

const result = await checkStatus();

console.log(result);
```

### Check VIES service status with a configured client

```ts
import { createViesClient } from '@wipsquare/vies-vat-check';

const vies = createViesClient({
  mode: 'prod',
  timeoutMs: 10000
});

const result = await vies.checkStatus();

console.log(result);
```

Example response:

```ts
{
  available: true,
  countries: [
    { countryCode: 'RO', availability: 'Available' },
    { countryCode: 'DE', availability: 'Unavailable' }
  ]
}
```

## API

### `checkVat(input)`

Validates a VAT number through the VIES API using the default client.

Supported input forms:

```ts
checkVat({
  countryCode: 'RO',
  vatNumber: '47366939'
});
```

```ts
checkVat({
  vatNumber: 'RO47366939'
});
```

#### Returns

```ts
{
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
  traderNameMatch?: 'VALID' | 'INVALID' | 'NOT_PROCESSED';
  traderStreetMatch?: 'VALID' | 'INVALID' | 'NOT_PROCESSED';
  traderPostalCodeMatch?: 'VALID' | 'INVALID' | 'NOT_PROCESSED';
  traderCityMatch?: 'VALID' | 'INVALID' | 'NOT_PROCESSED';
  traderCompanyTypeMatch?: 'VALID' | 'INVALID' | 'NOT_PROCESSED';
}
```

### `checkStatus()`

Checks VIES system availability using the default client.

#### Returns

```ts
{
  available: boolean;
  countries: Array<{
    countryCode: string;
    availability: 'Available' | 'Unavailable' | 'Monitoring Disabled';
  }>;
}
```

### `createViesClient(config?)`

Creates a configured VIES client.

#### Config

```ts
{
  mode?: 'prod' | 'test';   // default: 'prod'
  timeoutMs?: number;        // default: 10000
  retries?: number;          // default: 0 (no retries)
  retryDelayMs?: number;     // default: 500
}
```

#### Client methods

```ts
{
  checkVat(input: { countryCode: string; vatNumber: string } | { vatNumber: string }): Promise<CheckVatResult>;
  checkStatus(): Promise<CheckStatusResult>;
}
```

## Notes

- `countryCode` is normalized to uppercase
- spaces are removed from `vatNumber` before the request is sent
- when using the full VAT format, the first two characters are treated as the country code
- some fields such as `name`, `address`, and trader details depend on what VIES returns for that VAT number and country
- the package returns the country code, not a full country name
- retries use exponential backoff: `retryDelayMs * 2^attempt` (e.g. 500ms, 1000ms, 2000ms)
- retries apply to timeouts, network errors, and 5xx HTTP responses
- 4xx responses and malformed responses are not retried

## Errors

The package can throw these error types:

- `ViesError` — base class for all errors
- `ViesHttpError` — non-2xx response from VIES (exposes `.status`)
- `ViesNetworkError` — fetch failed (exposes `.cause`)
- `ViesResponseError` — response body could not be parsed
- `ViesTimeoutError` — request exceeded `timeoutMs`

All errors extend `ViesError`, so you can catch broadly or narrowly:

```ts
import {
  checkVat,
  ViesError,
  ViesHttpError,
  ViesTimeoutError
} from '@wipsquare/vies-vat-check';

try {
  await checkVat({
    vatNumber: 'RO47366939'
  });
} catch (error) {
  if (error instanceof ViesTimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof ViesHttpError) {
    console.error(`HTTP error: ${error.status}`);
  } else if (error instanceof ViesError) {
    console.error('VIES error:', error.message);
  } else {
    throw error;
  }
}
```

## Development

Install dependencies:

```bash
npm install
```

Run type checking:

```bash
npm run check
```

Run tests:

```bash
npm test
```

Build:

```bash
npm run build
```

## License

MIT