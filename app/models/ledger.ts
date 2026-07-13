import { LedgerSchema } from '#database/schema'
import { column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Contact from '#models/contact'
import Transaction from '#models/transaction'

/**
 * A "book" grouping transactions for one contact. A contact has at most one
 * `active` ledger PER CURRENCY (enforced by a unique index) plus any number of
 * `archived` ledgers — so a contact can owe/be owed in several currencies at once.
 */
export default class Ledger extends LedgerSchema {
  /**
   * DB-only helper backing the "one active ledger per (contact, currency)"
   * unique index on MySQL/MariaDB (a STORED generated column, `contactId-currency`
   * while active else NULL; absent on SQLite/Postgres, which use a partial index).
   * Never written by the app and hidden from the API.
   */
  @column({ serializeAs: null })
  declare activeContactCurrency: string | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Contact)
  declare contact: BelongsTo<typeof Contact>

  @hasMany(() => Transaction)
  declare transactions: HasMany<typeof Transaction>

  /** Populated on demand by the balance service (not a stored column). */
  declare balance?: { currency: string; balanceMinor: number }[]
}
