import type { HttpContext } from '@adonisjs/core/http'
import {
  createContactValidator,
  updateContactValidator,
  importContactsValidator,
} from '#validators/api/contact'
import { heldByContact, outstandingByContact } from '#services/balance_service'

/**
 * Contacts CRUD + device-contact import. Every query is scoped to the
 * authenticated user (multi-tenant isolation — a foreign id yields 404).
 */
export default class ContactsController {
  /** List contacts, each annotated with its active-ledger outstanding balance. */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const page = Number(request.input('page', 1)) || 1
    const perPage = Math.min(Number(request.input('perPage', 25)) || 25, 100)
    const search = String(request.input('search', '')).trim()
    const onlyOutstanding =
      request.input('onlyOutstanding') === 'true' || request.input('onlyOutstanding') === true

    // Outstanding (debt) and held (custody) per contact, active ledgers only.
    const [outstanding, held] = await Promise.all([
      outstandingByContact(user.id),
      heldByContact(user.id),
    ])
    const byContact = new Map<number, { currency: string; balanceMinor: number }[]>()
    for (const o of outstanding) {
      const arr = byContact.get(o.contactId) ?? []
      arr.push({ currency: o.currency, balanceMinor: o.balanceMinor })
      byContact.set(o.contactId, arr)
    }
    const heldMap = new Map<number, { currency: string; balanceMinor: number }[]>()
    for (const h of held) {
      const arr = heldMap.get(h.contactId) ?? []
      arr.push({ currency: h.currency, balanceMinor: h.balanceMinor })
      heldMap.set(h.contactId, arr)
    }

    const query = user.related('contacts').query()
    if (search) query.where('name', 'like', `%${search}%`)
    if (onlyOutstanding) {
      // "Outstanding" = any open balance with the contact: debt OR held money.
      const ids = [...new Set([...byContact.keys(), ...heldMap.keys()])]
      query.whereIn('id', ids.length ? ids : [-1])
    }
    query.orderBy('name', 'asc')

    const paginator = await query.paginate(page, perPage)
    const contacts = paginator.all().map((c) => {
      const json = c.serialize()
      json.outstanding = byContact.get(c.id) ?? []
      json.held = heldMap.get(c.id) ?? []
      return json
    })

    return response.ok({
      success: true,
      data: { contacts, meta: paginator.getMeta() },
    })
  }

  /** Create a manual contact. */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createContactValidator)
    const contact = await user.related('contacts').create({
      name: payload.name,
      phone: payload.phone ?? null,
      photoUrl: payload.photoUrl ?? null,
      source: 'manual',
    })
    return response.created({ success: true, data: { contact: contact.serialize() } })
  }

  /** Bulk import device contacts (deduped by deviceContactId). */
  async bulkImport({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { contacts } = await request.validateUsing(importContactsValidator)

    let imported = 0
    let skipped = 0
    for (const c of contacts) {
      const existing = await user
        .related('contacts')
        .query()
        .where('device_contact_id', c.deviceContactId)
        .first()
      if (existing) {
        skipped++
        continue
      }
      await user.related('contacts').create({
        name: c.name,
        phone: c.phone ?? null,
        source: 'imported',
        deviceContactId: c.deviceContactId,
      })
      imported++
    }

    return response.ok({ success: true, data: { imported, skipped } })
  }

  /** A single contact with its outstanding (debt) and held (custody) balances. */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const contact = await user.related('contacts').query().where('id', params.id).firstOrFail()
    const [outstandingAll, heldAll] = await Promise.all([
      outstandingByContact(user.id),
      heldByContact(user.id),
    ])
    const json = contact.serialize()
    json.outstanding = outstandingAll
      .filter((o) => o.contactId === contact.id)
      .map((o) => ({ currency: o.currency, balanceMinor: o.balanceMinor }))
    json.held = heldAll
      .filter((h) => h.contactId === contact.id)
      .map((h) => ({ currency: h.currency, balanceMinor: h.balanceMinor }))
    return response.ok({ success: true, data: { contact: json } })
  }

  /** Update a contact. */
  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const contact = await user.related('contacts').query().where('id', params.id).firstOrFail()
    const payload = await request.validateUsing(updateContactValidator)
    contact.merge({
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
      ...(payload.photoUrl !== undefined ? { photoUrl: payload.photoUrl } : {}),
    })
    await contact.save()
    return response.ok({ success: true, data: { contact: contact.serialize() } })
  }

  /** Delete a contact (cascades to its ledgers and transactions). */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const contact = await user.related('contacts').query().where('id', params.id).firstOrFail()
    await contact.delete()
    return response.ok({ success: true, data: {} })
  }
}
