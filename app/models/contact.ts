import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Ledger from '#models/ledger'

/**
 * A person the user exchanges money with. Belongs to a single user; all money
 * data hangs off contacts and is scoped to the owning user.
 */
export default class Contact extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare name: string

  @column()
  declare phone: string | null

  @column()
  declare photoUrl: string | null

  @column()
  declare source: 'manual' | 'imported'

  @column()
  declare deviceContactId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => Ledger)
  declare ledgers: HasMany<typeof Ledger>

  /**
   * Populated on demand by the balance service (not a stored column). Shape:
   * `[{ currency, balanceMinor }]` for the contact's active ledger.
   */
  declare outstanding?: { currency: string; balanceMinor: number }[]
}
