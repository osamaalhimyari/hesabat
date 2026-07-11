/**
 * The ISO-4217 currency codes the app supports for a user's `defaultCurrency`.
 * Kept in sync with the client's `core/constants/currencies.dart`. The list is
 * an allow-list: `updateSettings` rejects anything outside it, so an arbitrary
 * 3-char code can never be persisted.
 *
 * `app/services/money.ts` already knows each of these currencies' exponent
 * (0 / 2 / 3 decimals), so no other change is needed when this list grows.
 */
export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD',
  'EGP', 'IQD', 'LYD', 'TND', 'TRY', 'LBP', 'SYP', 'YER', 'MAD', 'DZD',
  'SDG', 'PKR', 'INR', 'JPY', 'CNY', 'CAD', 'AUD', 'CHF',
] as const

const SUPPORTED_SET = new Set<string>(SUPPORTED_CURRENCIES)

/** True when `code` (case-insensitive) is one of the supported currencies. */
export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_SET.has((code || '').toUpperCase())
}
