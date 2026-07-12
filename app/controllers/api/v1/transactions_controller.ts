import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import {
  createGeneralTransactionValidator,
  createTransactionValidator,
  updateTransactionValidator,
} from '#validators/api/transaction'
import { toMinor } from '#services/money'
import { ledgerBalanceByCurrency, signOf, type TransactionType } from '#services/balance_service'

/** The 4 types that necessarily involve another person (a debt ledger). */
const DEBT_TYPES = new Set<TransactionType>([
  'lend',
  'borrow',
  'repayment_received',
  'repayment_made',
])

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
    const ledger = await user
      .related('ledgers')
      .query()
      .where('id', params.ledgerId)
      .firstOrFail()
    const payload = await request.validateUsing(createTransactionValidator)

    const occurredAt = DateTime.fromISO(payload.occurredAt)
    if (!occurredAt.isValid) {
      return response.status(422).send({ success: false, message: 'invalid_date' })
    }

    // A ledger is single-currency: entries always use the ledger's currency
    // (ignore any client-supplied currency to prevent mixed-currency ledgers).
    const currency = ledger.currency
    const amountMinor = toMinor(payload.amount, currency)

    // A repayment can't exceed the open debt it settles.
    if (payload.type === 'repayment_received' || payload.type === 'repayment_made') {
      const balances = await ledgerBalanceByCurrency(user.id, ledger.id)
      const net = balances.find((b) => b.currency === currency)?.balanceMinor ?? 0
      if (repaymentExceedsDebt(payload.type, amountMinor, net)) {
        return response.status(422).send({ success: false, error: 'repayment_exceeds_debt' })
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
      // The contact's active ledger, auto-created if none (mirrors LedgersController.current).
      let ledger = await contact.related('ledgers').query().where('status', 'active').first()
      if (!ledger) {
        // A brand-new ledger adopts the chosen currency; an existing one keeps
        // its own — a ledger is single-currency (see `store`).
        ledger = await contact.related('ledgers').create({
          userId: user.id,
          currency,
          status: 'active',
          openedAt: DateTime.now(),
        })
      }
      ledgerId = ledger.id
      currency = ledger.currency
    } else if (DEBT_TYPES.has(payload.type)) {
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
