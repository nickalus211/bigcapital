import * as moment from 'moment';
import {
  getBalanceTrend,
  getMonthlyCashFlow,
  getSpendingByCategory,
  getWindowMonths,
  LedgerRow,
} from './DashboardInsights.utils';

const row = (attrs: Partial<LedgerRow>): LedgerRow => ({
  date: '2026-09-10',
  debit: 0,
  credit: 0,
  referenceType: 'PaymentReceive',
  referenceId: 1,
  accountId: 1,
  ...attrs,
});

describe('Dashboard insights', () => {
  const months = getWindowMonths(moment('2026-08-01'), 3);

  it('lists the window months oldest first', () => {
    expect(months).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('counts money in and out per month', () => {
    const result = getMonthlyCashFlow(
      [
        row({ debit: 1000, referenceId: 1 }),
        row({ credit: 300, referenceType: 'Expense', referenceId: 2 }),
        row({ date: '2026-10-02', debit: 500, referenceId: 3 }),
      ],
      months,
    );
    expect(result).toEqual([
      { month: '2026-08', received: 0, spent: 0, net: 0 },
      { month: '2026-09', received: 1000, spent: 300, net: 700 },
      { month: '2026-10', received: 500, spent: 0, net: 500 },
    ]);
  });

  it('cancels out transfers between your own cash and bank accounts', () => {
    const transfer = { referenceType: 'CashflowTransaction', referenceId: 9 };
    const result = getMonthlyCashFlow(
      [
        row({ ...transfer, accountId: 1, credit: 2000 }),
        row({ ...transfer, accountId: 2, debit: 2000 }),
      ],
      months,
    );
    expect(result[1]).toEqual({
      month: '2026-09',
      received: 0,
      spent: 0,
      net: 0,
    });
  });

  it('ignores opening balances in money in, but not in the balance', () => {
    const rows = [
      row({ referenceType: 'OpeningBalance', debit: 5000, date: '2026-08-01' }),
      row({ debit: 100 }),
    ];
    expect(getMonthlyCashFlow(rows, months)[0].received).toBe(0);
    expect(getBalanceTrend(1000, rows, months)).toEqual([
      { month: '2026-08', balance: 6000 },
      { month: '2026-09', balance: 6100 },
      { month: '2026-10', balance: 6100 },
    ]);
  });

  it('ranks spending by category and groups the rest as Other', () => {
    const rows = [
      row({ accountId: 10, debit: 300 }),
      row({ accountId: 11, debit: 500 }),
      row({ accountId: 12, debit: 100 }),
      row({ accountId: 13, debit: 50, credit: 50 }),
    ];
    expect(
      getSpendingByCategory(rows, { 10: 'Rent', 11: 'Stock', 12: 'Fuel' }, 2),
    ).toEqual([
      { accountId: 11, name: 'Stock', amount: 500 },
      { accountId: 10, name: 'Rent', amount: 300 },
      { accountId: null, name: 'Other', amount: 100 },
    ]);
  });
});
