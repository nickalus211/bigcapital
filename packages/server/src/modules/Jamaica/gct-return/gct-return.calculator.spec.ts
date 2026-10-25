import {
  calcGctReturn,
  getGctReturnDueDate,
  GctReturnLine,
} from './gct-return.calculator';

const rates = [
  {
    id: 1,
    code: 'GCT-STD',
    name: 'GCT Standard',
    rate: 15,
    taxType: 'standard',
  },
  {
    id: 2,
    code: 'GCT-ZERO',
    name: 'GCT Zero-rated',
    rate: 0,
    taxType: 'zero_rated',
  },
  { id: 3, code: 'GCT-EXEMPT', name: 'GCT Exempt', rate: 0, taxType: 'exempt' },
  {
    id: 4,
    code: 'GCT-TEL',
    name: 'GCT Telephone',
    rate: 25,
    taxType: 'standard',
  },
  { id: 5, code: 'OLD', name: 'Old rate', rate: 15, taxType: null },
];

const sale = (taxRateId: number | null, taxableAmount: number, taxAmount = 0) =>
  ({
    side: 'sale',
    sign: 1,
    taxRateId,
    taxableAmount,
    taxAmount,
  }) as GctReturnLine;
const purchase = (
  taxRateId: number | null,
  taxableAmount: number,
  taxAmount = 0,
) =>
  ({
    side: 'purchase',
    sign: 1,
    taxRateId,
    taxableAmount,
    taxAmount,
  }) as GctReturnLine;
const reverse = (line: GctReturnLine) =>
  ({ ...line, sign: -1 }) as GctReturnLine;

describe('calcGctReturn', () => {
  it('classifies supplies by tax type and nets credit notes', () => {
    const result = calcGctReturn(
      [
        sale(1, 1000, 150),
        sale(4, 100, 25),
        reverse(sale(1, 200, 30)),
        sale(2, 300),
        sale(3, 400),
        sale(5, 50, 7.5),
        sale(null, 60),
      ],
      rates,
      { apportionmentEnabled: false },
    );
    expect(result.supplies).toMatchObject({
      standardRatedAmount: 900,
      zeroRatedAmount: 300,
      exemptAmount: 400,
      unclassifiedAmount: 50,
      noTaxRateAmount: 60,
      totalAmount: 1600,
    });
    expect(result.supplies.standardRated).toEqual([
      expect.objectContaining({
        code: 'GCT-TEL',
        taxableAmount: 100,
        taxAmount: 25,
      }),
      expect.objectContaining({
        code: 'GCT-STD',
        taxableAmount: 800,
        taxAmount: 120,
      }),
    ]);
    // 150 + 25 − 30 + 7.50 (unclassified lines still charged GCT).
    expect(result.outputTax).toBe(152.5);
  });

  it('nets input tax against output tax', () => {
    const result = calcGctReturn(
      [sale(1, 1000, 150), purchase(1, 400, 60), reverse(purchase(1, 100, 15))],
      rates,
      { apportionmentEnabled: false },
    );
    expect(result.purchases.inputTax).toBe(45);
    expect(result.netGct).toBe(105);
    expect(result.position).toBe('payable');
  });

  it('reports a refund for zero-rated sellers', () => {
    const result = calcGctReturn([sale(2, 1000), purchase(1, 400, 60)], rates, {
      apportionmentEnabled: true,
    });
    expect(result.apportionment.ratio).toBe(1);
    expect(result.netGct).toBe(-60);
    expect(result.position).toBe('refundable');
  });

  it('apportions input tax when there are exempt supplies', () => {
    const result = calcGctReturn(
      [sale(1, 600, 90), sale(3, 400), purchase(1, 1000, 150)],
      rates,
      { apportionmentEnabled: true },
    );
    expect(result.apportionment).toEqual({
      enabled: true,
      taxableSuppliesAmount: 600,
      totalSuppliesAmount: 1000,
      ratio: 0.6,
      claimableInputTax: 90,
      disallowedInputTax: 60,
    });
    expect(result.netGct).toBe(0);
    expect(result.position).toBe('nil');
  });

  it('claims all input tax while apportionment is off', () => {
    const result = calcGctReturn(
      [sale(1, 600, 90), sale(3, 400), purchase(1, 1000, 150)],
      rates,
      { apportionmentEnabled: false },
    );
    expect(result.apportionment.claimableInputTax).toBe(150);
    expect(result.netGct).toBe(-60);
  });
});

describe('calcGctReturn imports', () => {
  it('adds import GCT to input tax and credits advance GCT', () => {
    const result = calcGctReturn(
      [sale(1, 1000, 150)],
      rates,
      {
        apportionmentEnabled: false,
      },
      { taxableAmount: 120800, importGct: 18120, advanceGct: 6040 },
    );

    expect(result.purchases.importGct).toEqual({
      taxableAmount: 120800,
      taxAmount: 18120,
    });
    expect(result.purchases.inputTax).toBe(18120);
    expect(result.advanceGctCredit).toBe(6040);
    // 150 − 18,120 − 6,040
    expect(result.netGct).toBe(-24010);
    expect(result.position).toBe('refundable');
  });

  it('apportions import GCT like other input tax', () => {
    const result = calcGctReturn(
      [sale(1, 600, 90), sale(3, 400)],
      rates,
      { apportionmentEnabled: true },
      { taxableAmount: 1000, importGct: 150, advanceGct: 0 },
    );
    expect(result.apportionment.claimableInputTax).toBe(90);
    expect(result.netGct).toBe(0);
  });

  it('changes nothing without imports', () => {
    const result = calcGctReturn([sale(1, 1000, 150)], rates, {
      apportionmentEnabled: false,
    });
    expect(result.advanceGctCredit).toBe(0);
    expect(result.purchases.importGct.taxAmount).toBe(0);
    expect(result.netGct).toBe(150);
  });
});

describe('getGctReturnDueDate', () => {
  it('is the last day of the next month', () => {
    expect(getGctReturnDueDate('2026-10-31')).toBe('2026-11-30'); // Mon
  });

  it('moves back from a weekend to Friday', () => {
    expect(getGctReturnDueDate('2026-09-30')).toBe('2026-10-30'); // 31st is a Sat
    expect(getGctReturnDueDate('2026-12-31')).toBe('2027-01-29'); // 31st is a Sun
  });
});
