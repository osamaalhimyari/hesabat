import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('ledger_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('ledgers')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.enum('type', ['lend', 'borrow', 'receipt', 'expense']).notNullable()
      // Amount stored as a positive integer in the currency's smallest unit
      // (minor units). Sign is derived from `type` at balance time, where the
      // balance SQL multiplies this by -1 for borrow/receipt — so the column
      // must be SIGNED (an UNSIGNED BIGINT overflows on `value * -1` in MySQL).
      // A signed BIGINT still holds ±9.2e18 minor units, far beyond any amount.
      table.bigInteger('amount_minor').notNullable()
      table.string('currency', 3).notNullable()
      table.date('occurred_at').notNullable()
      table.text('note').nullable()
      table.string('attachment_url').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['ledger_id'], 'transactions_ledger_id_index')
      table.index(['user_id'], 'transactions_user_id_index')
      table.index(['ledger_id', 'type'], 'transactions_ledger_type_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
