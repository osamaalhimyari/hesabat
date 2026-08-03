import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Mobile access tokens no longer expire (see `User.accessTokens` — the
 * `expiresIn: '30 days'` option was dropped so one login lasts until the user
 * signs out). Tokens issued *before* that change still carry an `expires_at`
 * 30 days out, which would sign those clients out anyway; clear it so existing
 * sessions get the new behaviour too.
 *
 * `down()` restores a 30-day window measured from each token's creation, which
 * means already-old tokens come back expired — the same state they would have
 * reached on their own.
 */
export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        `UPDATE auth_access_tokens SET expires_at = NULL WHERE type = 'auth_token'`
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        `UPDATE auth_access_tokens SET expires_at = DATE_ADD(created_at, INTERVAL 30 DAY) ` +
          `WHERE type = 'auth_token' AND expires_at IS NULL`
      )
    })
  }
}
