import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { createLedgerValidator, updateLedgerValidator } from '#validators/api/ledger'
import { ledgerBalanceByCurrency } from '#services/balance_service'

/**
 * Ledgers for a contact: the two tabs (current/archived), plus lifecycle
 * actions (create, archive, reopen). All scoped to the authenticated user.
 */
export default class LedgersController {
  /** Ledgers for a contact, optionally filtered by `?status=active|archived`. */
  async index({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const contact = await user
      .related('contacts')
      .query()
      .where('id', params.contactId)
      .firstOrFail()

    const status = request.input('status')
    const query = contact.related('ledgers').query().orderBy('opened_at', 'desc')
    if (status === 'active' || status === 'archived') query.where('status', status)

    const ledgers = await query
    const data = []
    for (const l of ledgers) {
      const json = l.serialize()
      json.balance = await ledgerBalanceByCurrency(user.id, l.id)
      data.push(json)
    }
    return response.ok({ success: true, data: { ledgers: data } })
  }

  /**
   * The active ("current") ledger for a contact; auto-created if none.
   * With `?currency=`, returns the active ledger FOR THAT currency (a contact
   * may hold one active ledger per currency). Without it, returns any active
   * ledger — preferring the user's default currency — for backward compat.
   */
  async current({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const contact = await user
      .related('contacts')
      .query()
      .where('id', params.contactId)
      .firstOrFail()

    const requestedCurrency = request.input('currency')
    let ledger
    if (requestedCurrency) {
      // Uppercase to match how storeGeneral stores currencies (`.toUpperCase()`).
      const currency = String(requestedCurrency).toUpperCase()
      ledger = await contact
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
    } else {
      // Backward compatible: prefer an active ledger in the default currency,
      // else any active ledger, else create one in the default currency.
      const defaultCurrency = (user.defaultCurrency || 'USD').toUpperCase()
      ledger =
        (await contact
          .related('ledgers')
          .query()
          .where('status', 'active')
          .where('currency', defaultCurrency)
          .first()) ??
        (await contact.related('ledgers').query().where('status', 'active').first())
      if (!ledger) {
        ledger = await contact.related('ledgers').create({
          userId: user.id,
          currency: user.defaultCurrency || 'USD',
          status: 'active',
          openedAt: DateTime.now(),
        })
      }
    }
    const json = ledger.serialize()
    json.balance = await ledgerBalanceByCurrency(user.id, ledger.id)
    return response.ok({ success: true, data: { ledger: json } })
  }

  /** Open a new ledger (409 if the contact already has an active one in the same currency). */
  async store({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const contact = await user
      .related('contacts')
      .query()
      .where('id', params.contactId)
      .firstOrFail()
    const payload = await request.validateUsing(createLedgerValidator)

    // A contact may hold one active ledger per currency, so the guard is
    // per-currency: an active ledger only blocks a new one of the SAME currency.
    const currency = (payload.currency || user.defaultCurrency || 'USD').toUpperCase()
    const activeExists = await contact
      .related('ledgers')
      .query()
      .where('status', 'active')
      .where('currency', currency)
      .first()
    if (activeExists) {
      return response.status(409).send({ success: false, message: 'active_ledger_exists' })
    }

    const ledger = await contact.related('ledgers').create({
      userId: user.id,
      title: payload.title ?? null,
      currency,
      status: 'active',
      openedAt: DateTime.now(),
    })
    return response.created({ success: true, data: { ledger: ledger.serialize() } })
  }

  /** A single ledger with its per-currency balance. */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const ledger = await user.related('ledgers').query().where('id', params.id).firstOrFail()
    const json = ledger.serialize()
    json.balance = await ledgerBalanceByCurrency(user.id, ledger.id)
    return response.ok({ success: true, data: { ledger: json } })
  }

  /** Edit a ledger's title/currency. */
  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const ledger = await user.related('ledgers').query().where('id', params.id).firstOrFail()
    const payload = await request.validateUsing(updateLedgerValidator)
    ledger.merge({
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
    })
    await ledger.save()
    return response.ok({ success: true, data: { ledger: ledger.serialize() } })
  }

  /** Close & archive the ledger. */
  async archive({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const ledger = await user.related('ledgers').query().where('id', params.id).firstOrFail()
    ledger.status = 'archived'
    ledger.closedAt = DateTime.now()
    await ledger.save()
    return response.ok({ success: true, data: { ledger: ledger.serialize() } })
  }

  /** Reactivate an archived ledger (409 if another active one of the same currency exists). */
  async reopen({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const ledger = await user.related('ledgers').query().where('id', params.id).firstOrFail()
    // Per-currency guard: only another ACTIVE ledger of the SAME currency blocks.
    const activeExists = await user
      .related('ledgers')
      .query()
      .where('contact_id', ledger.contactId)
      .where('status', 'active')
      .where('currency', ledger.currency)
      .whereNot('id', ledger.id)
      .first()
    if (activeExists) {
      return response.status(409).send({ success: false, message: 'active_ledger_exists' })
    }
    ledger.status = 'active'
    ledger.closedAt = null
    await ledger.save()
    return response.ok({ success: true, data: { ledger: ledger.serialize() } })
  }
}
