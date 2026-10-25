export interface JamaicaAccountSeed {
  slug: string;
  name: string;
  accountType: string;
  code: string;
  description: string;
}

export const GCT_INPUT_TAX_SLUG = 'gct-input-tax';
export const TAX_PAYABLE_SLUG = 'tax-payable';
export const WHT_RECEIVABLE_SLUG = 'wht-receivable';
export const ADVANCE_GCT_SLUG = 'advance-gct';
export const CUSTOMS_DUTIES_SLUG = 'customs-duties';

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
    slug: WHT_RECEIVABLE_SLUG,
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
  {
    slug: ADVANCE_GCT_SLUG,
    name: 'Advance GCT',
    accountType: 'other-current-asset',
    code: '10013',
    description:
      'GCT paid in advance at customs on commercial imports, credited on the GCT return.',
  },
  {
    slug: CUSTOMS_DUTIES_SLUG,
    name: 'Customs Duties & Fees',
    accountType: 'cost-of-goods-sold',
    code: '40014',
    description:
      'Customs duty, SCF, EPL, ASD, SCT and CAF on imports. Moved into inventory cost when allocated to a bill.',
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
