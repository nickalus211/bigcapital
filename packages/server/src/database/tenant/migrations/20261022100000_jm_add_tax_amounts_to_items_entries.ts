/**
 * Stores each line's taxable amount and tax. Rows written before this
 * migration keep both null, and their tax is still derived from the rate.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table('items_entries', (table) => {
    table.decimal('taxable_amount', 13, 3).nullable().defaultTo(null);
    table.decimal('line_tax_amount', 13, 3).nullable().defaultTo(null);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.table('items_entries', (table) => {
    table.dropColumn('taxable_amount');
    table.dropColumn('line_tax_amount');
  });
};
