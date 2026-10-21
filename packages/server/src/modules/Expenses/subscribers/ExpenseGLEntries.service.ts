import { Knex } from 'knex';
import { ExpenseGL } from './ExpenseGL';
import { Inject, Injectable } from '@nestjs/common';
import { Expense } from '../models/Expense.model';
import { ILedger } from '@/modules/Ledger/types/Ledger.types';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { TaxAccountsService } from '@/modules/TaxRates/TaxAccounts.service';

@Injectable()
export class ExpenseGLEntriesService {
  /**
   * @param {TenantModelProxy<typeof Expense>} expense - Expense model.
   */
  constructor(
    @Inject(Expense.name)
    private readonly expense: TenantModelProxy<typeof Expense>,

    private readonly taxAccounts: TaxAccountsService,
  ) {}

  /**
   * Retrieves the expense G/L of the given id.
   * @param {number} expenseId
   * @param {Knex.Transaction} trx - Knex transaction.
   * @returns {Promise<ILedger>}
   */
  public getExpenseLedgerById = async (
    expenseId: number,
    trx?: Knex.Transaction,
  ): Promise<ILedger> => {
    const expense = await this.expense()
      .query(trx)
      .findById(expenseId)
      .withGraphFetched('categories')
      .withGraphFetched('paymentAccount')
      .throwIfNotFound();

    // Input tax account, only for taxed expenses (`tax.extended_documents`).
    const taxAccountId =
      expense.taxAmountWithheld !== null &&
      expense.taxAmountWithheld !== undefined
        ? await this.taxAccounts.getInputTaxAccountId(trx)
        : null;

    return this.getExpenseLedger(expense, taxAccountId);
  };

  /**
   * Retrieves the given expense ledger.
   * @param {Expense} expense - Expense model.
   * @returns {ILedger}
   */
  public getExpenseLedger = (
    expense: Expense,
    taxAccountId: number | null = null,
  ): ILedger => {
    const expenseGL = new ExpenseGL(expense).setTaxAccountId(taxAccountId);

    return expenseGL.getExpenseLedger();
  };
}
