import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Multi-currency per contact: relax the "one active ledger per CONTACT" unique
 * constraint to "one active ledger per (CONTACT, CURRENCY)", so a contact can
 * hold a separate active ledger in each currency (e.g. they owe you both USD and
 * EUR at once). Mirrors the dialect branching of the original ledgers migration.
 *   - MySQL/MariaDB: rebuild the STORED helper column to key on contact+currency.
 *   - SQLite/Postgres: swap the partial unique index to `(contact_id, currency)`.
 */
export default class extends BaseSchema {
  protected tableName = 'ledgers'

  async up() {
    this.defer(async (db) => {
      if (db.dialect.name === 'mysql') {
        await db.rawQuery('DROP INDEX ledgers_one_active_per_contact ON ledgers')
        await db.rawQuery('ALTER TABLE ledgers DROP COLUMN active_contact_id')
        await db.rawQuery(
          'ALTER TABLE ledgers ADD COLUMN active_contact_currency VARCHAR(32) ' +
            "GENERATED ALWAYS AS (IF(`status` = 'active', CONCAT(`contact_id`, '-', `currency`), NULL)) STORED"
        )
        await db.rawQuery(
          'CREATE UNIQUE INDEX ledgers_one_active_per_contact_currency ' +
            'ON ledgers (active_contact_currency)'
        )
      } else {
        await db.rawQuery('DROP INDEX IF EXISTS ledgers_one_active_per_contact')
        await db.rawQuery(
          'CREATE UNIQUE INDEX ledgers_one_active_per_contact_currency ' +
            "ON ledgers (contact_id, currency) WHERE status = 'active'"
        )
      }
    })
  }

  async down() {
    this.defer(async (db) => {
      if (db.dialect.name === 'mysql') {
        await db.rawQuery('DROP INDEX ledgers_one_active_per_contact_currency ON ledgers')
        await db.rawQuery('ALTER TABLE ledgers DROP COLUMN active_contact_currency')
        await db.rawQuery(
          'ALTER TABLE ledgers ADD COLUMN active_contact_id INT UNSIGNED ' +
            "GENERATED ALWAYS AS (IF(`status` = 'active', `contact_id`, NULL)) STORED"
        )
        await db.rawQuery(
          'CREATE UNIQUE INDEX ledgers_one_active_per_contact ON ledgers (active_contact_id)'
        )
      } else {
        await db.rawQuery('DROP INDEX IF EXISTS ledgers_one_active_per_contact_currency')
        await db.rawQuery(
          'CREATE UNIQUE INDEX ledgers_one_active_per_contact ' +
            "ON ledgers (contact_id) WHERE status = 'active'"
        )
      }
    })
  }
}
