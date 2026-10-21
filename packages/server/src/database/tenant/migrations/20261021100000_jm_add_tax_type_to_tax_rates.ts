/**
 * Adds the tax type to the tax rates, distinguishing standard-rated,
 * zero-rated, exempt and out-of-scope supplies (e.g. Jamaican GCT).
 * NULL means unclassified, which keeps the existing tax rates unchanged.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table('tax_rates', (table) => {
    table
      .enum('tax_type', ['standard', 'zero_rated', 'exempt', 'out_of_scope'])
      .nullable()
      .defaultTo(null)
      .after('rate');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.table('tax_rates', (table) => {
    table.dropColumn('tax_type');
  });
};
