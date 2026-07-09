/**
 * Money is stored as a positive integer in the currency's smallest unit
 * ("minor units", e.g. cents/fils). This module converts between the
 * human-decimal strings the API exchanges and those integers, using the
 * currency's ISO-4217 exponent. Never use floats for money.
 */

/** Currencies whose exponent is not the default of 2. */
const EXPONENTS: Record<string, number> = {
  // Zero-decimal
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  XOF: 0,
  XAF: 0,
  // Three-decimal
  BHD: 3,
  KWD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
  IQD: 3,
  LYD: 3,
}

export function currencyExponent(currency: string): number {
  return EXPONENTS[(currency || '').toUpperCase()] ?? 2
}

/**
 * Parse a human-decimal string (e.g. "12.50") into minor units for the given
 * currency (e.g. 1250 for USD). Extra fraction digits are truncated.
 */
export function toMinor(amount: string | number, currency: string): number {
  const exp = currencyExponent(currency)
  const raw = String(amount).trim()
  const sign = raw.startsWith('-') ? -1 : 1
  const [wholePart = '0', fracPart = ''] = raw.replace('-', '').split('.')
  const whole = wholePart === '' ? '0' : wholePart
  const frac = (fracPart + '0'.repeat(exp)).slice(0, exp)
  const minor = Number(whole) * 10 ** exp + (exp === 0 ? 0 : Number(frac))
  return sign * minor
}

/**
 * Format minor units back into a human-decimal string (e.g. 1250 -> "12.50").
 */
export function formatMinor(minor: number, currency: string): string {
  const exp = currencyExponent(currency)
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(minor))
  if (exp === 0) return `${sign}${abs}`
  const factor = 10 ** exp
  const whole = Math.floor(abs / factor)
  const frac = (abs % factor).toString().padStart(exp, '0')
  return `${sign}${whole}.${frac}`
}

/** The `{ minor, currency, display }` object the API serializes for money fields. */
export function money(minor: number, currency: string) {
  return { minor, currency, display: formatMinor(minor, currency) }
}
