import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Personal (contact-less) cash entries live in the same `transactions` table
 * but have no ledger, so `ledger_id` must become nullable. A NULL ledger means
 * the row is a personal receipt/expense that moves the user's cash wallet; a
 * non-NULL ledger means it's a debt entry on a contact's ledger (unchanged).
 *
 * The FK + ON DELETE CASCADE is preserved for non-NULL rows:
 *   - MySQL: `MODIFY` keeps the same type, so the existing FK stays valid.
 *   - SQLite: knex rebuilds the table via `.alter()`, carrying the FK over.
 */
export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    if (this.db.dialect.name === 'mysql') {
      this.defer(async (db) => {
        await db.rawQuery('ALTER TABLE transactions MODIFY ledger_id INT UNSIGNED NULL')
      })
    } else {
      this.schema.alterTable(this.tableName, (table) => {
        table.integer('ledger_id').unsigned().nullable().alter()
      })
    }
  }

  async down() {
    // Lossy: personal rows (NULL ledger) can't satisfy NOT NULL, so drop them first.
    this.defer(async (db) => {
      await db.from('transactions').whereNull('ledger_id').delete()
    })

    if (this.db.dialect.name === 'mysql') {
      this.defer(async (db) => {
        await db.rawQuery('ALTER TABLE transactions MODIFY ledger_id INT UNSIGNED NOT NULL')
      })
    } else {
      this.schema.alterTable(this.tableName, (table) => {
        table.integer('ledger_id').unsigned().notNullable().alter()
      })
    }
  }
}
