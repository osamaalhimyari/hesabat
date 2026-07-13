import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import {
  createGeneralTransactionValidator,
  createTransactionValidator,
  updateTransactionValidator,
} from '#validators/api/transaction'
import { toMinor } from '#services/money'
import {
  holdSignOf,
  ledgerBalanceByCurrency,
  ledgerHeldByCurrency,
  signOf,
  type TransactionType,
} from '#services/balance_service'

/** The 4 types that necessarily involve another person (a debt ledger). */
const DEBT_TYPES = new Set<TransactionType>([
  'lend',
  'borrow',
  'repayment_received',
  'repayment_made',
])

/** The 3 custody types (money the user keeps with a contact). */
const HOLD_TYPES = new Set<TransactionType>(['hold_deposit', 'hold_withdraw', 'hold_spend'])

/** Every type that must be linked to a contact (debt + custody). */
const CONTACT_REQUIRED_TYPES = new Set<TransactionType>([...DEBT_TYPES, ...HOLD_TYPES])

/**
 * True when a repayment would exceed the open debt it settles. `net` is the
 * ledger's debt-signed balance for the currency (positive ⇒ they owe the user).
 *   repayment_received settles a receivable → capped at max(net, 0)
 *   repayment_made     settles a payable    → capped at max(-net, 0)
 */
function repaymentExceedsDebt(type: TransactionType, amountMinor: number, net: number): boolean {
  if (type === 'repayment_received') return amountMinor > Math.max(net, 0)
  if (type === 'repayment_made') return amountMinor > Math.max(-net, 0)
  return false
}

/**
 * True when a withdraw/spend would exceed the money the contact currently
 * holds for the user (`held` = the ledger's hold-signed balance).
 */
function holdExceedsHeld(type: TransactionType, amountMinor: number, held: number): boolean {
  if (type === 'hold_withdraw' || type === 'hold_spend') return amountMinor > Math.max(held, 0)
  return false
}

/**
 * Transactions (ledger entries). Nested under a ledger for listing/creating;
 * addressed by id for read/update/delete. All scoped to the authenticated user.
 */
