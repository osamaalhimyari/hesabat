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
 * Personal (contact-less) cash entry. Only receipt/expense make sense without a
 * person — lend/borrow are debts and require a ledger.
 */
export const createPersonalTransactionValidator = vine.create({
  type: vine.enum(['receipt', 'expense']),
  amount: amountRule(),
  currency: vine.string().trim().fixedLength(3).optional(),
  occurredAt: occurredAtRule(),
  note: vine.string().trim().maxLength(1000).nullable().optional(),
  attachmentUrl: vine.string().trim().maxLength(1024).nullable().optional(),
})

export const updateTransactionValidator = vine.create({
  type: vine.enum(['lend', 'borrow', 'receipt', 'expense']).optional(),
  amount: amountRule().optional(),
  currency: vine.string().trim().fixedLength(3).optional(),
  occurredAt: occurredAtRule().optional(),
  note: vine.string().trim().maxLength(1000).nullable().optional(),
  attachmentUrl: vine.string().trim().maxLength(1024).nullable().optional(),
})
