/**
 * Jamaica customs entries (C78): the duties and taxes paid to clear an
 * import, the bill of the goods they are allocated to, and the expense,
 * landed cost and ledger entries they posted.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('customs_entries', (table) => {
    table.increments();
    table.string('entry_number').notNullable().index();
    table.date('entry_date').notNullable().index();
    table.string('reference_no').nullable();
    table.integer('bill_id').unsigned().nullable().index();
    table.integer('payment_account_id').unsigned().notNullable();
    table.string('allocation_method', 16).notNullable().defaultTo('value');

    table.decimal('fob_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('freight_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('insurance_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('cif_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('customs_duty_rate', 8, 4).nullable();
    table.decimal('customs_duty_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('scf_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('epl_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('asd_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('sct_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('caf_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('import_gct_base', 13, 2).notNullable().defaultTo(0);
    table.decimal('import_gct_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('advance_gct_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('duties_amount', 13, 2).notNullable().defaultTo(0);
    table.decimal('total_amount', 13, 2).notNullable().defaultTo(0);

    table.integer('expense_id').unsigned().nullable();
    table.integer('landed_cost_id').unsigned().nullable();
    table.text('note').nullable();
    table.integer('user_id').unsigned().nullable();
    table.timestamps();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists('customs_entries');
};
