import { Inject, Injectable } from '@nestjs/common';
import { keyBy, omit, sumBy } from 'lodash';
import * as moment from 'moment';
import { ItemEntry } from '@/modules/TransactionItemEntry/models/ItemEntry';
import { TaxRateModel } from './models/TaxRate.model';
import { TaxRateVersion } from './models/TaxRateVersion.model';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { FeaturesManager } from '../Features/FeaturesManager';
import { Features } from '@/common/types/Features';
import { Item } from '../Items/models/Item';
import { TaxSettingsService } from './TaxSettings.service';
import {
  calcEntriesTaxAfterDiscount,
  DocumentTaxOptions,
} from './ItemEntriesTaxCalculator';

export type ItemTaxRateSide = 'sell' | 'purchase';

export interface DocumentEntriesTaxOptions extends DocumentTaxOptions {
  /** The transaction date, to pick the dated tax rate version. */
  date?: Date | string;
  /** Which item default rate applies when `tax.default_from_item` is on. */
  side: ItemTaxRateSide;
}

@Injectable()
export class ItemEntriesTaxTransactions {
  constructor(
    @Inject(ItemEntry.name)
    private itemEntryModel: TenantModelProxy<typeof ItemEntry>,

    @Inject(TaxRateModel.name)
    private taxRateModel: TenantModelProxy<typeof TaxRateModel>,

    @Inject(TaxRateVersion.name)
    private taxRateVersionModel: TenantModelProxy<typeof TaxRateVersion>,

    @Inject(Item.name)
    private itemModel: TenantModelProxy<typeof Item>,

    private readonly featuresManager: FeaturesManager,
    private readonly taxSettings: TaxSettingsService,
  ) {}

  /**
   * Gives lines that omit a tax rate (no `taxRateId` and no `taxCode` key)
   * the item's default sell or purchase tax rate, when the tenant turned
   * `tax.default_from_item` on. A line sending `taxRateId: null` keeps no tax.
   * @param {ItemTaxRateSide} side
   */
  public assocDefaultTaxRateFromItems =
    (side: ItemTaxRateSide) =>
    async <T extends { itemId?: number; taxRateId?: number; taxCode?: string }>(
      entries: T[],
    ): Promise<T[]> => {
      const { defaultFromItem } = await this.taxSettings.getTaxSettings();
      if (!defaultFromItem) return entries;

      const omitted = (entry: T) =>
        entry.itemId && entry.taxRateId === undefined && !entry.taxCode;

      const itemsIds = entries.filter(omitted).map((e) => e.itemId);
      if (itemsIds.length === 0) return entries;

      const items = await this.itemModel().query().whereIn('id', itemsIds);
      const itemsById = keyBy(items, 'id');
      const field = side === 'sell' ? 'sellTaxRateId' : 'purchaseTaxRateId';

      return entries.map((entry) => {
        const taxRateId = omitted(entry) && itemsById[entry.itemId]?.[field];
        return taxRateId ? { ...entry, taxRateId } : entry;
      });
    };

  /**
   * Stores each line's taxable amount and tax when the tenant calculates
   * tax after discounts (`tax.calc_after_discount`). Otherwise both are
   * cleared, so the tax keeps being derived from the rate as upstream does.
   * @param {any[]} entries - Entries with `taxRate` already associated.
   * @param {DocumentTaxOptions} options
   */
  public assocEntriesTaxAmounts = async <T extends Record<string, any>>(
    entries: T[],
    options: DocumentTaxOptions,
  ): Promise<T[]> => {
    const { calcAfterDiscount } = await this.taxSettings.getTaxSettings();

    if (!calcAfterDiscount) {
      return entries.map((entry) => ({
        ...entry,
        taxableAmount: null,
        lineTaxAmount: null,
      }));
    }
    const amounts = calcEntriesTaxAfterDiscount(entries as any[], options);

    return entries.map((entry, index) => ({ ...entry, ...amounts[index] }));
  };

  /**
   * Runs the whole tax pipeline on a document's lines: default rate from
   * the item, tax code to id, the rate as of the date, then the amounts.
   * @param {any[]} entries
   * @param {DocumentEntriesTaxOptions} options
   */
  public transformEntriesTax = async <T extends Record<string, any>>(
    entries: T[],
    options: DocumentEntriesTaxOptions,
  ): Promise<T[]> => {
    const withDefaults = await this.assocDefaultTaxRateFromItems(options.side)(
      entries,
    );
    const withIds = await this.assocTaxRateIdFromCodeToEntries(withDefaults);
    const withRates = await this.assocTaxRateFromTaxIdToEntries(
      withIds as any[],
      options.date,
    );
    const withAmounts = await this.assocEntriesTaxAmounts(withRates, options);

    return withAmounts.map((entry) => omit(entry, ['taxCode']) as T);
  };

