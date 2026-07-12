import vine from '@vinejs/vine'

/** Positive decimal string, e.g. "12", "12.50", "0.005". */
const amountRule = () => vine.string().trim().regex(/^\d{1,12}(\.\d{1,4})?$/)

/** ISO-8601 date (YYYY-MM-DD or full timestamp), parsed with Luxon in the controller. */
const occurredAtRule = () => vine.string().trim().maxLength(40)

export const createTransactionValidator = vine.create({
  type: vine.enum(['lend', 'borrow', 'receipt', 'expense']),
  amount: amountRule(),
  currency: vine.string().trim().fixedLength(3).optional(),
  occurredAt: occurredAtRule(),
  note: vine.string().trim().maxLength(1000).nullable().optional(),
  attachmentUrl: vine.string().trim().maxLength(1024).nullable().optional(),
})

/**
 * A general entry (the app-wide "Add entry" form). Any type is allowed; a
 * `contactId` links it to a person's debt ledger; `affectsCash` decides whether
 * it also moves the cash wallet. lend/borrow require a contact (enforced in the
 * controller). Currency defaults to the user's default currency.
 */
export const createGeneralTransactionValidator = vine.create({
  type: vine.enum(['lend', 'borrow', 'receipt', 'expense']),
  amount: amountRule(),
  currency: vine.string().trim().fixedLength(3).optional(),
  occurredAt: occurredAtRule(),
  note: vine.string().trim().maxLength(1000).nullable().optional(),
  attachmentUrl: vine.string().trim().maxLength(1024).nullable().optional(),
  contactId: vine.number().positive().optional(),
  affectsCash: vine.boolean().optional(),
})

export const updateTransactionValidator = vine.create({
  type: vine.enum(['lend', 'borrow', 'receipt', 'expense']).optional(),
  amount: amountRule().optional(),
  currency: vine.string().trim().fixedLength(3).optional(),
  occurredAt: occurredAtRule().optional(),
  note: vine.string().trim().maxLength(1000).nullable().optional(),
  attachmentUrl: vine.string().trim().maxLength(1024).nullable().optional(),
})
