import { BaseModel } from '@/models/Model';

/**
 * Effective-dated rate of a tax rate.
 */
export class TaxRateVersion extends BaseModel {
  public id: number;
  public taxRateId: number;
  public rate: number;
  public effectiveFrom: string;
  public effectiveTo?: string | null;
  public verified: boolean;
  public sourceNote?: string | null;

  /**
   * Table name
   */
  static get tableName() {
    return 'tax_rate_versions';
  }

  /**
   * Timestamps columns.
   */
  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }

  /**
   * Model modifiers.
   */
  static get modifiers() {
    return {
      /**
       * Filters the versions effective on the given date.
       */
      effectiveOn(query, date: string) {
        query
          .where('effective_from', '<=', date)
          .where((builder) =>
            builder
              .whereNull('effective_to')
              .orWhere('effective_to', '>=', date),
          );
      },
    };
  }
}
