export const ERRORS = {
  TAX_RATE_NOT_FOUND: 'TAX_RATE_NOT_FOUND',
  TAX_CODE_NOT_UNIQUE: 'TAX_CODE_NOT_UNIQUE',
  ITEM_ENTRY_TAX_RATE_CODE_NOT_FOUND: 'ITEM_ENTRY_TAX_RATE_CODE_NOT_FOUND',
  ITEM_ENTRY_TAX_RATE_ID_NOT_FOUND: 'ITEM_ENTRY_TAX_RATE_ID_NOT_FOUND',
  TAX_RATE_ALREADY_ACTIVE: 'TAX_RATE_ALREADY_ACTIVE',
  TAX_RATE_ALREADY_INACTIVE: 'TAX_RATE_ALREADY_INACTIVE',
  SALES_TAX_FEATURE_NOT_ENABLED: 'SALES_TAX_FEATURE_NOT_ENABLED',
};

/**
 * Tax types of a tax rate. NULL (unclassified) keeps the legacy behavior.
 */
export enum TaxType {
  Standard = 'standard',
  ZeroRated = 'zero_rated',
  Exempt = 'exempt',
  OutOfScope = 'out_of_scope',
}

export const TAX_TYPES = Object.values(TaxType);
