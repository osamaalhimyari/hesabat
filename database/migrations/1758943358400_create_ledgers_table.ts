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

    // Enforce "at most one active ledger per contact" at the DB level, atomically.
    // The natural expression is a partial unique index, but MySQL/MariaDB does
    // not support the `WHERE` clause. So we branch by dialect:
    //   - SQLite / Postgres: partial unique index on `contact_id WHERE active`.
    //   - MySQL / MariaDB: a STORED generated column that equals `contact_id`
    //     only while active (NULL otherwise) + a plain unique index. MySQL treats
    //     each NULL as distinct, so archived rows never collide, and the index
    //     still guarantees a single active ledger per contact. The helper column
    //     is hidden from the API via `serializeAs: null` on the Ledger model.
    this.defer(async (db) => {
      if (db.dialect.name === 'mysql') {
        await db.rawQuery(
          'ALTER TABLE ledgers ADD COLUMN active_contact_id INT UNSIGNED ' +
            "GENERATED ALWAYS AS (IF(`status` = 'active', `contact_id`, NULL)) STORED"
        )
        await db.rawQuery(
          'CREATE UNIQUE INDEX ledgers_one_active_per_contact ON ledgers (active_contact_id)'
        )
      } else {
        await db.rawQuery(
          `CREATE UNIQUE INDEX ledgers_one_active_per_contact ` +
            `ON ledgers (contact_id) WHERE status = 'active'`
        )
      }
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
