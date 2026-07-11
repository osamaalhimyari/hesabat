import { LedgerSchema } from '#database/schema'
import { column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Contact from '#models/contact'
import Transaction from '#models/transaction'

/**
 * A "book" grouping transactions for one contact. A contact has at most one
 * `active` ledger (the current one, enforced by a unique index) plus any number
 * of `archived` ledgers.
 */
export default class Ledger extends LedgerSchema {
  /**
   * DB-only helper backing the "one active ledger per contact" unique index on
   * MySQL/MariaDB (a STORED generated column; absent on SQLite/Postgres, which
   * use a partial index instead). It is never written by the app and must not
   * be exposed to the API, so it is hidden from serialization.
   */
  @column({ serializeAs: null })
  declare activeContactId: number | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Contact)
  declare contact: BelongsTo<typeof Contact>

  @hasMany(() => Transaction)
  declare transactions: HasMany<typeof Transaction>

  /** Populated on demand by the balance service (not a stored column). */
  declare balance?: { currency: string; balanceMinor: number }[]
}
