import { groupBy, sumBy } from 'lodash';

/**
 * The GCT return (Form 4A style) worked out from document lines. Pure, so it
 * is unit tested without a database. Amounts are in the base currency.
 */

export type GctLineSide = 'sale' | 'purchase';

export interface GctReturnLine {
  side: GctLineSide;
  /** -1 for credit notes and vendor credits, which reverse a supply. */
  sign: 1 | -1;
  taxRateId: number | null;
  /** Value of the supply without GCT. */
  taxableAmount: number;
  taxAmount: number;
}

export interface GctReturnTaxRate {
  id: number;
  code: string;
  name: string;
  rate: number;
  taxType: string | null;
}

export interface GctReturnRateLine {
  taxRateId: number;
  code: string;
  name: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface GctReturnSupplies {
  standardRated: GctReturnRateLine[];
  standardRatedAmount: number;
  zeroRatedAmount: number;
  exemptAmount: number;
  outOfScopeAmount: number;
  /** Lines whose tax rate has no tax type. */
  unclassifiedAmount: number;
  /** Lines with no tax rate. */
  noTaxRateAmount: number;
  /** Standard, zero-rated and exempt supplies (what the return declares). */
  totalAmount: number;
}

export interface GctReturnApportionment {
  enabled: boolean;
  /** Standard-rated and zero-rated supplies, which carry input tax credit. */
  taxableSuppliesAmount: number;
  /** Taxable plus exempt supplies. */
  totalSuppliesAmount: number;
  /** Share of input tax that is claimable, 0 to 1. */
  ratio: number;
  claimableInputTax: number;
  disallowedInputTax: number;
}

export interface GctReturnResult {
  supplies: GctReturnSupplies;
  outputTax: number;
  purchases: {
    standardRated: GctReturnRateLine[];
    standardRatedAmount: number;
    zeroRatedAndExemptAmount: number;
    inputTax: number;
  };
  apportionment: GctReturnApportionment;
  /** Output tax less claimable input tax. Negative means a refund is due. */
  netGct: number;
  position: 'payable' | 'refundable' | 'nil';
}

const cents = (amount: number) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

const signed = (line: GctReturnLine, field: 'taxableAmount' | 'taxAmount') =>
  line.sign * (line[field] || 0);

/**
 * Totals the given lines per tax rate, for the rates of the given tax type.
 */
const rateLines = (
  lines: GctReturnLine[],
  ratesById: Record<number, GctReturnTaxRate>,
): GctReturnRateLine[] => {
  const grouped = groupBy(lines, 'taxRateId');

  return Object.keys(grouped)
    .map((id) => {
      const rate = ratesById[Number(id)];
      return {
        taxRateId: rate.id,
        code: rate.code,
        name: rate.name,
        rate: Number(rate.rate),
        taxableAmount: cents(
          sumBy(grouped[id], (l) => signed(l, 'taxableAmount')),
        ),
        taxAmount: cents(sumBy(grouped[id], (l) => signed(l, 'taxAmount'))),
      };
    })
    .sort((a, b) => b.rate - a.rate || a.code.localeCompare(b.code));
};

/**
 * Works out the GCT return from the period's document lines.
 * @param {GctReturnLine[]} lines
 * @param {GctReturnTaxRate[]} taxRates
 * @param {{ apportionmentEnabled: boolean }} options
 * @returns {GctReturnResult}
 */
export const calcGctReturn = (
  lines: GctReturnLine[],
  taxRates: GctReturnTaxRate[],
  options: { apportionmentEnabled: boolean },
): GctReturnResult => {
  const ratesById = Object.fromEntries(taxRates.map((r) => [r.id, r]));
  const typeOf = (line: GctReturnLine) =>
    line.taxRateId ? (ratesById[line.taxRateId]?.taxType ?? null) : undefined;

  const ofType = (side: GctLineSide, type: string | null | undefined) =>
    lines.filter((line) => line.side === side && typeOf(line) === type);

  const total = (
    items: GctReturnLine[],
    field: 'taxableAmount' | 'taxAmount',
  ) => cents(sumBy(items, (line) => signed(line, field)));

  // Supplies (sales).
  const standardSales = ofType('sale', 'standard');
  const standardRatedAmount = total(standardSales, 'taxableAmount');
  const zeroRatedAmount = total(ofType('sale', 'zero_rated'), 'taxableAmount');
  const exemptAmount = total(ofType('sale', 'exempt'), 'taxableAmount');

  const supplies: GctReturnSupplies = {
    standardRated: rateLines(standardSales, ratesById),
    standardRatedAmount,
    zeroRatedAmount,
    exemptAmount,
    outOfScopeAmount: total(ofType('sale', 'out_of_scope'), 'taxableAmount'),
    unclassifiedAmount: total(ofType('sale', null), 'taxableAmount'),
    noTaxRateAmount: total(ofType('sale', undefined), 'taxableAmount'),
    totalAmount: cents(standardRatedAmount + zeroRatedAmount + exemptAmount),
  };
  // Output tax: every taxed sale line, classified or not.
  const outputTax = total(
    lines.filter((line) => line.side === 'sale'),
    'taxAmount',
  );

  // Purchases.
  const standardPurchases = ofType('purchase', 'standard');
  const inputTax = total(
    lines.filter((line) => line.side === 'purchase'),
    'taxAmount',
  );
  const purchases = {
    standardRated: rateLines(standardPurchases, ratesById),
    standardRatedAmount: total(standardPurchases, 'taxableAmount'),
    zeroRatedAndExemptAmount: total(
      [...ofType('purchase', 'zero_rated'), ...ofType('purchase', 'exempt')],
      'taxableAmount',
    ),
    inputTax,
  };

  // Apportionment: input tax relating to exempt supplies isn't claimable.
  const taxableSuppliesAmount = cents(standardRatedAmount + zeroRatedAmount);
  const totalSuppliesAmount = cents(taxableSuppliesAmount + exemptAmount);
  const ratio =
    options.apportionmentEnabled && totalSuppliesAmount > 0
      ? Math.min(Math.max(taxableSuppliesAmount / totalSuppliesAmount, 0), 1)
      : 1;
  const claimableInputTax = cents(inputTax * ratio);

  const netGct = cents(outputTax - claimableInputTax);

  return {
    supplies,
    outputTax,
    purchases,
    apportionment: {
      enabled: options.apportionmentEnabled,
      taxableSuppliesAmount,
      totalSuppliesAmount,
      ratio: Math.round(ratio * 10000) / 10000,
      claimableInputTax,
      disallowedInputTax: cents(inputTax - claimableInputTax),
    },
    netGct,
    position: netGct > 0 ? 'payable' : netGct < 0 ? 'refundable' : 'nil',
  };
};

/**
 * The return is due on the last working day (Monday to Friday) of the month
 * after the period ends. Public holidays are not taken into account.
 * @param {string} periodEnd - YYYY-MM-DD
 * @returns {string} YYYY-MM-DD
 */
export const getGctReturnDueDate = (periodEnd: string): string => {
  const [year, month] = periodEnd.split('-').map(Number);
  // Day 0 of the month after next = last day of the next month (UTC).
  const due = new Date(Date.UTC(year, month + 1, 0));

  while (due.getUTCDay() === 0 || due.getUTCDay() === 6) {
    due.setUTCDate(due.getUTCDate() - 1);
  }
  return due.toISOString().slice(0, 10);
};
