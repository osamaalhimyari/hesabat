import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ledgers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('contact_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('contacts')
        .onDelete('CASCADE')

      table.string('title').nullable()
      table.string('currency', 3).notNullable()
      table.enum('status', ['active', 'archived']).notNullable().defaultTo('active')
      table.timestamp('opened_at').notNullable()
      table.timestamp('closed_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['user_id'], 'ledgers_user_id_index')
      table.index(['contact_id', 'status'], 'ledgers_contact_status_index')
    })

    // Enforce "at most one active ledger per contact" at the DB level. Knex's
    // `table.unique()` can't express a WHERE clause, so use a partial unique
    // index (valid on both SQLite and Postgres).
    this.defer(async (db) => {
      await db.rawQuery(
        `CREATE UNIQUE INDEX ledgers_one_active_per_contact ` +
          `ON ledgers (contact_id) WHERE status = 'active'`
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
