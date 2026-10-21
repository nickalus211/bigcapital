import { Model } from 'objection';
import { BaseModel } from '@/models/Model';

export class ExpenseCategory extends BaseModel {
  public amount!: number;
  public allocatedCostAmount!: number;
  public expenseAccountId!: number;
  public projectId!: number;
  public description!: string;

  // Tax (`tax.extended_documents`); null on untaxed lines.
  public taxRateId?: number | null;
  public taxRate?: number | null;
  public taxableAmount?: number | null;
  public lineTaxAmount?: number | null;

  /**
   * Table name
   */
  static get tableName() {
    return 'expense_transaction_categories';
  }

  /**
   * Virtual attributes.
   */
  static get virtualAttributes() {
    return ['unallocatedCostAmount', 'taxAmount', 'amountExcludingTax'];
  }

  /**
   * Tax on the line.
   * @returns {number}
   */
  get taxAmount(): number {
    return this.lineTaxAmount || 0;
  }

  /**
   * The line amount posted to the expense account, without its tax.
   * @returns {number}
   */
  get amountExcludingTax(): number {
    return this.taxableAmount ?? this.amount;
  }

  /**
   * Remain unallocated landed cost.
   * @return {number}
   */
  get unallocatedCostAmount() {
    return Math.max(this.amount - this.allocatedCostAmount, 0);
  }

  /**
   * Relationship mapping.
   */
  static get relationMappings() {
    const { Account } = require('../../Accounts/models/Account.model');

    return {
      expenseAccount: {
        relation: Model.BelongsToOneRelation,
        modelClass: Account,
        join: {
          from: 'expense_transaction_categories.expenseAccountId',
          to: 'accounts.id',
        },
      },
    };
  }
}
