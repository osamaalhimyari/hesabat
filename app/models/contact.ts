import { ContactSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Ledger from '#models/ledger'

/**
 * A person the user exchanges money with. Belongs to a single user; all money
 * data hangs off contacts and is scoped to the owning user.
 */
export default class Contact extends ContactSchema {
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
