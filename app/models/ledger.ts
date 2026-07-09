import { LedgerSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Contact from '#models/contact'
import Transaction from '#models/transaction'

/**
 * A "book" grouping transactions for one contact. A contact has at most one
 * `active` ledger (the current one, enforced by a partial unique index) plus
 * any number of `archived` ledgers.
 */
export default class Ledger extends LedgerSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Contact)
  declare contact: BelongsTo<typeof Contact>

  @hasMany(() => Transaction)
  declare transactions: HasMany<typeof Transaction>

  /** Populated on demand by the balance service (not a stored column). */
  declare balance?: { currency: string; balanceMinor: number }[]
}
