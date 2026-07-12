import vine from '@vinejs/vine'

/** Positive decimal string, e.g. "12", "12.50", "0.005". */
const amountRule = () => vine.string().trim().regex(/^\d{1,12}(\.\d{1,4})?$/)

/** ISO-8601 date (YYYY-MM-DD or full timestamp), parsed with Luxon in the controller. */
const occurredAtRule = () => vine.string().trim().maxLength(40)

/** The 6 authoritative transaction types. */
const typeValues = [
  'lend',
  'borrow',
  'receipt',
  'expense',
  'repayment_received',
  'repayment_made',
] as const

export const createTransactionValidator = vine.create({
  type: vine.enum(typeValues),
  amount: amountRule(),
  currency: vine.string().trim().fixedLength(3).optional(),
  occurredAt: occurredAtRule(),
  note: vine.string().trim().maxLength(1000).nullable().optional(),
  attachmentUrl: vine.string().trim().maxLength(1024).nullable().optional(),
  categoryId: vine.number().positive().nullable().optional(),
})

/**
 * A general entry (the app-wide "Add entry" form). Any type is allowed; a
 * `contactId` links it to a person's debt ledger. The 4 debt types
 * (lend/borrow/repayment_received/repayment_made) require a contact (enforced in
 * the controller). Currency defaults to the user's default currency.
 */
export const createGeneralTransactionValidator = vine.create({
  type: vine.enum(typeValues),
  amount: amountRule(),
  currency: vine.string().trim().fixedLength(3).optional(),
  occurredAt: occurredAtRule(),
  note: vine.string().trim().maxLength(1000).nullable().optional(),
  attachmentUrl: vine.string().trim().maxLength(1024).nullable().optional(),
  contactId: vine.number().positive().optional(),
  categoryId: vine.number().positive().nullable().optional(),
})

export const updateTransactionValidator = vine.create({
  type: vine.enum(typeValues).optional(),
  amount: amountRule().optional(),
  currency: vine.string().trim().fixedLength(3).optional(),
  occurredAt: occurredAtRule().optional(),
  note: vine.string().trim().maxLength(1000).nullable().optional(),
  attachmentUrl: vine.string().trim().maxLength(1024).nullable().optional(),
  categoryId: vine.number().positive().nullable().optional(),
})
