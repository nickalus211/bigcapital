export interface JamaicaAccountSeed {
  slug: string;
  name: string;
  accountType: string;
  code: string;
  description: string;
}

export const GCT_INPUT_TAX_SLUG = 'gct-input-tax';
export const TAX_PAYABLE_SLUG = 'tax-payable';

/**
 * Accounts added to the chart of accounts for a Jamaican sole trader.
 * An account code already used by another account is left empty.
 */
export const JAMAICA_ACCOUNTS: JamaicaAccountSeed[] = [
  {
    slug: GCT_INPUT_TAX_SLUG,
    name: 'GCT Input Tax',
    accountType: 'other-current-asset',
    code: '10011',
    description: 'Recoverable GCT paid on purchases and expenses.',
  },
  {
    slug: 'wht-receivable',
    name: 'Withholding Tax Receivable',
    accountType: 'other-current-asset',
    code: '10012',
    description:
      'Tax withheld by customers on specified services, claimable against income tax.',
  },
  {
    slug: 'taj-penalties-interest',
    name: 'TAJ Penalties & Interest',
    accountType: 'other-expense',
    code: '40012',
    description:
      'Tax penalties, surcharges and interest. Not deductible for income tax.',
  },
  {
    slug: 'entertainment-disallowed',
    name: 'Entertainment (Disallowed)',
    accountType: 'expense',
    code: '40013',
    description: 'Business entertainment. Not deductible for income tax.',
  },
];

/**
 * Renames applied only while the account keeps its default name.
 */
export const JAMAICA_ACCOUNT_RENAMES = [
  {
    slug: TAX_PAYABLE_SLUG,
    from: 'Tax Payable',
    to: 'GCT Payable (Output Tax)',
  },
  { slug: 'owner-equity', from: "Owner's Equity", to: "Owner's Capital" },
];
