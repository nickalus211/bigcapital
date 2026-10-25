import { allocateByWeight, calcCustomsEntry } from './customs-entry.calculator';

const rates = {
  scfRate: 0.3,
  eplRate: 0.5,
  importGctRate: 15,
  advanceGctRate: 5,
};

describe('calcCustomsEntry', () => {
  it('works out the duties and taxes from the CIF value', () => {
    const result = calcCustomsEntry(
      {
        fobAmount: 90000,
        freightAmount: 8000,
        insuranceAmount: 2000,
        customsDutyRate: 20,
        asdAmount: 0,
        sctAmount: 0,
        cafAmount: 2500,
      },
      rates,
    );
    expect(result).toMatchObject({
      cifAmount: 100000,
      customsDutyAmount: 20000,
      scfAmount: 300,
      eplAmount: 500,
      // 100,000 + 20,000 + 300 + 500
      importGctBase: 120800,
      importGctAmount: 18120,
      advanceGctAmount: 6040,
      // 20,000 + 300 + 500 + 2,500
      dutiesAmount: 23300,
      taxesAmount: 24160,
      totalAmount: 47460,
      overrides: [],
    });
  });

  it('includes ASD and SCT in the import GCT base, not CAF', () => {
    const result = calcCustomsEntry(
      { fobAmount: 1000, asdAmount: 100, sctAmount: 50, cafAmount: 500 },
      { ...rates, scfRate: 0, eplRate: 0, advanceGctRate: 0 },
    );
    expect(result.importGctBase).toBe(1150);
    expect(result.importGctAmount).toBe(172.5);
    expect(result.dutiesAmount).toBe(650);
  });

  it('uses the C78 amounts when given and reports the overrides', () => {
    const result = calcCustomsEntry(
      {
        fobAmount: 100000,
        customsDutyRate: 20,
        customsDutyAmount: 19999.99,
        importGctAmount: 18000,
        advanceGctAmount: 0,
      },
      rates,
    );
    expect(result.customsDutyAmount).toBe(19999.99);
    expect(result.importGctAmount).toBe(18000);
    expect(result.advanceGctAmount).toBe(0);
    expect(result.overrides.map((o) => o.field)).toEqual([
      'customs_duty_amount',
      'import_gct_amount',
      'advance_gct_amount',
    ]);
  });

  it('rounds each amount to cents', () => {
    const result = calcCustomsEntry({ fobAmount: 333.33 }, rates);
    expect(result.scfAmount).toBe(1);
    expect(result.eplAmount).toBe(1.67);
  });
});

describe('allocateByWeight', () => {
  it('spreads the amount by weight and keeps the total', () => {
    const lines = allocateByWeight(100, [
      { entryId: 1, weight: 1 },
      { entryId: 2, weight: 1 },
      { entryId: 3, weight: 1 },
    ]);
    expect(lines.reduce((sum, line) => sum + line.cost, 0)).toBeCloseTo(100, 6);
    expect(lines.map((line) => line.cost).sort()).toEqual([
      33.33, 33.33, 33.34,
    ]);
  });

  it('allocates by value', () => {
    expect(
      allocateByWeight(300, [
        { entryId: 1, weight: 2000 },
        { entryId: 2, weight: 1000 },
      ]),
    ).toEqual([
      { entryId: 1, cost: 200 },
      { entryId: 2, cost: 100 },
    ]);
  });

  it('returns nothing without weight', () => {
    expect(allocateByWeight(100, [{ entryId: 1, weight: 0 }])).toEqual([]);
  });
});
