/**
 * Section 29 of the General Consumption Tax Act: what a Tax Invoice must
 * carry. These rules only report what is missing. They never block a
 * request; the API returns them as `compliance_warnings`.
 */

export enum TaxInvoiceWarningCode {
  OrganizationTrnMissing = 'ORGANIZATION_TRN_MISSING',
  OrganizationTrnInvalid = 'ORGANIZATION_TRN_INVALID',
  OrganizationAddressMissing = 'ORGANIZATION_ADDRESS_MISSING',
  GctRegistrationNumberMissing = 'GCT_REGISTRATION_NUMBER_MISSING',
  CustomerAddressMissing = 'CUSTOMER_ADDRESS_MISSING',
  CustomerTrnMissing = 'CUSTOMER_TRN_MISSING',
  CustomerTrnInvalid = 'CUSTOMER_TRN_INVALID',
  LineTaxRateMissing = 'LINE_TAX_RATE_MISSING',
  LineTaxTypeUnclassified = 'LINE_TAX_TYPE_UNCLASSIFIED',
  GctChargedNotRegistered = 'GCT_CHARGED_NOT_REGISTERED',
}

export interface TaxInvoiceWarning {
  code: TaxInvoiceWarningCode;
  message: string;
  /** 1-based line numbers the warning applies to, when it is about lines. */
  lines?: number[];
}

export interface TaxInvoiceOrganization {
  /** Jamaica localization on and registered for GCT. */
  gctRegistered: boolean;
  trn?: string | null;
  gctRegistrationNumber?: string | null;
  hasAddress: boolean;
}

export interface TaxInvoiceDocument {
  customer?: {
    contactType?: string;
    taxNumber?: string | null;
    billingAddress1?: string | null;
  } | null;
  entries: Array<{
    taxRateId?: number | null;
    taxAmount?: number | null;
    tax?: { taxType?: string | null } | null;
  }>;
}

/**
 * A Jamaican TRN has nine digits; it is often written 123-456-789.
 * @param {string} trn
 * @returns {boolean}
 */
export const isValidTrn = (trn: string): boolean =>
  /^\d{9}$/.test(trn.replace(/[\s-]/g, ''));

/**
 * Formats a TRN as 123-456-789, or returns it unchanged when it isn't one.
 * @param {string} trn
 * @returns {string}
 */
export const formatTrn = (trn: string): string => {
  const digits = trn.replace(/[\s-]/g, '');
  return /^\d{9}$/.test(digits)
    ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    : trn;
};

const lineNumbers = (
  entries: TaxInvoiceDocument['entries'],
  predicate: (entry: TaxInvoiceDocument['entries'][number]) => boolean,
) =>
  entries.reduce<number[]>(
    (acc, entry, index) => (predicate(entry) ? [...acc, index + 1] : acc),
    [],
  );

/**
 * Retrieves what the invoice is missing to be a valid Tax Invoice. For an
 * organization not registered for GCT, the only check is that it doesn't
 * charge GCT.
 * @param {TaxInvoiceOrganization} organization
 * @param {TaxInvoiceDocument} invoice
 * @returns {TaxInvoiceWarning[]}
 */
export const getTaxInvoiceWarnings = (
  organization: TaxInvoiceOrganization,
  invoice: TaxInvoiceDocument,
): TaxInvoiceWarning[] => {
  const warnings: TaxInvoiceWarning[] = [];
  const add = (
    code: TaxInvoiceWarningCode,
    message: string,
    lines?: number[],
  ) => warnings.push({ code, message, ...(lines?.length ? { lines } : {}) });

  if (!organization.gctRegistered) {
    const charged = invoice.entries.some((entry) => (entry.taxAmount || 0) > 0);
    if (charged) {
      add(
        TaxInvoiceWarningCode.GctChargedNotRegistered,
        'GCT is charged, but the organization is not registered for GCT.',
      );
    }
    return warnings;
  }

  // Supplier.
  if (!organization.trn) {
    add(
      TaxInvoiceWarningCode.OrganizationTrnMissing,
      "The organization's TRN is missing.",
    );
  } else if (!isValidTrn(organization.trn)) {
    add(
      TaxInvoiceWarningCode.OrganizationTrnInvalid,
      "The organization's TRN must have nine digits.",
    );
  }
  if (!organization.hasAddress) {
    add(
      TaxInvoiceWarningCode.OrganizationAddressMissing,
      "The organization's address is missing.",
    );
  }
  if (!organization.gctRegistrationNumber) {
    add(
      TaxInvoiceWarningCode.GctRegistrationNumberMissing,
      'The GCT registration number is missing.',
    );
  }

  // Recipient.
  const customer = invoice.customer;
  if (!customer?.billingAddress1) {
    add(
      TaxInvoiceWarningCode.CustomerAddressMissing,
      "The customer's billing address is missing.",
    );
  }
  if (customer?.taxNumber) {
    if (!isValidTrn(customer.taxNumber)) {
      add(
        TaxInvoiceWarningCode.CustomerTrnInvalid,
        "The customer's TRN must have nine digits.",
      );
    }
  } else if (customer?.contactType === 'business') {
    add(
      TaxInvoiceWarningCode.CustomerTrnMissing,
      'The customer is a business but has no TRN.',
    );
  }

  // Lines: every supply must show its GCT rate.
  const withoutRate = lineNumbers(invoice.entries, (e) => !e.taxRateId);
  if (withoutRate.length) {
    add(
      TaxInvoiceWarningCode.LineTaxRateMissing,
      'Some lines have no GCT rate. Use the zero-rated or exempt rate where no GCT applies.',
      withoutRate,
    );
  }
  const unclassified = lineNumbers(
    invoice.entries,
    (e) => !!e.taxRateId && !e.tax?.taxType,
  );
  if (unclassified.length) {
    add(
      TaxInvoiceWarningCode.LineTaxTypeUnclassified,
      'Some lines use a tax rate with no tax type (standard, zero-rated, exempt or out of scope).',
      unclassified,
    );
  }
  return warnings;
};
