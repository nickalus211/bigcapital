const TABLES = [
  'sales_receipts',
  'credit_notes',
  'vendor_credits',
  'sales_estimates',
  'expenses_transactions',
];

/**
 * Adds the tax columns that invoices and bills already have to receipts,
 * credit notes, vendor credits, estimates and expenses, and a tax rate to
 * expense lines. Existing rows carry no tax.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  for (const tableName of TABLES) {
    await knex.schema.table(tableName, (table) => {
      table.boolean('is_inclusive_tax').defaultTo(false);
      table.decimal('tax_amount_withheld', 13, 2).nullable();
    });
  }
  await knex.schema.table('expense_transaction_categories', (table) => {
    table
      .integer('tax_rate_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('tax_rates');
    table.decimal('tax_rate', 8, 2).unsigned().nullable();
    table.decimal('taxable_amount', 13, 3).nullable();
    table.decimal('line_tax_amount', 13, 3).nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.table('expense_transaction_categories', (table) => {
    table.dropForeign(['tax_rate_id']);
    table.dropColumn('tax_rate_id');
    table.dropColumn('tax_rate');
    table.dropColumn('taxable_amount');
    table.dropColumn('line_tax_amount');
  });
  for (const tableName of TABLES) {
    await knex.schema.table(tableName, (table) => {
      table.dropColumn('is_inclusive_tax');
      table.dropColumn('tax_amount_withheld');
    });
  }
};
