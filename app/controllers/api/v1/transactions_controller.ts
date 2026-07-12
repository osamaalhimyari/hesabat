import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import {
  createPersonalTransactionValidator,
  createTransactionValidator,
  updateTransactionValidator,
} from '#validators/api/transaction'
import { toMinor } from '#services/money'

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
      .orderBy('occurred_at', 'asc')
      .orderBy('id', 'asc')

    return response.ok({
      success: true,
      data: { transactions: txs.map((t) => t.serialize()) },
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

    const currency = payload.currency || ledger.currency
    const tx = await ledger.related('transactions').create({
      userId: user.id,
      type: payload.type,
      amountMinor: toMinor(payload.amount, currency),
      currency,
      occurredAt,
      note: payload.note ?? null,
      attachmentUrl: payload.attachmentUrl ?? null,
    })

    return response.created({ success: true, data: { transaction: tx.serialize() } })
  }

  /**
   * Create a PERSONAL cash entry (no ledger/contact). A receipt adds to the
   * user's cash wallet, an expense subtracts from it. See `balance_service`.
   */
  async storePersonal({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createPersonalTransactionValidator)

    const occurredAt = DateTime.fromISO(payload.occurredAt)
    if (!occurredAt.isValid) {
      return response.status(422).send({ success: false, message: 'invalid_date' })
    }

    const currency = (payload.currency || user.defaultCurrency || 'USD').toUpperCase()
    const tx = await user.related('transactions').create({
      ledgerId: null,
      type: payload.type,
      amountMinor: toMinor(payload.amount, currency),
      currency,
      occurredAt,
      note: payload.note ?? null,
      attachmentUrl: payload.attachmentUrl ?? null,
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
      .orderBy('occurred_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)

    const transactions = paginator.all().map((t) => {
      const json = t.serialize()
      json.contactId = t.ledger?.contactId ?? null
      json.contactName = t.ledger?.contact?.name ?? null
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
