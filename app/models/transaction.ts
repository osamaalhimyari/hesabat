import { TransactionSchema } from '#database/schema'
import { column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Ledger from '#models/ledger'
import { formatMinor } from '#services/money'

/**
 * A single money row inside a ledger. `amountMinor` is a positive integer in
 * the currency's smallest unit; the balance sign is derived from `type`.
 */
export default class Transaction extends TransactionSchema {
  /**
   * Override the generated column so money serializes to the client as a
   * `{ minor, currency, display }` object under the `amount` key.
   */
  @column({
    serializeAs: 'amount',
    consume: (value: unknown) => (value === null || value === undefined ? 0 : Number(value)),
    serialize: (value: number, _attribute: string, model: any) => ({
      minor: Number(value),
      currency: model.currency,
      display: formatMinor(Number(value), model.currency),
    }),
  })
  declare amountMinor: number

  @belongsTo(() => Ledger)
  declare ledger: BelongsTo<typeof Ledger>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
