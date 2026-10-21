import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { Features } from '@/common/types/Features';
import { FeaturesManager } from '@/modules/Features/FeaturesManager';
import { SETTINGS_PROVIDER } from '@/modules/Settings/Settings.types';
import { SettingsStore } from '@/modules/Settings/SettingsStore';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import { SaleInvoice } from '@/modules/SaleInvoices/models/SaleInvoice';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { formatNumber } from '@/utils/format-number';
import {
  formatTrn,
  getTaxInvoiceWarnings,
  TaxInvoiceOrganization,
  TaxInvoiceWarning,
} from './tax-invoice-rules';

export interface TaxInvoiceContext extends TaxInvoiceOrganization {
  /** The Jamaica localization is on. */
  isJamaica: boolean;
}

/**
 * Tax Invoices (GCT Act, section 29): the compliance warnings returned with
 * invoices, and the extra fields printed on a registered organization's
 * invoice PDF. Everything here is inert while the Jamaica feature is off.
 */
@Injectable()
export class JamaicaTaxInvoiceService {
  constructor(
    private readonly featuresManager: FeaturesManager,
    private readonly tenancyContext: TenancyContext,

    @Inject(SETTINGS_PROVIDER)
    private readonly settings: () => Promise<SettingsStore>,

    @Inject(SaleInvoice.name)
    private readonly saleInvoiceModel: TenantModelProxy<typeof SaleInvoice>,
  ) {}

  /**
   * Retrieves the organization details a Tax Invoice needs.
   * @returns {Promise<TaxInvoiceContext>}
   */
  public async getContext(): Promise<TaxInvoiceContext> {
    const isJamaica = await this.featuresManager.accessible(Features.JAMAICA);

    if (!isJamaica) {
      return { isJamaica, gctRegistered: false, hasAddress: false };
    }
    const [settings, metadata] = await Promise.all([
      this.settings(),
      this.tenancyContext.getTenantMetadata(),
    ]);
    const get = (key: string) => settings.get({ group: 'jamaica', key }, null);
    const meta = metadata as { taxNumber?: string; address?: any };

    return {
      isJamaica,
      gctRegistered: !!get('gct_registered'),
      gctRegistrationNumber: (get('gct_registration_number') as string) || null,
      trn: meta?.taxNumber || null,
      hasAddress: !!meta?.address?.address1,
    };
  }

  /**
   * Retrieves the Tax Invoice warnings of the given invoice. Empty while the
   * Jamaica feature is off.
   * @param {number} invoiceId
   * @param {Knex.Transaction} trx
   * @returns {Promise<TaxInvoiceWarning[]>}
   */
  public async getInvoiceWarnings(
    invoiceId: number,
    trx?: Knex.Transaction,
  ): Promise<TaxInvoiceWarning[]> {
    const context = await this.getContext();
    if (!context.isJamaica) return [];

    const invoice = await this.saleInvoiceModel()
      .query(trx)
      .findById(invoiceId)
      .withGraphFetched('customer')
      .withGraphFetched('entries.tax');

    if (!invoice) return [];

    return getTaxInvoiceWarnings(context, {
      customer: invoice.customer,
      entries: (invoice.entries || [])
        .slice()
        .sort((a, b) => a.index - b.index),
    });
  }

  /**
   * Retrieves the invoice PDF attributes of a Tax Invoice: the title, the
   * supplier's and customer's TRNs, and each line's GCT. Empty unless the
   * organization is registered for GCT.
   * @param {Object} invoice - The transformed invoice (`GetSaleInvoice`).
   * @returns {Promise<Record<string, any>>}
   */
  public async getInvoicePdfAttributes(invoice: any) {
    const context = await this.getContext();
    if (!context.isJamaica || !context.gctRegistered) return {};

    const money = (amount: number) =>
      formatNumber(amount || 0, {
        currencyCode: invoice.currencyCode,
        money: false,
      });

    return {
      bigtitle: 'Tax Invoice',
      companyTaxNumbers: [
        ...(context.trn ? [`TRN: ${formatTrn(context.trn)}`] : []),
        ...(context.gctRegistrationNumber
          ? [`GCT Reg. No.: ${context.gctRegistrationNumber}`]
          : []),
      ],
      customerTaxNumber: invoice.customer?.taxNumber
        ? `TRN: ${formatTrn(invoice.customer.taxNumber)}`
        : '',
      showLineTax: true,
      lineTaxRateLabel: 'GCT %',
      lineTaxAmountLabel: 'GCT',
      lineTotalLabel: 'Amount excl. GCT',
      subtotalLabel: 'Subtotal excl. GCT',
      lines: invoice.entries.map((entry) => ({
        item: entry.item?.name,
        description: entry.description,
        rate: entry.rateFormatted,
        quantity: entry.quantityFormatted,
        taxRate: entry.taxRateId ? `${Number(entry.taxRate || 0)}%` : '—',
        taxAmount: money(entry.taxAmount),
        total: money(entry.subtotalExcludingTax - (entry.discountAmount || 0)),
      })),
      subtotal: money(invoice.subtotalExludingTax),
      taxes: invoice.taxes.map((tax) => ({
        label: `${tax.name} (${Number(tax.taxRate)}%)`,
        amount: tax.taxRateAmountFormatted,
      })),
    };
  }
}
