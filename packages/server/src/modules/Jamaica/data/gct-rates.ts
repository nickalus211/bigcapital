import { TaxType } from '@/modules/TaxRates/constants';

export const JAMAICA_JURISDICTION = 'JM';

/**
 * Note on every seeded value: the figures come from the requirements
 * document and are NOT verified. An accountant must confirm them against
 * current TAJ guidance and mark the rows `verified`.
 */
export const UNVERIFIED_SOURCE_NOTE =
  'Seeded from the requirements document; verify against TAJ guidance.';

/**
 * The effective date of the seeded rate versions. The historical dates of
 * GCT rate changes were not researched, so the seeded version covers all
 * dates; add dated versions for historical changes as needed.
 */
export const SEED_EFFECTIVE_FROM = '2000-01-01';

export interface JamaicaTaxRateSeed {
  code: string;
  name: string;
  rate: number;
  taxType: TaxType;
  active: boolean;
  description: string;
}

/**
 * General Consumption Tax (GCT) rates.
 */
export const JAMAICA_GCT_RATES: JamaicaTaxRateSeed[] = [
  {
    code: 'GCT-STD',
    name: 'GCT Standard',
    rate: 15,
    taxType: TaxType.Standard,
    active: true,
    description: 'Standard-rated supplies.',
  },
  {
    code: 'GCT-ZERO',
    name: 'GCT Zero-rated',
    rate: 0,
    taxType: TaxType.ZeroRated,
    active: true,
    description:
      'Zero-rated supplies (e.g. exports, certain basic foods). Input tax remains claimable.',
  },
  {
    code: 'GCT-EXEMPT',
    name: 'GCT Exempt',
    rate: 0,
    taxType: TaxType.Exempt,
    active: true,
    description:
      'Exempt supplies (e.g. residential rent, certain medical and financial services). Related input tax is not claimable.',
  },
  {
    code: 'GCT-OOS',
    name: 'Out of scope',
    rate: 0,
    taxType: TaxType.OutOfScope,
    active: true,
    description: 'Transactions outside the scope of GCT.',
  },
  {
    code: 'GCT-TEL',
    name: 'GCT Telecommunications',
    rate: 25,
    taxType: TaxType.Standard,
    active: false,
    description: 'Telecommunications services.',
  },
  {
    code: 'GCT-TOUR',
    name: 'GCT Tourism',
    rate: 10,
    taxType: TaxType.Standard,
    active: false,
    description: 'Certain tourism activities.',
  },
];
