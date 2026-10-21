/**
 * Creates the effective-dated versions of the tax rates, so a rate change
 * (e.g. a budget measure) applies by transaction date without editing the
 * tax rate itself. Tax rates without versions keep using `tax_rates.rate`.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('tax_rate_versions', (table) => {
    table.increments();
    table
      .integer('tax_rate_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tax_rates')
      .onDelete('CASCADE');
    table.decimal('rate', 8, 4).notNullable();
    table.date('effective_from').notNullable();
    table.date('effective_to').nullable();
    table.boolean('verified').notNullable().defaultTo(false);
    table.string('source_note').nullable();
    table.timestamps();

    table.unique(['tax_rate_id', 'effective_from']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('tax_rate_versions');
};
