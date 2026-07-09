import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Contact from '#models/contact'
import Transaction from '#models/transaction'

/**
 * A "book" grouping transactions for one contact. A contact has at most one
 * `active` ledger (the current one, enforced by a partial unique index) plus
 * any number of `archived` ledgers.
 */
export default class Ledger extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare contactId: number

  @column()
  declare title: string | null

  @column()
  declare currency: string

  @column()
  declare status: 'active' | 'archived'

  @column.dateTime()
  declare openedAt: DateTime

  @column.dateTime()
  declare closedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Contact)
  declare contact: BelongsTo<typeof Contact>

  @hasMany(() => Transaction)
  declare transactions: HasMany<typeof Transaction>

  /** Populated on demand by the balance service (not a stored column). */
  declare balance?: { currency: string; balanceMinor: number }[]
}
