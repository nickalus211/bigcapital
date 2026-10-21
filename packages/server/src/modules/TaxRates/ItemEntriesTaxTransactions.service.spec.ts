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
      { accessible: jest.fn().mockResolvedValue(true) } as any,
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
