/**
 * Tax a customer withheld from a payment (e.g. Jamaica's 3% withholding tax
 * on specified services). Existing payments carry none.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table('payment_receives', (table) => {
    table.decimal('withholding_tax_amount', 13, 2).nullable().defaultTo(null);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.table('payment_receives', (table) => {
    table.dropColumn('withholding_tax_amount');
  });
};
