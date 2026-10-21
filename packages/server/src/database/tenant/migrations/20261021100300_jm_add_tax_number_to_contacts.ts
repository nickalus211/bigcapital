/**
 * Adds the tax registration number (e.g. Jamaican TRN) to the contacts.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table('contacts', (table) => {
    table.string('tax_number').nullable().defaultTo(null);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.table('contacts', (table) => {
    table.dropColumn('tax_number');
  });
};
