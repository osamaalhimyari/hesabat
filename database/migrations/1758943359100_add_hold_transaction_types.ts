import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds the three custody ("money held with a contact" / أمانة) transaction
 * types. Everything stays derived from `type` (see balance_service):
 *   hold_deposit  — cash −, held +   (I put my money with him)
 *   hold_withdraw — cash +, held −   (I take my money back)
 *   hold_spend    — cash 0, held −   (he pays it out for me; money consumed)
 *
 * MySQL-only raw SQL, matching the 1758943358800 precedent. NOTE `down()` is
 * lossy once hold rows exist: they are re-labelled to their nearest cash
 * equivalent (deposit/spend → expense, withdraw → receipt) before narrowing.
 */
export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        `ALTER TABLE transactions MODIFY type ` +
          `ENUM('lend','borrow','receipt','expense','repayment_received','repayment_made',` +
          `'hold_deposit','hold_withdraw','hold_spend') NOT NULL`
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        `UPDATE transactions SET type='expense' WHERE type IN ('hold_deposit','hold_spend')`
      )
      await db.rawQuery(`UPDATE transactions SET type='receipt' WHERE type='hold_withdraw'`)
      await db.rawQuery(
        `ALTER TABLE transactions MODIFY type ` +
          `ENUM('lend','borrow','receipt','expense','repayment_received','repayment_made') NOT NULL`
      )
    })
  }
}
