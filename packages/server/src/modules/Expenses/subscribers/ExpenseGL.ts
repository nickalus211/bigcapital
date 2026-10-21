import * as R from 'ramda';
import { ILedger } from '@/modules/Ledger/types/Ledger.types';
import { AccountNormal } from '@/modules/Accounts/Accounts.types';
import { ILedgerEntry } from '@/modules/Ledger/types/Ledger.types';
import { ExpenseCategory } from '../models/ExpenseCategory.model';
import { Ledger } from '@/modules/Ledger/Ledger';
import { Expense } from '../models/Expense.model';

export class ExpenseGL {
  private expense: Expense;
  private taxAccountId: number | null = null;

  /**
   * Constructor method.
   * @param {Expense} expense - Expense.
   */
  constructor(expense: Expense) {
    this.expense = expense;
  }

  /**
   * Sets the account that input tax on the categories posts to.
   * @param {number | null} taxAccountId
   */
  setTaxAccountId(taxAccountId: number | null) {
    this.taxAccountId = taxAccountId;
    return this;
  }

  /**
   * Retrieves the expense GL common entry.
   */
  private getExpenseGLCommonEntry = () => {
    return {
      currencyCode: this.expense.currencyCode,
      exchangeRate: this.expense.exchangeRate,

      transactionType: 'Expense',
      transactionId: this.expense.id,

      date: this.expense.paymentDate,
      userId: this.expense.userId,

      debit: 0,
      credit: 0,

      branchId: this.expense.branchId,
    };
  };

  /**
   * Retrieves the expense GL payment entry.
   * @returns {ILedgerEntry}
   */
  private getExpenseGLPaymentEntry = (): ILedgerEntry => {
    const commonEntry = this.getExpenseGLCommonEntry();

    return {
      ...commonEntry,
      credit: this.expense.localAmount,
      accountId: this.expense.paymentAccountId,
      accountNormal:
        this.expense?.paymentAccount?.accountNormal === 'debit'
          ? AccountNormal.DEBIT
          : AccountNormal.CREDIT,
      index: 1,
    };
  };

  /**
   * Retrieves the expense GL category entry.
   * @param {ExpenseCategory} category - Expense category.
   * @param {number} index
   * @returns {ILedgerEntry}
   */
  private getExpenseGLCategoryEntry = R.curry(
    (category: ExpenseCategory, index: number): ILedgerEntry => {
      const commonEntry = this.getExpenseGLCommonEntry();
      const localAmount =
        category.amountExcludingTax * this.expense.exchangeRate;

      return {
        ...commonEntry,
        accountId: category.expenseAccountId,
        accountNormal: AccountNormal.DEBIT,
        debit: localAmount,
        note: category.description,
        index: index + 2,
        projectId: category.projectId,
        ...(category.taxRateId && {
          taxRateId: category.taxRateId,
          taxRate: category.taxRate,
        }),
      };
    },
  );

  /**
   * Retrieves the input tax entries of the categories.
   * @returns {ILedgerEntry[]}
   */
  private getExpenseGLTaxEntries = (): ILedgerEntry[] => {
    if (!this.taxAccountId) return [];

    const commonEntry = this.getExpenseGLCommonEntry();

    return this.expense.categories
      .filter((category) => category.taxAmount > 0)
      .map((category, index) => ({
        ...commonEntry,
        debit: category.taxAmount * this.expense.exchangeRate,
        accountId: this.taxAccountId,
        accountNormal: AccountNormal.DEBIT,
        index: index + 1,
        indexGroup: 30,
        taxRateId: category.taxRateId,
        taxRate: category.taxRate,
      }));
  };

  /**
   * Retrieves the expense GL entries.
   * @returns {ILedgerEntry[]}
   */
  public getExpenseGLEntries = (): ILedgerEntry[] => {
    const getCategoryEntry = this.getExpenseGLCategoryEntry();

    const paymentEntry = this.getExpenseGLPaymentEntry();
    const categoryEntries = this.expense.categories.map((category, index) =>
      getCategoryEntry(category, index),
    );
    return [paymentEntry, ...categoryEntries, ...this.getExpenseGLTaxEntries()];
  };

  /**
   * Retrieves the given expense ledger.
   * @returns {ILedger}
   */
  public getExpenseLedger = (): ILedger => {
    const entries = this.getExpenseGLEntries();

    return new Ledger(entries);
  };
}
