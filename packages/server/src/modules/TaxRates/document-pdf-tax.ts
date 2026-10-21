import { formatNumber } from '@/utils/format-number';

interface TaxedDocument {
  currencyCode?: string;
  taxAmountWithheld?: number | null;
  totalFormatted?: string;
  taxes?: Array<{
    name: string;
    taxRate: number;
    taxRateAmountFormatted: string;
  }>;
  entries?: Array<{
    item?: { name?: string };
    description?: string;
    rateFormatted?: string;
    quantityFormatted?: string;
    subtotalExcludingTax?: number;
    discountAmount?: number;
  }>;
}

/**
 * PDF attributes of a taxed sale receipt, credit note or estimate
 * (`tax.extended_documents`): the tax lines, the total with tax, and line
 * amounts without tax so the lines add up to the subtotal. Untaxed documents
 * get nothing, and keep the upstream PDF.
 * @param {TaxedDocument} document - The transformed document.
 * @returns {Record<string, any>}
 */
export const getDocumentPdfTaxAttributes = (document: TaxedDocument) => {
  if (
    document.taxAmountWithheld === null ||
    document.taxAmountWithheld === undefined
  ) {
    return {};
  }
  return {
    total: document.totalFormatted,
    taxes: (document.taxes || []).map((tax) => ({
      label: `${tax.name} (${Number(tax.taxRate)}%)`,
      amount: tax.taxRateAmountFormatted,
    })),
    lines: (document.entries || []).map((entry) => ({
      item: entry.item?.name,
      description: entry.description,
      rate: entry.rateFormatted,
      quantity: entry.quantityFormatted,
      total: formatNumber(
        (entry.subtotalExcludingTax || 0) - (entry.discountAmount || 0),
        { currencyCode: document.currencyCode, money: false },
      ),
    })),
  };
};
