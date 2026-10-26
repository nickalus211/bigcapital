import { Inject, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { sumBy } from 'lodash';
import { ACCOUNT_TYPE } from '@/constants/accounts';
import { AccountingBasis } from '@/common/types/AccountingBasis';
import { Account } from '@/modules/Accounts/models/Account.model';
import { AccountTransaction } from '@/modules/Accounts/models/AccountTransaction.model';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import {
  getBalanceTrend,
  getMonthlyCashFlow,
  getSpendingByCategory,
  getWindowMonths,
  LedgerRow,
  roundToCents,
} from './DashboardInsights.utils';
import { DashboardInsightsResponseDto } from './DashboardInsights.dto';

const CASH_ACCOUNT_TYPES = [ACCOUNT_TYPE.CASH, ACCOUNT_TYPE.BANK];
const EXPENSE_ACCOUNT_TYPES = [
  ACCOUNT_TYPE.EXPENSE,
  ACCOUNT_TYPE.OTHER_EXPENSE,
  ACCOUNT_TYPE.COST_OF_GOODS_SOLD,
];

/**
 * Money in and out of the cash and bank accounts for the dashboard. Uses the
 * cash basis, so expenses count when they're paid.
 */
@Injectable()
export class DashboardInsightsService {
  constructor(
    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,

    @Inject(AccountTransaction.name)
    private readonly accountTransactionModel: TenantModelProxy<
      typeof AccountTransaction
    >,

    private readonly tenancyContext: TenancyContext,
  ) {}

  /**
   * Retrieves the dashboard insights of the last `months` months, including
   * the current one.
   * @param {number} months
   * @returns {Promise<DashboardInsightsResponseDto>}
   */
  public async getInsights(months = 12): Promise<DashboardInsightsResponseDto> {
    const fromDate = moment()
      .startOf('month')
      .subtract(months - 1, 'month');
    const toDate = moment().endOf('month');
    const windowMonths = getWindowMonths(fromDate, months);

    const accounts = await this.accountModel().query();
    const idsOf = (types: string[]) =>
      accounts.filter((a) => types.includes(a.accountType)).map((a) => a.id);
    const accountNames = Object.fromEntries(
      accounts.map((account) => [account.id, account.name]),
    );
    const cashAccountsIds = idsOf(CASH_ACCOUNT_TYPES);
    const expenseAccountsIds = idsOf(EXPENSE_ACCOUNT_TYPES);

    const [cashRows, expenseRows, openingCash, receivable, payable] =
      await Promise.all([
        this.getRows(cashAccountsIds, fromDate, toDate, AccountingBasis.Cash),
        this.getRows(
          expenseAccountsIds,
          fromDate,
          toDate,
          AccountingBasis.Cash,
        ),
        this.getNetBefore(cashAccountsIds, fromDate, AccountingBasis.Cash),
        this.getNetBefore(
          idsOf([ACCOUNT_TYPE.ACCOUNTS_RECEIVABLE]),
          null,
          AccountingBasis.Accrual,
        ),
        this.getNetBefore(
          idsOf([ACCOUNT_TYPE.ACCOUNTS_PAYABLE]),
          null,
          AccountingBasis.Accrual,
        ),
      ]);

    const monthly = getMonthlyCashFlow(cashRows, windowMonths);
    const balanceTrend = getBalanceTrend(openingCash, cashRows, windowMonths);
    const thisMonth = monthly[monthly.length - 1];
    const metadata = await this.tenancyContext.getTenantMetadata();

    return {
      currencyCode: (metadata as { baseCurrency?: string })?.baseCurrency,
      fromDate: fromDate.format('YYYY-MM-DD'),
      toDate: toDate.format('YYYY-MM-DD'),
      summary: {
        received: thisMonth.received,
        spent: thisMonth.spent,
        net: thisMonth.net,
        cashBalance: balanceTrend[balanceTrend.length - 1].balance,
        receivable: roundToCents(receivable),
        payable: roundToCents(-payable),
        totalReceived: roundToCents(sumBy(monthly, 'received')),
        totalSpent: roundToCents(sumBy(monthly, 'spent')),
      },
      monthly,
      balanceTrend,
      spendingByCategory: getSpendingByCategory(expenseRows, accountNames),
    };
  }

  /**
   * Retrieves the ledger rows of the given accounts within the dates.
   */
  private async getRows(
    accountsIds: number[],
    fromDate: moment.Moment,
    toDate: moment.Moment,
    basis: AccountingBasis,
  ): Promise<LedgerRow[]> {
    if (accountsIds.length === 0) return [];

    const rows = await this.accountTransactionModel()
      .query()
      .whereIn('accountId', accountsIds)
      .modify('filterDateRange', fromDate, toDate)
      .modify('filterByBasis', basis)
      .select([
        'date',
        'debit',
        'credit',
        'referenceType',
        'referenceId',
        'accountId',
      ]);
    return rows as unknown as LedgerRow[];
  }

  /**
   * Retrieves the net (debit − credit) of the given accounts before the
   * date, or of all time without a date.
   */
  private async getNetBefore(
    accountsIds: number[],
    beforeDate: moment.Moment | null,
    basis: AccountingBasis,
  ): Promise<number> {
    if (accountsIds.length === 0) return 0;

    const query = this.accountTransactionModel()
      .query()
      .whereIn('accountId', accountsIds)
      .modify('filterByBasis', basis)
      .sum('debit as debit')
      .sum('credit as credit');

    if (beforeDate) {
      query.where('date', '<', beforeDate.format('YYYY-MM-DD'));
    }
    const [totals] = (await query) as unknown as Array<{
      debit: number;
      credit: number;
    }>;
    return Number(totals?.debit || 0) - Number(totals?.credit || 0);
  }
}
