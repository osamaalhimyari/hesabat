import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds the two "due" transaction types — a debt that never passed through the
 * user's wallet. Everything stays derived from `type` (see balance_service):
 *   due_to_me   — cash 0, debt +  (he owes me; e.g. the unpaid part of a salary)
 *   due_from_me — cash 0, debt −  (I owe him; e.g. goods taken on credit)
 *
 * These are what `lend` / `borrow` cannot express: those two also move the cash
 * wallet, which wrongly drains (or inflates) it for money that never changed
 * hands. Settlement needs no new type — repayment_received / repayment_made
 * already close a due.
 *
 * MySQL-only raw SQL, matching the 1758943358800 precedent. NOTE `down()` is
 * lossy once due rows exist: they are re-labelled to their nearest debt
 * equivalent (due_to_me → lend, due_from_me → borrow) before narrowing, which
 * ALSO shifts the cash wallet by those amounts — lend/borrow move cash and dues
 * do not.
 */
export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        `ALTER TABLE transactions MODIFY type ` +
          `ENUM('lend','borrow','receipt','expense','repayment_received','repayment_made',` +
          `'hold_deposit','hold_withdraw','hold_spend','due_to_me','due_from_me') NOT NULL`
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`UPDATE transactions SET type='lend' WHERE type='due_to_me'`)
      await db.rawQuery(`UPDATE transactions SET type='borrow' WHERE type='due_from_me'`)
      await db.rawQuery(
        `ALTER TABLE transactions MODIFY type ` +
          `ENUM('lend','borrow','receipt','expense','repayment_received','repayment_made',` +
          `'hold_deposit','hold_withdraw','hold_spend') NOT NULL`
      )
    })
  }
}
