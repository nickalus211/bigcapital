import { calcWhtSummary } from './wht-summary.calculator';

const customers = [
  { id: 1, displayName: 'Beta Ltd', taxNumber: '111222333' },
  { id: 2, displayName: 'Alpha Ltd', taxNumber: null },
  { id: 3, displayName: 'Gamma Ltd' },
];

describe('calcWhtSummary', () => {
  it('compares withheld tax with certificates per customer', () => {
    const result = calcWhtSummary(
      [
        { customerId: 1, withheldAmount: 30 },
        { customerId: 1, withheldAmount: 15.5 },
        { customerId: 2, withheldAmount: 60 },
      ],
      [
        { customerId: 1, amount: 45.5 },
        { customerId: 2, amount: 40 },
        { customerId: 3, amount: 10 },
      ],
      customers,
    );
    expect(result.customers.map((row) => row.customerName)).toEqual([
      'Alpha Ltd',
      'Beta Ltd',
      'Gamma Ltd',
    ]);
    expect(result.customers[0]).toEqual({
      customerId: 2,
      customerName: 'Alpha Ltd',
      customerTaxNumber: null,
      paymentsCount: 1,
      certificatesCount: 1,
      withheldAmount: 60,
      certifiedAmount: 40,
      differenceAmount: 20,
      status: 'missing',
    });
    expect(result.customers[1]).toMatchObject({
      customerTaxNumber: '111222333',
      paymentsCount: 2,
      withheldAmount: 45.5,
      differenceAmount: 0,
      status: 'certified',
    });
    expect(result.customers[2]).toMatchObject({
      paymentsCount: 0,
      certifiedAmount: 10,
      differenceAmount: -10,
      status: 'over_certified',
    });
    expect(result.totals).toEqual({
      withheldAmount: 105.5,
      certifiedAmount: 95.5,
      uncertifiedAmount: 20,
    });
    expect(result.s04).toEqual({ line: 'F24', creditAmount: 95.5 });
  });

  it('claims nothing without certificates', () => {
    const result = calcWhtSummary(
      [{ customerId: 1, withheldAmount: 0.1 + 0.2 }],
      [],
      customers,
    );
    expect(result.totals).toEqual({
      withheldAmount: 0.3,
      certifiedAmount: 0,
      uncertifiedAmount: 0.3,
    });
    expect(result.s04.creditAmount).toBe(0);
  });

  it('is empty for a year with no withholding', () => {
    const result = calcWhtSummary([], [], customers);
    expect(result.customers).toEqual([]);
    expect(result.totals.withheldAmount).toBe(0);
  });
});
