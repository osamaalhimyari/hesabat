import db from '@adonisjs/lucid/services/db'

export type TransactionType =
  | 'lend'
  | 'borrow'
  | 'receipt'
  | 'expense'
  | 'repayment_received'
  | 'repayment_made'
  | 'hold_deposit'
  | 'hold_withdraw'
  | 'hold_spend'

/**
 * The one place the DEBT sign convention lives. Per person, +1 increases what
 * the CONTACT owes the user; -1 increases what the USER owes; 0 = no debt effect.
 *   lend               -> +  (I gave them money; they owe me)
 *   repayment_made     -> +  (I paid down what I owe; reduces my debt to them)
 *   borrow             -> -  (I took their money; I owe them)
 *   repayment_received -> -  (they paid me back; reduces what they owe me)
 *   receipt / expense  -> 0  (pure cash movement; no debt effect)
 */
export function signOf(type: TransactionType): number {
  if (type === 'lend' || type === 'repayment_made') return 1
  if (type === 'borrow' || type === 'repayment_received') return -1
  return 0
}

/**
 * The HELD sign convention: contribution to "my money kept with this contact"
 * (custody/أمانة — the user's own money physically held by the contact).
 *   hold_deposit  -> +  (I put money with him)
 *   hold_withdraw -> -  (I took it back)
 *   hold_spend    -> -  (he paid it out for me; consumed)
 * All other types never touch the held balance.
 */
export function holdSignOf(type: TransactionType): number {
  if (type === 'hold_deposit') return 1
  if (type === 'hold_withdraw' || type === 'hold_spend') return -1
  return 0
}

/** SQL expression for the signed DEBT minor amount of a `transactions` row aliased `tx`. */
const SIGNED_MINOR =
  `tx.amount_minor * (CASE ` +
  `WHEN tx.type IN ('lend','repayment_made') THEN 1 ` +
  `WHEN tx.type IN ('borrow','repayment_received') THEN -1 ` +
  `ELSE 0 END)`

/**
 * SQL expression for a cash-wallet row, from the wallet's point of view: money
 * IN is +, money OUT is −. NOTE this differs from `SIGNED_MINOR` (the debt sign)
 * — e.g. `lend` is +1 for debt (they owe you) but −1 for cash (money left you).
 *   receipt/borrow/repayment_received/hold_withdraw +  (money came in)
 *   expense/lend/repayment_made/hold_deposit        −  (money went out)
 *   hold_spend                                      0  (held money consumed;
 *                                                       the wallet never sees it)
 */
const CASH_SIGNED_MINOR =
  `tx.amount_minor * (CASE ` +
  `WHEN tx.type IN ('receipt','borrow','repayment_received','hold_withdraw') THEN 1 ` +
  `WHEN tx.type IN ('expense','lend','repayment_made','hold_deposit') THEN -1 ` +
  `ELSE 0 END)`

/**
 * SQL expression for the signed HELD minor amount of a `transactions` row
 * aliased `tx` — mirrors `holdSignOf`.
 */
const HOLD_SIGNED_MINOR =
  `tx.amount_minor * (CASE ` +
  `WHEN tx.type = 'hold_deposit' THEN 1 ` +
  `WHEN tx.type IN ('hold_withdraw','hold_spend') THEN -1 ` +
  `ELSE 0 END)`

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

/**
 * HELD balance ("my money with him") per contact, per currency, across each
 * contact's ACTIVE ledgers — the custody mirror of [outstandingByContact].
 * Only non-zero balances are returned.
 */
export async function heldByContact(userId: number): Promise<ContactOutstanding[]> {
  const rows = await db
    .from('transactions as tx')
    .join('ledgers as l', 'l.id', 'tx.ledger_id')
    .where('tx.user_id', userId)
    .where('l.status', 'active')
    .groupBy('l.contact_id', 'tx.currency')
    .select('l.contact_id as contactId', 'tx.currency as currency')
    .sum({ balanceMinor: db.raw(HOLD_SIGNED_MINOR) })

  return rows
    .map((r: any) => ({
      contactId: Number(r.contactId),
      currency: String(r.currency),
      balanceMinor: Number(r.balanceMinor ?? 0),
    }))
    .filter((r) => r.balanceMinor !== 0)
}

/** Signed DEBT balance per currency for a single ledger (all of its transactions). */
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

/**
 * Signed HELD balance per currency for a single ledger — backs the
 * `insufficient_held` guard (a withdraw/spend can't exceed what he holds).
 */
export async function ledgerHeldByCurrency(
  userId: number,
  ledgerId: number
): Promise<CurrencyBalance[]> {
  const rows = await db
    .from('transactions as tx')
    .where('tx.user_id', userId)
    .where('tx.ledger_id', ledgerId)
    .groupBy('tx.currency')
    .select('tx.currency as currency')
    .sum({ balanceMinor: db.raw(HOLD_SIGNED_MINOR) })

  return rows.map((r: any) => ({
    currency: String(r.currency),
    balanceMinor: Number(r.balanceMinor ?? 0),
  }))
}

