import { sumBy } from 'lodash';
import { DiscountType } from '@/common/types/Discount';
import { getExlusiveTaxAmount, getInclusiveTaxAmount } from './utils';

export interface ItemEntryTaxInput {
  quantity: number;
  rate: number;
  discount?: number;
  discountType?: DiscountType;
  taxRateId?: number | null;
  taxRate?: number | null;
}

export interface ItemEntryTaxAmounts {
  /** Line value the tax was charged on, excluding the tax itself. */
  taxableAmount: number;
  /** Tax charged on the line, rounded to cents. */
  lineTaxAmount: number;
}

export interface DocumentTaxOptions {
  isInclusiveTax?: boolean;
  /** Document-level discount. */
  discount?: number;
  discountType?: DiscountType;
}

const roundCents = (amount: number) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

/**
 * Taxable amount and tax of a single amount, rounded to cents.
 * @param {number} amount - The amount, including tax when inclusive.
 * @param {number} taxRate - Percentage.
 * @param {boolean} isInclusiveTax
 * @returns {ItemEntryTaxAmounts}
 */
export const calcAmountTax = (
  amount: number,
  taxRate: number,
  isInclusiveTax: boolean,
): ItemEntryTaxAmounts => {
  const lineTaxAmount = roundCents(
    isInclusiveTax
      ? getInclusiveTaxAmount(amount, taxRate)
      : getExlusiveTaxAmount(amount, taxRate),
  );
  const taxableAmount = roundCents(
    isInclusiveTax ? amount - lineTaxAmount : amount,
  );
  return { taxableAmount, lineTaxAmount };
};

/**
 * Line amount after the line discount (quantity × rate − line discount).
 * @param {ItemEntryTaxInput} entry
 * @returns {number}
 */
export const getEntryNetAmount = (entry: ItemEntryTaxInput): number => {
  const amount = (entry.quantity || 0) * (entry.rate || 0);
  const discount = entry.discount || 0;

  if (!discount) return amount;

  return entry.discountType === DiscountType.Amount
    ? amount - discount
    : amount - amount * (discount / 100);
};

/**
 * Share of the subtotal removed by the document-level discount, 0 to 1.
 * The percentage discount matches the document models, which apply it to
 * the subtotal of the lines' net amounts.
 * @param {number} subtotal
 * @param {DocumentTaxOptions} options
 * @returns {number}
 */
export const getDocumentDiscountRatio = (
  subtotal: number,
  options: DocumentTaxOptions,
): number => {
  const discount = options.discount || 0;
  if (!discount || subtotal <= 0) return 0;

  const discountAmount =
    options.discountType === DiscountType.Amount
      ? discount
      : subtotal * (discount / 100);

  return Math.min(Math.max(discountAmount / subtotal, 0), 1);
};

/**
 * Calculates each line's taxable amount and tax after the line discount and
 * its share of the document discount, the way GCT is charged on the
 * consideration actually received. The tax is rounded to cents per line.
 * @param {ItemEntryTaxInput[]} entries
 * @param {DocumentTaxOptions} options
 * @returns {ItemEntryTaxAmounts[]} In the same order as `entries`.
 */
export const calcEntriesTaxAfterDiscount = (
  entries: ItemEntryTaxInput[],
  options: DocumentTaxOptions = {},
): ItemEntryTaxAmounts[] => {
  const netAmounts = entries.map(getEntryNetAmount);
  const subtotal = sumBy(netAmounts);
  const ratio = getDocumentDiscountRatio(subtotal, options);

  return entries.map((entry, index) => {
    const base = netAmounts[index] * (1 - ratio);
    const taxRate = entry.taxRateId ? entry.taxRate || 0 : 0;

    return calcAmountTax(base, taxRate, !!options.isInclusiveTax);
  });
};
