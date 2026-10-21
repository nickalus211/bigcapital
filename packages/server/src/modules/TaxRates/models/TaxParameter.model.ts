import { BaseModel } from '@/models/Model';

/**
 * Effective-dated tax parameter of a jurisdiction (thresholds, filing
 * days, statutory rates). The value is stored as JSON text.
 */
export class TaxParameter extends BaseModel {
  public id: number;
  public jurisdiction: string;
  public key: string;
  public value: string;
  public effectiveFrom: string;
  public effectiveTo?: string | null;
  public verified: boolean;
  public sourceNote?: string | null;

  /**
   * Table name
   */
  static get tableName() {
    return 'tax_parameters';
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
       * Filters the parameters effective on the given date.
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
