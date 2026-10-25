import {
  JAMAICA_JURISDICTION,
  SEED_EFFECTIVE_FROM,
  UNVERIFIED_SOURCE_NOTE,
} from './gct-rates';

export interface TaxParameterSeed {
  jurisdiction: string;
  key: string;
  value: unknown;
  effectiveFrom: string;
  effectiveTo?: string | null;
  sourceNote: string;
}

/**
 * GCT, withholding tax and customs parameters (rates in %). Income tax, NIS, NHT and Education Tax parameters are
 * added with the S04 engine (M8).
 */
export const JAMAICA_TAX_PARAMETERS: TaxParameterSeed[] = [
  {
    jurisdiction: JAMAICA_JURISDICTION,
    key: 'gct.registration_threshold',
    value: 10000000,
    effectiveFrom: SEED_EFFECTIVE_FROM,
    effectiveTo: '2025-03-31',
    sourceNote: UNVERIFIED_SOURCE_NOTE,
  },
  {
    jurisdiction: JAMAICA_JURISDICTION,
    key: 'gct.registration_threshold',
    value: 15000000,
    effectiveFrom: '2025-04-01',
    sourceNote: UNVERIFIED_SOURCE_NOTE,
  },
  {
    jurisdiction: JAMAICA_JURISDICTION,
    key: 'gct.registration_alert_ratio',
    value: 0.8,
    effectiveFrom: SEED_EFFECTIVE_FROM,
    sourceNote:
      'Product choice: alert at 80% of the threshold (requirements document).',
  },
  {
    jurisdiction: JAMAICA_JURISDICTION,
    key: 'gct.return_due',
    value: { rule: 'last_working_day_of_following_month' },
    effectiveFrom: SEED_EFFECTIVE_FROM,
    sourceNote: UNVERIFIED_SOURCE_NOTE,
  },
  {
    jurisdiction: JAMAICA_JURISDICTION,
    key: 'wht.specified_services_rate',
    value: 3,
    effectiveFrom: SEED_EFFECTIVE_FROM,
    sourceNote: UNVERIFIED_SOURCE_NOTE,
  },
  {
    jurisdiction: JAMAICA_JURISDICTION,
    key: 'customs.scf_rate',
    value: 0.3,
    effectiveFrom: SEED_EFFECTIVE_FROM,
    sourceNote: UNVERIFIED_SOURCE_NOTE,
  },
  {
    jurisdiction: JAMAICA_JURISDICTION,
    key: 'customs.epl_rate',
    value: 0.5,
    effectiveFrom: SEED_EFFECTIVE_FROM,
    sourceNote: UNVERIFIED_SOURCE_NOTE,
  },
  {
    jurisdiction: JAMAICA_JURISDICTION,
    key: 'customs.import_gct_rate',
    value: 15,
    effectiveFrom: SEED_EFFECTIVE_FROM,
    sourceNote: UNVERIFIED_SOURCE_NOTE,
  },
  {
    jurisdiction: JAMAICA_JURISDICTION,
    key: 'customs.advance_gct_rate',
    value: 5,
    effectiveFrom: SEED_EFFECTIVE_FROM,
    sourceNote: UNVERIFIED_SOURCE_NOTE,
  },
];
