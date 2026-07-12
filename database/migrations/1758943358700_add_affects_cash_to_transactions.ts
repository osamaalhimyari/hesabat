import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `affects_cash` decouples the cash wallet from the debt ledger: a transaction
 * counts toward the user's personal balance when this is true, INDEPENDENTLY of
 * whether it's linked to a contact (ledger). So one entry can move both books
 * (e.g. lending cash to a contact: their debt goes up AND your money goes down).
 *
 * Backfill: existing personal (ledger-less) rows were cash entries, so they keep
 * counting; existing debt rows did not touch cash, so they stay false.
 */
export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('affects_cash').notNullable().defaultTo(false)
    })
    this.defer(async (db) => {
      await db.from('transactions').whereNull('ledger_id').update({ affects_cash: true })
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('affects_cash')
    })
  }
}
