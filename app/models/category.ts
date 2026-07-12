import { CategorySchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

/**
 * A user-defined label for tagging transactions. Belongs to a single user and
 * is unique by name within that user (enforced by a DB unique index).
 */
export default class Category extends CategorySchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
