import { Model } from 'objection';
import { BaseModel } from '@/models/Model';

/**
 * A Jamaica customs entry (C78). Amounts are in the base currency.
 */
export class CustomsEntry extends BaseModel {
  public id: number;
  public entryNumber: string;
  public entryDate: string;
  public referenceNo?: string | null;
  public billId?: number | null;
  public paymentAccountId: number;
  public allocationMethod: 'value' | 'quantity';

  public fobAmount: number;
  public freightAmount: number;
  public insuranceAmount: number;
  public cifAmount: number;
  public customsDutyRate?: number | null;
  public customsDutyAmount: number;
  public scfAmount: number;
  public eplAmount: number;
  public asdAmount: number;
  public sctAmount: number;
  public cafAmount: number;
  public importGctBase: number;
  public importGctAmount: number;
  public advanceGctAmount: number;
  public dutiesAmount: number;
  public totalAmount: number;

  public expenseId?: number | null;
  public landedCostId?: number | null;
  public note?: string | null;
  public userId?: number | null;

  /**
   * Table name
   */
  static get tableName() {
    return 'customs_entries';
  }

  /**
   * Timestamps columns.
   */
  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }

  /**
   * Relationship mapping.
   */
  static get relationMappings() {
    const { Bill } = require('../../../Bills/models/Bill');
    const { Account } = require('../../../Accounts/models/Account.model');

    return {
      bill: {
        relation: Model.BelongsToOneRelation,
        modelClass: Bill,
        join: {
          from: 'customs_entries.billId',
          to: 'bills.id',
        },
      },
      paymentAccount: {
        relation: Model.BelongsToOneRelation,
        modelClass: Account,
        join: {
          from: 'customs_entries.paymentAccountId',
          to: 'accounts.id',
        },
      },
    };
  }
}
