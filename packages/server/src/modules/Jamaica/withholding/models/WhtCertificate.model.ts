import { Model } from 'objection';
import { BaseModel } from '@/models/Model';

/**
 * A withholding tax certificate a customer issued for the tax it withheld
 * from payments in a tax year.
 */
export class WhtCertificate extends BaseModel {
  public id: number;
  public customerId: number;
  public certificateNumber?: string | null;
  public certificateDate: string;
  public taxYear: number;
  public periodFrom?: string | null;
  public periodTo?: string | null;
  public amount: number;
  public note?: string | null;

  /**
   * Table name
   */
  static get tableName() {
    return 'wht_certificates';
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
    const { Customer } = require('../../../Customers/models/Customer');

    return {
      customer: {
        relation: Model.BelongsToOneRelation,
        modelClass: Customer,
        join: {
          from: 'wht_certificates.customerId',
          to: 'contacts.id',
        },
        filter: (query) => {
          query.where('contact_service', 'customer');
        },
      },
    };
  }
}
