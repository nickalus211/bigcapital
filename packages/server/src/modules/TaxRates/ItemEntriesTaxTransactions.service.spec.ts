import { ItemEntriesTaxTransactions } from './ItemEntriesTaxTransactions.service';

describe('ItemEntriesTaxTransactions.assocTaxRateFromTaxIdToEntries', () => {
  const taxRates = [
    { id: 1, rate: 15 },
    { id: 2, rate: 0 },
  ];

  const build = (versions: Array<Record<string, unknown>> = []) => {
    const versionQuery = {
      whereIn: jest.fn().mockReturnThis(),
      modify: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockResolvedValue(versions),
    };
    const service = new ItemEntriesTaxTransactions(
      (() => ({})) as any,
      (() => ({
        query: () => ({ whereIn: jest.fn().mockResolvedValue(taxRates) }),
      })) as any,
      (() => ({ query: () => versionQuery })) as any,
      (() => ({})) as any,
      { accessible: jest.fn().mockResolvedValue(true) } as any,
      { getTaxSettings: jest.fn() } as any,
    );
    return { service, versionQuery };
  };

  const entries = () =>
    [{ taxRateId: 1 }, { taxRateId: 2 }, { taxRateId: null }] as any[];

  it('uses the tax rate when no date is given', async () => {
    const { service, versionQuery } = build([{ taxRateId: 1, rate: 99 }]);

    const result = await service.assocTaxRateFromTaxIdToEntries(entries());

    expect(result.map((e) => e.taxRate)).toEqual([15, 0, undefined]);
    expect(versionQuery.whereIn).not.toHaveBeenCalled();
  });

  it('prefers the version effective on the transaction date', async () => {
    const { service, versionQuery } = build([
      { taxRateId: 1, rate: '16.5000', effectiveFrom: '2026-04-01' },
      { taxRateId: 1, rate: '15.0000', effectiveFrom: '2023-07-01' },
    ]);

    const result = await service.assocTaxRateFromTaxIdToEntries(
      entries(),
      new Date('2026-05-10T12:00:00Z'),
    );

    expect(result.map((e) => e.taxRate)).toEqual([16.5, 0, undefined]);
    expect(versionQuery.modify).toHaveBeenCalledWith(
      'effectiveOn',
      '2026-05-10',
    );
  });

  it('falls back to the tax rate when no version covers the date', async () => {
    const { service } = build([]);

    const result = await service.assocTaxRateFromTaxIdToEntries(
      entries(),
      '2020-01-01',
    );

    expect(result.map((e) => e.taxRate)).toEqual([15, 0, undefined]);
  });
});

describe('ItemEntriesTaxTransactions tax settings', () => {
  const items = [
    { id: 10, sellTaxRateId: 1, purchaseTaxRateId: 2 },
    { id: 11, sellTaxRateId: null, purchaseTaxRateId: null },
  ];

  const build = (settings: Record<string, unknown>) =>
    new ItemEntriesTaxTransactions(
      (() => ({})) as any,
      (() => ({})) as any,
      (() => ({})) as any,
      (() => ({
        query: () => ({ whereIn: jest.fn().mockResolvedValue(items) }),
      })) as any,
      { accessible: jest.fn().mockResolvedValue(true) } as any,
      { getTaxSettings: jest.fn().mockResolvedValue(settings) } as any,
    );

  describe('assocDefaultTaxRateFromItems', () => {
    const entries = () =>
      [
        { itemId: 10 },
        { itemId: 10, taxRateId: null },
        { itemId: 10, taxRateId: 3 },
        { itemId: 10, taxCode: 'X' },
        { itemId: 11 },
      ] as any[];

    it('leaves the lines alone while the setting is off', async () => {
      const service = build({ defaultFromItem: false });
      const result =
        await service.assocDefaultTaxRateFromItems('sell')(entries());
      expect(result).toEqual(entries());
    });

    it('fills only the lines that omit a tax rate', async () => {
      const service = build({ defaultFromItem: true });
      const result =
        await service.assocDefaultTaxRateFromItems('sell')(entries());
      expect(result.map((e) => e.taxRateId)).toEqual([
        1,
        null,
        3,
        undefined,
        undefined,
      ]);
    });

    it('uses the purchase rate for purchases', async () => {
      const service = build({ defaultFromItem: true });
      const [result] = await service.assocDefaultTaxRateFromItems('purchase')([
        { itemId: 10 } as any,
      ]);
      expect(result.taxRateId).toBe(2);
    });
  });

  describe('assocEntriesTaxAmounts', () => {
    const entries = () =>
      [
        { quantity: 1, rate: 100, discount: 10, taxRateId: 1, taxRate: 15 },
      ] as any[];

    it('clears the stored amounts while the setting is off', async () => {
      const service = build({ calcAfterDiscount: false });
      const [result] = await service.assocEntriesTaxAmounts(entries(), {});

      expect(result.taxableAmount).toBeNull();
      expect(result.lineTaxAmount).toBeNull();
    });

    it('stores the amounts after discounts while the setting is on', async () => {
      const service = build({ calcAfterDiscount: true });
      const [result] = await service.assocEntriesTaxAmounts(entries(), {});

      expect(result).toMatchObject({ taxableAmount: 90, lineTaxAmount: 13.5 });
    });
  });
});
