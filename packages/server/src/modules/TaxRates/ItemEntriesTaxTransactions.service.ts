import { Inject, Injectable } from '@nestjs/common';
import { keyBy, sumBy } from 'lodash';
import * as moment from 'moment';
import { ItemEntry } from '@/modules/TransactionItemEntry/models/ItemEntry';
import { TaxRateModel } from './models/TaxRate.model';
import { TaxRateVersion } from './models/TaxRateVersion.model';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { FeaturesManager } from '../Features/FeaturesManager';
import { Features } from '@/common/types/Features';

@Injectable()
export class ItemEntriesTaxTransactions {
  constructor(
    @Inject(ItemEntry.name)
    private itemEntryModel: TenantModelProxy<typeof ItemEntry>,

    @Inject(TaxRateModel.name)
    private taxRateModel: TenantModelProxy<typeof TaxRateModel>,

    @Inject(TaxRateVersion.name)
    private taxRateVersionModel: TenantModelProxy<typeof TaxRateVersion>,

    private readonly featuresManager: FeaturesManager,
  ) {}

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

    if (taxAmountWithheld) {
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
