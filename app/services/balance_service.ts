import db from '@adonisjs/lucid/services/db'

export type TransactionType = 'lend' | 'borrow' | 'receipt' | 'expense'

/**
 * The one place the balance sign convention lives (see the "Open Decisions"
 * section of plan.md — this is the client-confirmable business rule).
 *
 * +1 increases what the CONTACT owes the user; -1 increases what the USER owes.
 *   lend    -> +  (I gave them money; they owe me)
 *   expense -> +  (I paid money out; settles what I owe / a cost)
 *   borrow  -> -  (I took their money; I owe them)
 *   receipt -> -  (money came in; settles what they owe me)
 */
export function signOf(type: TransactionType): number {
  return type === 'lend' || type === 'expense' ? 1 : -1
}

/** SQL expression for the signed minor amount of a `transactions` row aliased `tx`. */
const SIGNED_MINOR = `tx.amount_minor * (CASE tx.type ` +
  `WHEN 'lend' THEN 1 WHEN 'expense' THEN 1 ELSE -1 END)`

export interface CurrencyBalance {
  currency: string
  balanceMinor: number
}

export interface ContactOutstanding extends CurrencyBalance {
  contactId: number
}

/**
 * Outstanding balance per contact, per currency, across each contact's ACTIVE
 * ledger only (archived books are settled and excluded — see plan decision #2).
 * Only non-zero balances are returned, so this powers the Home contacts list.
 */
export async function outstandingByContact(userId: number): Promise<ContactOutstanding[]> {
  const rows = await db
    .from('transactions as tx')
    .join('ledgers as l', 'l.id', 'tx.ledger_id')
    .where('tx.user_id', userId)
    .where('l.status', 'active')
    .groupBy('l.contact_id', 'tx.currency')
    .select('l.contact_id as contactId', 'tx.currency as currency')
    .sum({ balanceMinor: db.raw(SIGNED_MINOR) })

  return rows
    .map((r: any) => ({
      contactId: Number(r.contactId),
      currency: String(r.currency),
      balanceMinor: Number(r.balanceMinor ?? 0),
    }))
    .filter((r) => r.balanceMinor !== 0)
}

/** Signed balance per currency for a single ledger (all of its transactions). */
export async function ledgerBalanceByCurrency(
  userId: number,
  ledgerId: number
): Promise<CurrencyBalance[]> {
  const rows = await db
    .from('transactions as tx')
    .where('tx.user_id', userId)
    .where('tx.ledger_id', ledgerId)
    .groupBy('tx.currency')
    .select('tx.currency as currency')
    .sum({ balanceMinor: db.raw(SIGNED_MINOR) })

  return rows.map((r: any) => ({
    currency: String(r.currency),
    balanceMinor: Number(r.balanceMinor ?? 0),
  }))
}

export interface CurrencySummary {
  currency: string
  totals: { lend: number; borrow: number; receipt: number; expense: number }
  netMinor: number
}

/**
 * Per-currency totals broken down by type + the net signed balance, for the
 * lend-vs-borrow chart. Scoped to a contact; to a single ledger when `ledgerId`
 * is given, otherwise to the contact's active ledger(s).
 */
export async function contactSummary(
  userId: number,
  contactId: number,
  ledgerId?: number
): Promise<CurrencySummary[]> {
  const query = db
    .from('transactions as tx')
    .join('ledgers as l', 'l.id', 'tx.ledger_id')
    .where('tx.user_id', userId)
    .where('l.contact_id', contactId)

  if (ledgerId) query.where('tx.ledger_id', ledgerId)
  else query.where('l.status', 'active')

  const rows = await query
    .groupBy('tx.currency', 'tx.type')
    .select('tx.currency as currency', 'tx.type as type')
    .sum({ total: 'tx.amount_minor' })

  return reduceSummary(rows)
}

/** Global per-currency totals across all of the user's active ledgers. */
export async function globalSummary(userId: number): Promise<CurrencySummary[]> {
  const rows = await db
    .from('transactions as tx')
    .join('ledgers as l', 'l.id', 'tx.ledger_id')
    .where('tx.user_id', userId)
    .where('l.status', 'active')
    .groupBy('tx.currency', 'tx.type')
    .select('tx.currency as currency', 'tx.type as type')
    .sum({ total: 'tx.amount_minor' })

  return reduceSummary(rows)
}

function reduceSummary(rows: any[]): CurrencySummary[] {
  const byCurrency = new Map<string, CurrencySummary>()
  for (const r of rows) {
    const currency = String(r.currency)
    const type = String(r.type) as TransactionType
    const total = Number(r.total ?? 0)
    if (!byCurrency.has(currency)) {
      byCurrency.set(currency, {
        currency,
        totals: { lend: 0, borrow: 0, receipt: 0, expense: 0 },
        netMinor: 0,
      })
    }
    const entry = byCurrency.get(currency)!
    entry.totals[type] = total
    entry.netMinor += total * signOf(type)
  }
  return [...byCurrency.values()]
}
