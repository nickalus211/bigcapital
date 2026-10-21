import { sumBy } from 'lodash';
import { Transformer } from '@/modules/Transformer/Transformer';
import {
  getExlusiveTaxAmount,
  getInclusiveTaxAmount,
} from '../../TaxRates/utils';

export class SaleInvoiceTaxEntryTransformer extends Transformer {
  /**
   * Included attributes.
   * @returns {Array}
   */
  public includeAttributes = (): string[] => {
    return [
      'id',
      'name',
      'taxRateCode',
      'taxRate',
      'taxRateId',
      'taxRateAmount',
      'taxRateAmountFormatted',
    ];
  };

  /**
   * Exclude attributes.
   * @returns {string[]}
   */
  public excludeAttributes = (): string[] => {
    return ['*'];
  };

  /**
   *  Retrieve  tax rate code.
   * @param taxEntry
   * @returns {string}
   */
  protected taxRateCode = (taxEntry) => {
    return taxEntry.taxRate.code;
  };

  /**
   * Retrieve tax rate id.
   * @param taxEntry
   * @returns {number}
   */
  protected taxRate = (taxEntry) => {
    // The rate written with the document (dated versions included).
    return taxEntry.rate ?? taxEntry.taxRate.rate;
  };

  /**
   * Retrieve tax rate name.
   * @param taxEntry
   * @returns {string}
   */
  protected name = (taxEntry) => {
    return taxEntry.taxRate.name;
  };

  /**
   * Retrieve tax rate amount.
   * @param taxEntry
   */
  protected taxRateAmount = (taxEntry) => {
    // Sum of the tax on the lines charged at this rate.
    if (this.options.entries) {
      return sumBy(
        this.options.entries.filter(
          (entry) => entry.taxRateId === taxEntry.taxRateId,
        ),
        (entry) => entry.taxAmount || 0,
      );
    }
    const taxRate = this.taxRate(taxEntry);

    return this.options.isInclusiveTax
      ? getInclusiveTaxAmount(this.options.subtotal, taxRate)
      : getExlusiveTaxAmount(this.options.subtotal, taxRate);
  };

  /**
   * Retrieve formatted tax rate amount.
   * @returns {string}
   */
  protected taxRateAmountFormatted = (taxEntry) => {
    return this.formatNumber(this.taxRateAmount(taxEntry), {
      currencyCode: this.options.currencyCode,
    });
  };
}
