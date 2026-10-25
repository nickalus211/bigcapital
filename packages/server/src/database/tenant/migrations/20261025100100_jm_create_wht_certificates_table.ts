/**
 * Withholding tax certificates customers issue for the tax they withheld
 * from payments (Jamaica WHT on specified services). The certified amounts
 * are the credit claimed on the S04 return.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('wht_certificates', (table) => {
    table.increments();
    table.integer('customer_id').unsigned().notNullable().index();
    table.string('certificate_number').nullable();
    table.date('certificate_date').notNullable();
    table.integer('tax_year').unsigned().notNullable().index();
    table.date('period_from').nullable();
    table.date('period_to').nullable();
    table.decimal('amount', 13, 2).notNullable();
    table.text('note').nullable();
    table.timestamps();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('wht_certificates');
};