export interface CurrencySummary {
  currency: string
  totals: {
    lend: number
    borrow: number
    receipt: number
    expense: number
    repaymentReceived: number
    repaymentMade: number
    holdDeposit: number
    holdWithdraw: number
    holdSpend: number
  }
  netMinor: number
  /** "My money with him" for this currency (Σ amount × hold sign). */
  heldMinor: number
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

/**
 * The user's personal cash wallet per currency. Every row contributes according
 * to its cash sign (money in − money out); the wallet is derived purely from
 * `type`, so there is no `affects_cash` filter.
 */
export async function cashBalance(userId: number): Promise<CurrencyBalance[]> {
  const rows = await db
    .from('transactions as tx')
    .where('tx.user_id', userId)
    .groupBy('tx.currency')
    .select('tx.currency as currency')
    .sum({ balanceMinor: db.raw(CASH_SIGNED_MINOR) })

  return rows.map((r: any) => ({
    currency: String(r.currency),
    balanceMinor: Number(r.balanceMinor ?? 0),
  }))
}

export interface DashboardOverview {
  /** Personal cash wallet per currency. */
  cash: CurrencyBalance[]
  /** Debts owed TO the user (sum of positive contact balances) per currency. */
  toReceive: CurrencyBalance[]
  /** Debts the user OWES (sum of |negative contact balances|) per currency. */
  toPay: CurrencyBalance[]
  /** The user's own money kept with contacts (custody/أمانة) per currency. */
  held: CurrencyBalance[]
  /** Net worth per currency = cash + toReceive − toPay + held. */
  netWorth: CurrencyBalance[]
}

/**
 * The figures behind the Home dashboard circles: cash wallet, total to receive
 * (debts owed to the user), total to pay (debts the user owes), money held with
 * contacts, and net worth (cash + toReceive − toPay + held) — all per currency.
 */
export async function dashboardOverview(userId: number): Promise<DashboardOverview> {
  const [cash, outstanding, heldOut] = await Promise.all([
    cashBalance(userId),
    outstandingByContact(userId),
    heldByContact(userId),
  ])

  const receiveByCurrency = new Map<string, number>()
  const payByCurrency = new Map<string, number>()
  for (const o of outstanding) {
    if (o.balanceMinor > 0) {
      receiveByCurrency.set(o.currency, (receiveByCurrency.get(o.currency) ?? 0) + o.balanceMinor)
    } else if (o.balanceMinor < 0) {
      payByCurrency.set(o.currency, (payByCurrency.get(o.currency) ?? 0) + Math.abs(o.balanceMinor))
    }
  }

  const heldByCurrency = new Map<string, number>()
  for (const h of heldOut) {
    heldByCurrency.set(h.currency, (heldByCurrency.get(h.currency) ?? 0) + h.balanceMinor)
  }

  const cashByCurrency = new Map<string, number>()
  for (const c of cash) cashByCurrency.set(c.currency, c.balanceMinor)

  const toList = (m: Map<string, number>): CurrencyBalance[] =>
    [...m.entries()].map(([currency, balanceMinor]) => ({ currency, balanceMinor }))

  // Net worth spans every currency present in any of the four maps.
  const currencies = new Set<string>([
    ...cashByCurrency.keys(),
    ...receiveByCurrency.keys(),
    ...payByCurrency.keys(),
    ...heldByCurrency.keys(),
  ])
  const netWorth: CurrencyBalance[] = [...currencies].map((currency) => ({
    currency,
    balanceMinor:
      (cashByCurrency.get(currency) ?? 0) +
      (receiveByCurrency.get(currency) ?? 0) -
      (payByCurrency.get(currency) ?? 0) +
      (heldByCurrency.get(currency) ?? 0),
  }))

  return {
    cash,
    toReceive: toList(receiveByCurrency),
    toPay: toList(payByCurrency),
    held: toList(heldByCurrency),
    netWorth,
  }
}

function reduceSummary(rows: any[]): CurrencySummary[] {
  const byCurrency = new Map<string, CurrencySummary>()
  const totalKey: Record<TransactionType, keyof CurrencySummary['totals']> = {
    lend: 'lend',
    borrow: 'borrow',
    receipt: 'receipt',
    expense: 'expense',
    repayment_received: 'repaymentReceived',
    repayment_made: 'repaymentMade',
    hold_deposit: 'holdDeposit',
    hold_withdraw: 'holdWithdraw',
    hold_spend: 'holdSpend',
  }
  for (const r of rows) {
    const currency = String(r.currency)
    const type = String(r.type) as TransactionType
    const total = Number(r.total ?? 0)
    if (!byCurrency.has(currency)) {
      byCurrency.set(currency, {
        currency,
        totals: {
          lend: 0,
          borrow: 0,
          receipt: 0,
          expense: 0,
          repaymentReceived: 0,
          repaymentMade: 0,
          holdDeposit: 0,
          holdWithdraw: 0,
          holdSpend: 0,
        },
        netMinor: 0,
        heldMinor: 0,
      })
    }
    const entry = byCurrency.get(currency)!
    const key = totalKey[type]
    if (key) entry.totals[key] = total
    entry.netMinor += total * signOf(type)
    entry.heldMinor += total * holdSignOf(type)
  }
  return [...byCurrency.values()]
}
