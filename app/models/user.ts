import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Contact from '#models/contact'
import Ledger from '#models/ledger'
import Transaction from '#models/transaction'
import Category from '#models/category'

/**
 * User model represents a user in the application.
 * It extends UserSchema and includes authentication capabilities
 * through the withAuthFinder mixin. `defaultCurrency` lives on UserSchema.
 */
export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  /**
   * A user owns many contacts, ledgers and transactions. All money data is
   * scoped to the owning user (multi-tenant isolation).
   */
  @hasMany(() => Contact)
  declare contacts: HasMany<typeof Contact>

  @hasMany(() => Ledger)
  declare ledgers: HasMany<typeof Ledger>

  @hasMany(() => Transaction)
  declare transactions: HasMany<typeof Transaction>

  @hasMany(() => Category)
  declare categories: HasMany<typeof Category>

  /**
   * Access tokens provider for the mobile `api` guard. Only a hash of each
   * token is persisted; the plaintext is returned once at issue time.
   *
   * No `expiresIn` — mobile tokens never expire, so a single login lasts until
   * the user signs out (logout revokes the token server-side). With an expiry
   * the client would be bounced back to the login screen every 30 days.
   */
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    prefix: 'hst_',
    table: 'auth_access_tokens',
    type: 'auth_token',
  })

  /**
   * Get the user's initials from their full name or email.
   * Returns the first letter of first and last name if available,
   * otherwise returns the first two characters of the email username.
   */
  get initials() {
    const [first, last] = this.fullName ? this.fullName.split(' ') : this.email.split('@')
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }
    return `${first.slice(0, 2)}`.toUpperCase()
  }
}
