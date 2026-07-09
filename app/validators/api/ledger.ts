import vine from '@vinejs/vine'

export const createLedgerValidator = vine.create({
  title: vine.string().trim().maxLength(255).nullable().optional(),
  currency: vine.string().trim().fixedLength(3).optional(),
})

export const updateLedgerValidator = vine.create({
  title: vine.string().trim().maxLength(255).nullable().optional(),
  currency: vine.string().trim().fixedLength(3).optional(),
})
