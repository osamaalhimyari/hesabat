import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'contacts'

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

      table.string('name', 254).notNullable()
      table.string('phone', 32).nullable()
      table.string('photo_url').nullable()
      table.enum('source', ['manual', 'imported']).notNullable().defaultTo('manual')
      table.string('device_contact_id').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['user_id'], 'contacts_user_id_index')
      // Idempotent re-import: the same device contact can't be imported twice.
      table.unique(['user_id', 'device_contact_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