  /**
   * Whether receipts, credit notes, vendor credits, estimates and expenses
   * carry tax (`tax.extended_documents`, and the sales tax feature).
   * @returns {Promise<boolean>}
   */
  public isExtendedDocumentsTaxEnabled = async (): Promise<boolean> => {
    const [{ extendedDocuments }, isSalesTaxEnabled] = await Promise.all([
      this.taxSettings.getTaxSettings(),
      this.featuresManager.accessible(Features.SALES_TAX),
    ]);
    return extendedDocuments && isSalesTaxEnabled;
  };

  /**
   * Associates tax amount withheld to the model.
   * @param model
   * @returns
   */
  public assocTaxAmountWithheldFromEntries = (model: any) => {
    const entries = model.entries.map((entry) =>
      this.itemEntryModel().fromJson(entry),
    );
    const taxAmountWithheld = sumBy(entries, 'taxAmount');
    // Stored line amounts also reset an edited document's tax to zero.
    const hasStoredAmounts = entries.some(
      (entry) =>
        entry.lineTaxAmount !== null && entry.lineTaxAmount !== undefined,
    );
    if (taxAmountWithheld || hasStoredAmounts) {
      model.taxAmountWithheld = taxAmountWithheld;
    }
    return model;
  };

  /**
   * Associates tax rate id from tax code to entries.
   * @param {any} entries
   */
  public assocTaxRateIdFromCodeToEntries = async (entries: any) => {
    const isSalesTaxEnabled = await this.featuresManager.accessible(
      Features.SALES_TAX,
    );
    if (!isSalesTaxEnabled) return entries;

    const entriesWithCode = entries.filter((entry) => entry.taxCode);
    const taxCodes = entriesWithCode.map((entry) => entry.taxCode);
    const foundTaxCodes = await this.taxRateModel()
      .query()
      .whereIn('code', taxCodes);

    const taxCodesMap = keyBy(foundTaxCodes, 'code');

    return entries.map((entry) => {
      if (entry.taxCode) {
        entry.taxRateId = taxCodesMap[entry.taxCode]?.id;
      }
      return entry;
    });
  };

  /**
   * Associates tax rate from tax id to entries.
   * When `asOfDate` is given, a tax rate version effective on that date
   * takes precedence over the tax rate's own rate.
   * @param {ItemEntry[]} entries
   * @param {Date|string} asOfDate - The transaction date.
   * @returns {Promise<ItemEntry[]>}
   */
  public assocTaxRateFromTaxIdToEntries = async (
    entries: ItemEntry[],
    asOfDate?: Date | string,
  ) => {
    const isSalesTaxEnabled = await this.featuresManager.accessible(
      Features.SALES_TAX,
    );
    if (!isSalesTaxEnabled) return entries;

    const entriesWithId = entries.filter((e) => e.taxRateId);
    const taxRateIds = entriesWithId.map((e) => e.taxRateId);
    const foundTaxes = await this.taxRateModel()
      .query()
      .whereIn('id', taxRateIds);

    const taxRatesMap = keyBy(foundTaxes, 'id');
    const versionRatesMap = asOfDate
      ? await this.getEffectiveVersionRates(taxRateIds, asOfDate)
      : {};

    return entries.map((entry) => {
      if (entry.taxRateId) {
        entry.taxRate =
          versionRatesMap[entry.taxRateId] ??
          taxRatesMap[entry.taxRateId]?.rate;
      }
      return entry;
    });
  };

  /**
   * Retrieves the rates of the tax rate versions effective on the given
   * date, keyed by tax rate id. The latest effective version wins.
   * @param {number[]} taxRateIds
   * @param {Date|string} asOfDate
   * @returns {Promise<Record<number, number>>}
   */
  private getEffectiveVersionRates = async (
    taxRateIds: number[],
    asOfDate: Date | string,
  ): Promise<Record<number, number>> => {
    if (taxRateIds.length === 0) return {};

    const date = moment(asOfDate).format('YYYY-MM-DD');
    const versions = await this.taxRateVersionModel()
      .query()
      .whereIn('tax_rate_id', taxRateIds)
      .modify('effectiveOn', date)
      .orderBy('effective_from', 'desc');

    return versions.reduce(
      (acc, version) => {
        if (acc[version.taxRateId] === undefined) {
          acc[version.taxRateId] = Number(version.rate);
        }
        return acc;
      },
      {} as Record<number, number>,
    );
  };
}
