import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Aligns `transactions.type` with the authoritative 6-type accounting model and
 * removes the now-defunct `affects_cash` flag: the cash sign is derived purely
 * from `type` (see balance_service). Legacy ledger-linked receipt/expense rows
 * are re-labelled as the equivalent repayment types.
 */
export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.defer(async (db) => {
      // Widen the enum first so the repayment_* values become assignable.
      await db.rawQuery(
        `ALTER TABLE transactions MODIFY type ` +
          `ENUM('lend','borrow','receipt','expense','repayment_received','repayment_made') NOT NULL`
      )
      // Re-label legacy debt-settling rows to their new dedicated types.
      await db.rawQuery(
        `UPDATE transactions SET type='repayment_received' WHERE type='receipt' AND ledger_id IS NOT NULL`
      )
      await db.rawQuery(
        `UPDATE transactions SET type='repayment_made' WHERE type='expense' AND ledger_id IS NOT NULL`
      )
      // The cash/debt split no longer needs a persisted flag.
      await db.rawQuery(`ALTER TABLE transactions DROP COLUMN affects_cash`)
    })
  }

  async down() {
    this.defer(async (db) => {
      // Re-add the flag (best-effort: default true, matching the pre-migration seed).
      await db.rawQuery(
        `ALTER TABLE transactions ADD COLUMN affects_cash TINYINT(1) NOT NULL DEFAULT 1`
      )
      // Fold the repayment types back into the 4-value enum before narrowing.
      await db.rawQuery(`UPDATE transactions SET type='receipt' WHERE type='repayment_received'`)
      await db.rawQuery(`UPDATE transactions SET type='expense' WHERE type='repayment_made'`)
      await db.rawQuery(
        `ALTER TABLE transactions MODIFY type ENUM('lend','borrow','receipt','expense') NOT NULL`
      )
    })
  }
}
