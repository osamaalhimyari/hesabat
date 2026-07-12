import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * User-defined categories for tagging transactions (receipt/expense budgeting).
 * Each category is scoped to a user and unique by name within that user.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('categories', (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('name', 64).notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['user_id', 'name'])
      table.index(['user_id'], 'categories_user_id_index')
    })

    this.schema.alterTable('transactions', (table) => {
      table
        .integer('category_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('categories')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('transactions', (table) => {
      table.dropForeign(['category_id'])
      table.dropColumn('category_id')
    })
    this.schema.dropTable('categories')
  }
}
