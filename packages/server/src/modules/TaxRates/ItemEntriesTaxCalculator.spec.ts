import { DiscountType } from '@/common/types/Discount';
import {
  calcEntriesTaxAfterDiscount,
  getDocumentDiscountRatio,
  getEntryNetAmount,
} from './ItemEntriesTaxCalculator';

const line = (attrs = {}) => ({
  quantity: 1,
  rate: 100,
  taxRateId: 1,
  taxRate: 15,
  ...attrs,
});

describe('ItemEntriesTaxCalculator', () => {
  describe('getEntryNetAmount', () => {
    it('subtracts a percentage line discount', () => {
      expect(getEntryNetAmount(line({ quantity: 2, discount: 10 }))).toBe(180);
    });

    it('subtracts an amount line discount', () => {
      expect(
        getEntryNetAmount(
          line({ discount: 25, discountType: DiscountType.Amount }),
        ),
      ).toBe(75);
    });
  });

  describe('getDocumentDiscountRatio', () => {
    it('is 0 without a discount or a subtotal', () => {
      expect(getDocumentDiscountRatio(100, {})).toBe(0);
      expect(getDocumentDiscountRatio(0, { discount: 10 })).toBe(0);
    });

    it('caps an amount discount at the subtotal', () => {
      expect(
        getDocumentDiscountRatio(100, {
          discount: 150,
          discountType: DiscountType.Amount,
        }),
      ).toBe(1);
    });
  });

  describe('calcEntriesTaxAfterDiscount', () => {
    it('charges exclusive tax on the line after its discount', () => {
      const [result] = calcEntriesTaxAfterDiscount([line({ discount: 10 })]);

      expect(result).toEqual({ taxableAmount: 90, lineTaxAmount: 13.5 });
    });

    it('extracts inclusive tax from the discounted line', () => {
      const [result] = calcEntriesTaxAfterDiscount(
        [line({ rate: 115, discount: 10 })],
        { isInclusiveTax: true },
      );
      // 115 − 10% = 103.50 gross; 103.50 × 15/115 = 13.50 tax.
      expect(result).toEqual({ taxableAmount: 90, lineTaxAmount: 13.5 });
    });

    it('spreads the document discount over the lines by value', () => {
      const results = calcEntriesTaxAfterDiscount(
        [line({ rate: 300 }), line({ rate: 100, taxRateId: null })],
        { discount: 40, discountType: DiscountType.Amount },
      );
      // 10% of 400 off each line: 270 taxed at 15%, 90 untaxed.
      expect(results).toEqual([
        { taxableAmount: 270, lineTaxAmount: 40.5 },
        { taxableAmount: 90, lineTaxAmount: 0 },
      ]);
    });

    it('rounds the tax to cents per line', () => {
      const [result] = calcEntriesTaxAfterDiscount([line({ rate: 33.33 })]);

      expect(result.lineTaxAmount).toBe(5);
    });

    it('ignores a rate without a tax rate id', () => {
      const [result] = calcEntriesTaxAfterDiscount([
        line({ taxRateId: undefined }),
      ]);
      expect(result.lineTaxAmount).toBe(0);
    });
  });
});
