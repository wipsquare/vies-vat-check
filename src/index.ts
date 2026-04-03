export interface CheckVatInput {
  countryCode: string;
  vatNumber: string;
}

export interface CheckVatResult {
  countryCode: string;
  vatNumber: string;
  valid: boolean;
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
  return value.trim().replace(/\s+/g, '');
}

export function validateInput(input: CheckVatInput): void {
  const countryCode = normalizeCountryCode(input.countryCode);
  const vatNumber = normalizeVatNumber(input.vatNumber);

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

export async function checkVat(input: CheckVatInput): Promise<CheckVatResult> {
  validateInput(input);

  return {
    countryCode: normalizeCountryCode(input.countryCode),
    vatNumber: normalizeVatNumber(input.vatNumber),
    valid: false
  };
}