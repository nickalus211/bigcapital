/**
 * Creates the effective-dated tax parameters (thresholds, filing days,
 * statutory rates) per jurisdiction, so budget changes are data, not code.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('tax_parameters', (table) => {
    table.increments();
    table.string('jurisdiction', 8).notNullable();
    table.string('key').notNullable();
    table.text('value').notNullable();
    table.date('effective_from').notNullable();
    table.date('effective_to').nullable();
    table.boolean('verified').notNullable().defaultTo(false);
    table.string('source_note').nullable();
    table.timestamps();

    table.unique(['jurisdiction', 'key', 'effective_from']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('tax_parameters');
};
