import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import {
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
