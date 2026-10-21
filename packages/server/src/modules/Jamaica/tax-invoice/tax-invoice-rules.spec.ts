import {
  formatTrn,
  getTaxInvoiceWarnings,
  isValidTrn,
  TaxInvoiceWarningCode as Code,
} from './tax-invoice-rules';

const registered = {
  gctRegistered: true,
  trn: '123-456-789',
  gctRegistrationNumber: 'GCT-1',
  hasAddress: true,
};

const compliantInvoice = () => ({
  customer: {
    contactType: 'business',
    taxNumber: '987654321',
    billingAddress1: '1 King St',
  },
  entries: [
    { taxRateId: 1, taxAmount: 15, tax: { taxType: 'standard' } },
    { taxRateId: 2, taxAmount: 0, tax: { taxType: 'exempt' } },
  ],
});

const codes = (warnings) => warnings.map((w) => w.code);

describe('tax-invoice-rules', () => {
  it('validates and formats TRNs', () => {
    expect(isValidTrn('123-456-789')).toBe(true);
    expect(isValidTrn('123 456 789')).toBe(true);
    expect(isValidTrn('12345678')).toBe(false);
    expect(formatTrn('123456789')).toBe('123-456-789');
    expect(formatTrn('ABC')).toBe('ABC');
  });

  it('reports nothing for a compliant tax invoice', () => {
    expect(getTaxInvoiceWarnings(registered, compliantInvoice())).toEqual([]);
  });

  it('reports the missing supplier details', () => {
    const warnings = getTaxInvoiceWarnings(
      { gctRegistered: true, hasAddress: false },
      compliantInvoice(),
    );
    expect(codes(warnings)).toEqual([
      Code.OrganizationTrnMissing,
      Code.OrganizationAddressMissing,
      Code.GctRegistrationNumberMissing,
    ]);
  });

  it('reports an invalid organization TRN', () => {
    const warnings = getTaxInvoiceWarnings(
      { ...registered, trn: '12-34' },
      compliantInvoice(),
    );
    expect(codes(warnings)).toEqual([Code.OrganizationTrnInvalid]);
  });

  it('requires a TRN for business customers only', () => {
    const invoice = compliantInvoice();
    invoice.customer.taxNumber = null;
    expect(codes(getTaxInvoiceWarnings(registered, invoice))).toEqual([
      Code.CustomerTrnMissing,
    ]);

    invoice.customer.contactType = 'individual';
    expect(getTaxInvoiceWarnings(registered, invoice)).toEqual([]);
  });

  it('lists the lines without a rate or a tax type', () => {
    const invoice = compliantInvoice();
    invoice.entries.push(
      { taxRateId: null, taxAmount: 0, tax: null },
      { taxRateId: 3, taxAmount: 5, tax: { taxType: null } },
    );
    const warnings = getTaxInvoiceWarnings(registered, invoice);

    expect(warnings).toEqual([
      expect.objectContaining({ code: Code.LineTaxRateMissing, lines: [3] }),
      expect.objectContaining({
        code: Code.LineTaxTypeUnclassified,
        lines: [4],
      }),
    ]);
  });

  it('only checks that an unregistered organization charges no GCT', () => {
    const unregistered = { gctRegistered: false, hasAddress: false };

    expect(
      codes(getTaxInvoiceWarnings(unregistered, compliantInvoice())),
    ).toEqual([Code.GctChargedNotRegistered]);

    const untaxed = compliantInvoice();
    untaxed.entries.forEach((entry) => (entry.taxAmount = 0));
    expect(getTaxInvoiceWarnings(unregistered, untaxed)).toEqual([]);
  });
});