export default class TransactionsController {
  /** Ledger rows in chronological order (for the running-balance table). */
  async index({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const ledger = await user
      .related('ledgers')
      .query()
      .where('id', params.ledgerId)
      .firstOrFail()

    const txs = await ledger
      .related('transactions')
      .query()
      .preload('category')
      .orderBy('occurred_at', 'asc')
      .orderBy('id', 'asc')

    return response.ok({
      success: true,
      data: {
        transactions: txs.map((t) => {
          const json = t.serialize()
          json.categoryName = t.category?.name ?? null
          return json
        }),
      },
    })
  }

  /** Add an entry to a ledger. */
  async store({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    let ledger = await user
      .related('ledgers')
      .query()
      .where('id', params.ledgerId)
      .preload('contact')
      .firstOrFail()
    const payload = await request.validateUsing(createTransactionValidator)

    const occurredAt = DateTime.fromISO(payload.occurredAt)
    if (!occurredAt.isValid) {
      return response.status(422).send({ success: false, message: 'invalid_date' })
    }

    // If a different currency is supplied, find or create the ledger for that currency
    let currency = (payload.currency || ledger.currency).toUpperCase()
    if (currency !== ledger.currency) {
      // Switch to the appropriate ledger for this currency
      const alt = await ledger.contact
        .related('ledgers')
        .query()
        .where('status', 'active')
        .where('currency', currency)
        .first()
      if (alt) {
        ledger = alt
      } else {
        // Auto-create a new ledger for this contact in the new currency
        ledger = await ledger.contact.related('ledgers').create({
          userId: user.id,
          currency,
          status: 'active',
          openedAt: DateTime.now(),
        })
      }
    } else {
      currency = ledger.currency
    }

    const amountMinor = toMinor(payload.amount, currency)

    // A repayment can't exceed the open debt it settles.
    if (payload.type === 'repayment_received' || payload.type === 'repayment_made') {
      const balances = await ledgerBalanceByCurrency(user.id, ledger.id)
      const net = balances.find((b) => b.currency === currency)?.balanceMinor ?? 0
      if (repaymentExceedsDebt(payload.type, amountMinor, net)) {
        return response.status(422).send({ success: false, error: 'repayment_exceeds_debt' })
      }
    }

    // A withdraw/spend can't exceed what the contact currently holds.
    if (payload.type === 'hold_withdraw' || payload.type === 'hold_spend') {
      const heldBalances = await ledgerHeldByCurrency(user.id, ledger.id)
      const held = heldBalances.find((b) => b.currency === currency)?.balanceMinor ?? 0
      if (holdExceedsHeld(payload.type, amountMinor, held)) {
        return response.status(422).send({ success: false, error: 'insufficient_held' })
      }
    }

    // A supplied category must belong to the user.
    const categoryId = payload.categoryId ?? null
    if (categoryId !== null) {
      const category = await user
        .related('categories')
        .query()
        .where('id', categoryId)
        .first()
      if (!category) {
        return response.status(404).send({ success: false, error: 'category_not_found' })
      }
    }

    const tx = await ledger.related('transactions').create({
      userId: user.id,
      type: payload.type,
      amountMinor,
      currency,
      occurredAt,
      note: payload.note ?? null,
      attachmentUrl: payload.attachmentUrl ?? null,
      categoryId,
    })

    return response.created({ success: true, data: { transaction: tx.serialize() } })
  }

  /**
   * Create a general entry from the app-wide "Add entry" form. Optionally links
   * a contact (→ that contact's active ledger, auto-created). The 4 debt types
   * (lend/borrow/repayment_received/repayment_made) require a contact;
   * receipt/expense may link one informationally. The cash sign is derived from
   * the type, so there is no `affectsCash` flag.
   */
  async storeGeneral({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createGeneralTransactionValidator)

    const occurredAt = DateTime.fromISO(payload.occurredAt)
    if (!occurredAt.isValid) {
      return response.status(422).send({ success: false, message: 'invalid_date' })
    }

    let ledgerId: number | null = null
    let currency = (payload.currency || user.defaultCurrency || 'USD').toUpperCase()

    if (payload.contactId) {
      const contact = await user
        .related('contacts')
        .query()
        .where('id', payload.contactId)
        .firstOrFail()
      // The contact's active ledger FOR THIS CURRENCY, auto-created if none
      // (mirrors LedgersController.current). A contact may hold one active
      // ledger per currency, so we look up / create by (contact, currency).
      let ledger = await contact
        .related('ledgers')
        .query()
        .where('status', 'active')
        .where('currency', currency)
        .first()
      if (!ledger) {
        ledger = await contact.related('ledgers').create({
          userId: user.id,
          currency,
          status: 'active',
          openedAt: DateTime.now(),
        })
      }
      ledgerId = ledger.id
      // Do NOT reassign currency — the ledger already matches it.
    } else if (CONTACT_REQUIRED_TYPES.has(payload.type)) {
      return response.status(422).send({ success: false, error: 'contact_required' })
    }

    const amountMinor = toMinor(payload.amount, currency)

    // A repayment can't exceed the open debt it settles (only reachable with a ledger).
    if (
      ledgerId !== null &&
      (payload.type === 'repayment_received' || payload.type === 'repayment_made')
    ) {
      const balances = await ledgerBalanceByCurrency(user.id, ledgerId)
      const net = balances.find((b) => b.currency === currency)?.balanceMinor ?? 0
      if (repaymentExceedsDebt(payload.type, amountMinor, net)) {
        return response.status(422).send({ success: false, error: 'repayment_exceeds_debt' })
      }
    }

    // A withdraw/spend can't exceed what the contact currently holds.
    if (ledgerId !== null && (payload.type === 'hold_withdraw' || payload.type === 'hold_spend')) {
      const heldBalances = await ledgerHeldByCurrency(user.id, ledgerId)
      const held = heldBalances.find((b) => b.currency === currency)?.balanceMinor ?? 0
      if (holdExceedsHeld(payload.type, amountMinor, held)) {
        return response.status(422).send({ success: false, error: 'insufficient_held' })
      }
    }

    // A supplied category must belong to the user.
    const categoryId = payload.categoryId ?? null
    if (categoryId !== null) {
      const category = await user
        .related('categories')
        .query()
        .where('id', categoryId)
        .first()
      if (!category) {
        return response.status(404).send({ success: false, error: 'category_not_found' })
      }
    }

    const tx = await user.related('transactions').create({
      ledgerId,
      type: payload.type,
      amountMinor,
      currency,
      occurredAt,
      note: payload.note ?? null,
      attachmentUrl: payload.attachmentUrl ?? null,
      categoryId,
    })

    return response.created({ success: true, data: { transaction: tx.serialize() } })
  }

  /**
   * Global feed of every transaction (personal + debt), newest first. Personal
   * rows carry a null ledger/contact; debt rows are annotated with the contact.
   */
  async feed({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const page = Number(request.input('page', 1)) || 1
    const perPage = Math.min(Number(request.input('perPage', 50)) || 50, 100)

    const paginator = await user
      .related('transactions')
      .query()
      .preload('ledger', (lq) => lq.preload('contact'))
      .preload('category')
      .orderBy('occurred_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)

    const transactions = paginator.all().map((t) => {
      const json = t.serialize()
      json.contactId = t.ledger?.contactId ?? null
      json.contactName = t.ledger?.contact?.name ?? null
      json.categoryName = t.category?.name ?? null
      json.isPersonal = t.ledgerId == null
      return json
    })

    return response.ok({
      success: true,
      data: { transactions, meta: paginator.getMeta() },
    })
  }

  /** A single entry. */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const tx = await user.related('transactions').query().where('id', params.id).firstOrFail()
    return response.ok({ success: true, data: { transaction: tx.serialize() } })
  }

  /** Edit an entry (recomputes balances client-side on refetch). */
  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const tx = await user.related('transactions').query().where('id', params.id).firstOrFail()
    const payload = await request.validateUsing(updateTransactionValidator)

    // Capture the pre-edit state so the repayment guard can exclude this row.
    const origType = tx.type as TransactionType
    const origAmount = Number(tx.amountMinor)
    const origCurrency = tx.currency

    if (payload.type !== undefined) tx.type = payload.type
    if (payload.currency !== undefined) tx.currency = payload.currency
    if (payload.amount !== undefined) tx.amountMinor = toMinor(payload.amount, tx.currency)
    if (payload.occurredAt !== undefined) {
      const dt = DateTime.fromISO(payload.occurredAt)
      if (!dt.isValid) {
        return response.status(422).send({ success: false, message: 'invalid_date' })
      }
      tx.occurredAt = dt
    }
    if (payload.note !== undefined) tx.note = payload.note
    if (payload.attachmentUrl !== undefined) tx.attachmentUrl = payload.attachmentUrl

    // categoryId: a positive id links (must belong to the user), null clears.
    if (payload.categoryId !== undefined) {
      if (payload.categoryId === null) {
        tx.categoryId = null
      } else {
        const category = await user
          .related('categories')
          .query()
          .where('id', payload.categoryId)
          .first()
        if (!category) {
          return response.status(404).send({ success: false, error: 'category_not_found' })
        }
        tx.categoryId = payload.categoryId
      }
    }

    // A personal (ledgerless) row can never become a contact-required type —
    // e.g. a ledgerless hold_deposit would subtract cash yet be invisible to
    // heldByContact (which joins ledgers), silently vanishing from net worth.
    if (
      tx.ledgerId === null &&
      payload.type !== undefined &&
      CONTACT_REQUIRED_TYPES.has(payload.type)
    ) {
      return response.status(422).send({ success: false, error: 'contact_required' })
    }

    // Re-run the repayment guard when type or amount changed, recomputing the
    // ledger net EXCLUDING this row (its old value is still persisted).
    const typeChanged = payload.type !== undefined && payload.type !== origType
    const amountChanged = payload.amount !== undefined && Number(tx.amountMinor) !== origAmount
    if (
      tx.ledgerId !== null &&
      (typeChanged || amountChanged) &&
      (tx.type === 'repayment_received' || tx.type === 'repayment_made')
    ) {
      const balances = await ledgerBalanceByCurrency(user.id, tx.ledgerId)
      let net = balances.find((b) => b.currency === tx.currency)?.balanceMinor ?? 0
      // Remove this row's current (pre-save) contribution from the net.
      if (origCurrency === tx.currency) net -= signOf(origType) * origAmount
      if (repaymentExceedsDebt(tx.type, Number(tx.amountMinor), net)) {
        return response.status(422).send({ success: false, error: 'repayment_exceeds_debt' })
      }
    }

    // Same re-check for the held guard: a withdraw/spend edit can't exceed the
    // held balance computed WITHOUT this row's old contribution.
    if (
      tx.ledgerId !== null &&
      (typeChanged || amountChanged) &&
      (tx.type === 'hold_withdraw' || tx.type === 'hold_spend')
    ) {
      const heldBalances = await ledgerHeldByCurrency(user.id, tx.ledgerId)
      let held = heldBalances.find((b) => b.currency === tx.currency)?.balanceMinor ?? 0
      if (origCurrency === tx.currency) held -= holdSignOf(origType) * origAmount
      if (holdExceedsHeld(tx.type, Number(tx.amountMinor), held)) {
        return response.status(422).send({ success: false, error: 'insufficient_held' })
      }
    }

    await tx.save()
    return response.ok({ success: true, data: { transaction: tx.serialize() } })
  }

  /** Remove an entry. */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const tx = await user.related('transactions').query().where('id', params.id).firstOrFail()
    await tx.delete()
    return response.ok({ success: true, data: {} })
  }
}
