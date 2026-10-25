import { Inject, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { sumBy, uniq } from 'lodash';
import { SETTINGS_PROVIDER } from '@/modules/Settings/Settings.types';
import { SettingsStore } from '@/modules/Settings/SettingsStore';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { SaleInvoice } from '@/modules/SaleInvoices/models/SaleInvoice';
import { SaleReceipt } from '@/modules/SaleReceipts/models/SaleReceipt';
import { CreditNote } from '@/modules/CreditNotes/models/CreditNote';
import { Bill } from '@/modules/Bills/models/Bill';
import { VendorCredit } from '@/modules/VendorCredit/models/VendorCredit';
import { Expense } from '@/modules/Expenses/models/Expense.model';
import { TaxRateModel } from '@/modules/TaxRates/models/TaxRate.model';
import { TaxRateVersion } from '@/modules/TaxRates/models/TaxRateVersion.model';
import { ItemEntry } from '@/modules/TransactionItemEntry/models/ItemEntry';
import { CustomsEntry } from '../customs/models/CustomsEntry.model';
import {
  calcGctReturn,
  getGctReturnDueDate,
  GctLineSide,
  GctReturnLine,
  GctReturnResult,
} from './gct-return.calculator';

export interface GctReturnQuery {
  fromDate?: string;
  toDate?: string;
}

export interface GctReturnWarning {
  code: string;
  message: string;
}

export interface GctReturnResponse extends GctReturnResult {
  fromDate: string;
  toDate: string;
  dueDate: string;
  currencyCode: string;
  organization: {
    name: string;
    trn: string | null;
    gctRegistered: boolean;
    gctRegistrationNumber: string | null;
  };
  documents: Record<string, number>;
  warnings: GctReturnWarning[];
}

/** Documents whose tax lives on item entries. */
interface ItemDocument {
  exchangeRate: number;
  discountAmount: number;
  taxAmountWithheld?: number | null;
  entries?: ItemEntry[];
}

const finite = (value: number) => (Number.isFinite(value) ? value : 0);

/**
 * The GCT return (Form 4A style) for a period, from the documents dated in
 * it: delivered invoices, closed receipts, opened credit notes, bills and
 * vendor credits, and published expenses. Accrual basis.
 */
@Injectable()
export class GctReturnService {
  constructor(
    @Inject(SETTINGS_PROVIDER)
    private readonly settings: () => Promise<SettingsStore>,
    private readonly tenancyContext: TenancyContext,

    @Inject(SaleInvoice.name)
    private readonly saleInvoiceModel: TenantModelProxy<typeof SaleInvoice>,
    @Inject(SaleReceipt.name)
    private readonly saleReceiptModel: TenantModelProxy<typeof SaleReceipt>,
    @Inject(CreditNote.name)
    private readonly creditNoteModel: TenantModelProxy<typeof CreditNote>,
    @Inject(Bill.name)
    private readonly billModel: TenantModelProxy<typeof Bill>,
    @Inject(VendorCredit.name)
    private readonly vendorCreditModel: TenantModelProxy<typeof VendorCredit>,
    @Inject(Expense.name)
    private readonly expenseModel: TenantModelProxy<typeof Expense>,
    @Inject(TaxRateModel.name)
    private readonly taxRateModel: TenantModelProxy<typeof TaxRateModel>,
    @Inject(TaxRateVersion.name)
    private readonly taxRateVersionModel: TenantModelProxy<
      typeof TaxRateVersion
    >,
    @Inject(CustomsEntry.name)
    private readonly customsEntryModel: TenantModelProxy<typeof CustomsEntry>,
  ) {}

  /**
   * The previous calendar month, the usual monthly filing period.
   * @returns {{ fromDate: string; toDate: string }}
   */
  private defaultPeriod() {
    const lastMonth = moment().subtract(1, 'month');
    return {
      fromDate: lastMonth.clone().startOf('month').format('YYYY-MM-DD'),
      toDate: lastMonth.clone().endOf('month').format('YYYY-MM-DD'),
    };
  }

  /**
   * Retrieves the GCT return of the given period.
   * @param {GctReturnQuery} query
   * @returns {Promise<GctReturnResponse>}
   */
  public async getGctReturn(query: GctReturnQuery): Promise<GctReturnResponse> {
    const defaults = this.defaultPeriod();
    const fromDate = moment(query.fromDate || defaults.fromDate).format(
      'YYYY-MM-DD',
    );
    const toDate = moment(query.toDate || defaults.toDate).format('YYYY-MM-DD');

    const [settings, metadata, taxRates] = await Promise.all([
      this.settings(),
      this.tenancyContext.getTenantMetadata(),
      this.taxRateModel().query(),
    ]);
    const get = (key: string) => settings.get({ group: 'jamaica', key }, null);
    const gctRegistered = !!get('gct_registered');
    const apportionmentEnabled = !!get('apportionment_enabled');

    const { lines, documents } = await this.loadLines(fromDate, toDate);
    const customsEntries = await this.customsEntryModel()
      .query()
      .whereBetween('entryDate', [fromDate, toDate]);
    const result = calcGctReturn(
      lines,
      taxRates.map((rate) => ({
        id: rate.id,
        code: rate.code,
        name: rate.name,
        rate: Number(rate.rate),
        taxType: rate.taxType ?? null,
      })),
      { apportionmentEnabled },
      {
        taxableAmount: sumBy(customsEntries, (e) => Number(e.importGctBase)),
        importGct: sumBy(customsEntries, (e) => Number(e.importGctAmount)),
        advanceGct: sumBy(customsEntries, (e) => Number(e.advanceGctAmount)),
      },
    );
    const meta = metadata as {
      name?: string;
      taxNumber?: string;
      baseCurrency?: string;
    };
    const warnings = await this.getWarnings(result, lines, gctRegistered);

    return {
      fromDate,
      toDate,
      dueDate: getGctReturnDueDate(toDate),
      currencyCode: meta?.baseCurrency,
      organization: {
        name: meta?.name,
        trn: meta?.taxNumber || null,
        gctRegistered,
        gctRegistrationNumber:
          (get('gct_registration_number') as string) || null,
      },
      ...result,
      documents: { ...documents, customsEntries: customsEntries.length },
      warnings,
    };
  }

  /**
   * Loads the period's document lines in the base currency.
   * @param {string} fromDate
   * @param {string} toDate
   */
  private async loadLines(fromDate: string, toDate: string) {
    const range: [string, string] = [fromDate, toDate];

    const [invoices, receipts, creditNotes, bills, vendorCredits, expenses] =
      await Promise.all([
        this.saleInvoiceModel()
          .query()
          .whereBetween('invoiceDate', range)
          .whereNotNull('deliveredAt')
          .withGraphFetched('entries'),
        this.saleReceiptModel()
          .query()
          .whereBetween('receiptDate', range)
          .whereNotNull('closedAt')
          .withGraphFetched('entries'),
        this.creditNoteModel()
          .query()
          .whereBetween('creditNoteDate', range)
          .whereNotNull('openedAt')
          .withGraphFetched('entries'),
        this.billModel()
          .query()
          .whereBetween('billDate', range)
          .whereNotNull('openedAt')
          .withGraphFetched('entries'),
        this.vendorCreditModel()
          .query()
          .whereBetween('vendorCreditDate', range)
          .whereNotNull('openedAt')
          .withGraphFetched('entries'),
        this.expenseModel()
          .query()
          .whereBetween('paymentDate', [fromDate, `${toDate} 23:59:59`])
          .whereNotNull('publishedAt')
          .withGraphFetched('categories'),
      ]);

    const lines: GctReturnLine[] = [
      ...invoices.flatMap((doc) => this.itemLines(doc, 'sale', 1, false)),
      ...receipts.flatMap((doc) => this.itemLines(doc, 'sale', 1, true)),
      ...creditNotes.flatMap((doc) => this.itemLines(doc, 'sale', -1, true)),
      ...bills.flatMap((doc) => this.itemLines(doc, 'purchase', 1, false)),
      ...vendorCredits.flatMap((doc) =>
        this.itemLines(doc, 'purchase', -1, true),
      ),
      ...expenses.flatMap((expense) => this.expenseLines(expense)),
    ];
    return {
      lines,
      documents: {
        saleInvoices: invoices.length,
        saleReceipts: receipts.length,
        creditNotes: creditNotes.length,
        bills: bills.length,
        vendorCredits: vendorCredits.length,
        expenses: expenses.length,
      },
    };
  }

  /**
   * Lines of a document with item entries. The stored line amounts are used
   * where there are some (`tax.calc_after_discount`); older lines derive
   * them, spreading the document discount over the lines by value.
   * @param {boolean} isExtended - Receipts, credit notes, vendor credits:
   *   they carry tax only when they have a `taxAmountWithheld`.
   */
  private itemLines(
    doc: ItemDocument,
    side: GctLineSide,
    sign: 1 | -1,
    isExtended: boolean,
  ): GctReturnLine[] {
    const entries = doc.entries || [];
    const isTaxed =
      !isExtended ||
      (doc.taxAmountWithheld !== null && doc.taxAmountWithheld !== undefined);

    const netTotal = sumBy(entries, (entry) => finite(entry.totalExcludingTax));
    const discountRatio =
      netTotal > 0 ? Math.min(finite(doc.discountAmount) / netTotal, 1) : 0;
    const rate = doc.exchangeRate || 1;

    return entries.map((entry) => {
      const hasStored =
        entry.taxableAmount !== null && entry.taxableAmount !== undefined;
      const taxableAmount = hasStored
        ? Number(entry.taxableAmount)
        : finite(entry.totalExcludingTax) * (1 - discountRatio);

      return {
        side,
        sign,
        taxRateId: isTaxed ? entry.taxRateId || null : null,
        taxableAmount: taxableAmount * rate,
        taxAmount: isTaxed ? finite(entry.taxAmount) * rate : 0,
      };
    });
  }

  /**
   * Lines of an expense; untaxed expenses carry no tax rate.
   * @param {Expense} expense
   */
  private expenseLines(expense: Expense): GctReturnLine[] {
    const isTaxed =
      expense.taxAmountWithheld !== null &&
      expense.taxAmountWithheld !== undefined;
    const rate = expense.exchangeRate || 1;

    return (expense.categories || []).map((category) => ({
      side: 'purchase',
      sign: 1,
      taxRateId: isTaxed ? category.taxRateId || null : null,
      taxableAmount: finite(Number(category.amountExcludingTax)) * rate,
      taxAmount: isTaxed ? finite(Number(category.taxAmount)) * rate : 0,
    }));
  }

  /**
   * What the preparer should check before filing.
   */
  private async getWarnings(
    result: GctReturnResult,
    lines: GctReturnLine[],
    gctRegistered: boolean,
  ): Promise<GctReturnWarning[]> {
    const warnings: GctReturnWarning[] = [];

    if (!gctRegistered) {
      warnings.push({
        code: 'NOT_GCT_REGISTERED',
        message:
          'The organization is not registered for GCT (Preferences → Jamaica (GCT)).',
      });
    }
    if (result.supplies.unclassifiedAmount !== 0) {
      warnings.push({
        code: 'UNCLASSIFIED_SUPPLIES',
        message:
          'Some sales use a tax rate with no tax type, so they are not in the standard, zero-rated or exempt totals.',
      });
    }
    if (gctRegistered && result.supplies.noTaxRateAmount !== 0) {
      warnings.push({
        code: 'SUPPLIES_WITHOUT_TAX_RATE',
        message:
          'Some sales have no tax rate, so they are not in the standard, zero-rated or exempt totals.',
      });
    }
    const usedRateIds = uniq(
      lines.map((line) => line.taxRateId).filter(Boolean),
    );
    if (usedRateIds.length) {
      const unverified = await this.taxRateVersionModel()
        .query()
        .whereIn('taxRateId', usedRateIds)
        .where('verified', false)
        .resultSize();
      if (unverified > 0) {
        warnings.push({
          code: 'RATES_NOT_VERIFIED',
          message:
            'Some GCT rates used in this period are not verified against current TAJ guidance.',
        });
      }
    }
    return warnings;
  }
}
