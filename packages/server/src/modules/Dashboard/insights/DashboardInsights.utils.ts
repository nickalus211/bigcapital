import * as moment from 'moment';
import { groupBy, orderBy, sumBy } from 'lodash';

/**
 * Rounds the given amount to cents.
 * @param {number} amount
 * @returns {number}
 */
export const roundToCents = (amount: number) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

export interface LedgerRow {
  date: string | Date;
  debit: number;
  credit: number;
  referenceType: string;
  referenceId: number | string;
  accountId: number;
}

export interface MonthlyCashFlow {
  month: string;
  received: number;
  spent: number;
  net: number;
}

export interface BalancePoint {
  month: string;
  balance: number;
}

export interface CategoryAmount {
  accountId: number | null;
  name: string;
  amount: number;
}

/**
 * Opening balances move money onto the books, not in or out of the bank.
 */
const isOpeningBalance = (referenceType: string) =>
  /OpeningBalance$/i.test(referenceType || '');

/**
 * The months of the window, oldest first, as `YYYY-MM`.
 * @param {moment.Moment} from
 * @param {number} months
 * @returns {string[]}
 */
export const getWindowMonths = (from: moment.Moment, months: number) =>
  Array.from({ length: months }, (_, i) =>
    from.clone().add(i, 'month').format('YYYY-MM'),
  );

/**
 * Money received and spent per month from the cash and bank account rows.
 * Rows are netted per transaction and month, so transfers between your own
 * cash and bank accounts cancel out instead of counting as both.
 * @param {LedgerRow[]} rows - Cash and bank account rows in the window.
 * @param {string[]} months
 * @returns {MonthlyCashFlow[]}
 */
export const getMonthlyCashFlow = (
  rows: LedgerRow[],
  months: string[],
): MonthlyCashFlow[] => {
  const byMonth = Object.fromEntries(
    months.map((month) => [month, { received: 0, spent: 0 }]),
  );
  const groups = groupBy(
    rows.filter((row) => !isOpeningBalance(row.referenceType)),
    (row) =>
      `${moment(row.date).format('YYYY-MM')}|${row.referenceType}|${row.referenceId}`,
  );
  Object.entries(groups).forEach(([key, groupRows]) => {
    const month = key.split('|')[0];
    const net = sumBy(groupRows, (r) => Number(r.debit) - Number(r.credit));

    if (!byMonth[month]) return;
    if (net > 0) byMonth[month].received += net;
    if (net < 0) byMonth[month].spent += -net;
  });
  return months.map((month) => {
    const { received, spent } = byMonth[month];
    return {
      month,
      received: roundToCents(received),
      spent: roundToCents(spent),
      net: roundToCents(received - spent),
    };
  });
};

/**
 * The total cash and bank balance at the end of each month.
 * @param {number} openingBalance - The balance before the window.
 * @param {LedgerRow[]} rows - Cash and bank account rows in the window.
 * @param {string[]} months
 * @returns {BalancePoint[]}
 */
export const getBalanceTrend = (
  openingBalance: number,
  rows: LedgerRow[],
  months: string[],
): BalancePoint[] => {
  const netByMonth = groupBy(rows, (row) => moment(row.date).format('YYYY-MM'));
  let balance = openingBalance;

  return months.map((month) => {
    balance += sumBy(
      netByMonth[month] || [],
      (r) => Number(r.debit) - Number(r.credit),
    );
    return { month, balance: roundToCents(balance) };
  });
};

/**
 * Spending per expense account, largest first; the rest is grouped as
 * "Other".
 * @param {LedgerRow[]} rows - Expense account rows in the window.
 * @param {Record<number, string>} accountNames
 * @param {number} limit
 * @returns {CategoryAmount[]}
 */
export const getSpendingByCategory = (
  rows: LedgerRow[],
  accountNames: Record<number, string>,
  limit = 7,
): CategoryAmount[] => {
  const byAccount = groupBy(rows, 'accountId');
  const categories = orderBy(
    Object.entries(byAccount)
      .map(([accountId, accountRows]) => ({
        accountId: Number(accountId),
        name: accountNames[accountId] || `Account ${accountId}`,
        amount: roundToCents(
          sumBy(accountRows, (r) => Number(r.debit) - Number(r.credit)),
        ),
      }))
      .filter((category) => category.amount > 0),
    ['amount'],
    ['desc'],
  );
  if (categories.length <= limit) return categories;

  const others = categories.slice(limit);
  return [
    ...categories.slice(0, limit),
    {
      accountId: null,
      name: 'Other',
      amount: roundToCents(sumBy(others, 'amount')),
    },
  ];
};
