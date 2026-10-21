import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { sumBy } from 'lodash';
import { DiscountType } from '@/common/types/Discount';
import { ItemEntry } from '@/modules/TransactionItemEntry/models/ItemEntry';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import {
  ItemEntriesTaxTransactions,
  ItemTaxRateSide,
} from './ItemEntriesTaxTransactions.service';
import { CommandTaxRatesValidators } from './commands/CommandTaxRatesValidator.service';
import { WriteTaxTransactionsItemEntries } from './WriteTaxTransactionsItemEntries';
import { calcAmountTax } from './ItemEntriesTaxCalculator';

export interface ExtendedDocumentTaxDTO {
  entries: Array<Record<string, any>>;
  isInclusiveTax?: boolean;
  discount?: number;
  discountType?: DiscountType;
}

export interface ExtendedDocumentTaxResult<T> {
  entries: T[];
  isInclusiveTax: boolean;
  taxAmountWithheld: number;
}

/**
 * Tax on the documents upstream leaves untaxed: sale receipts, credit
 * notes, vendor credits and estimates (`tax.extended_documents`).
 * While the setting is off, every method is a no-op and the documents
 * behave exactly as upstream.
 */
@Injectable()
export class ExtendedDocumentsTaxService {
  constructor(
    private readonly taxTransactions: ItemEntriesTaxTransactions,
    private readonly validators: CommandTaxRatesValidators,
    private readonly writeTaxTransactions: WriteTaxTransactionsItemEntries,

    @Inject(ItemEntry.name)
    private readonly itemEntryModel: TenantModelProxy<typeof ItemEntry>,
  ) {}

  /**
   * Whether the extended documents carry tax.
   * @returns {Promise<boolean>}
   */
  public isEnabled(): Promise<boolean> {
    return this.taxTransactions.isExtendedDocumentsTaxEnabled();
  }

  /**
   * Validates the lines' tax codes and ids, then associates their rates
   * and tax amounts.
   * @param {ExtendedDocumentTaxDTO} dto
   * @param {{ date?: Date | string; side: ItemTaxRateSide }} options
   * @returns {Promise<ExtendedDocumentTaxResult | null>} `null` while the
   *   setting is off; the caller then keeps its untaxed lines.
   */
  public async transformDocumentEntries<T extends Record<string, any>>(
    dto: ExtendedDocumentTaxDTO,
    entries: T[],
    options: { date?: Date | string; side: ItemTaxRateSide },
  ): Promise<ExtendedDocumentTaxResult<T> | null> {
    if (!(await this.isEnabled())) return null;

    await this.validators.validateItemEntriesTaxCode(dto.entries as any[]);
    await this.validators.validateItemEntriesTaxCodeId(dto.entries as any[]);

    const isInclusiveTax = !!dto.isInclusiveTax;
    const taxedEntries = await this.taxTransactions.transformEntriesTax(
      entries.map((entry) => ({ ...entry, isInclusiveTax })),
      {
        date: options.date,
        side: options.side,
        isInclusiveTax,
        discount: dto.discount,
        discountType: dto.discountType,
      },
    );
    const taxAmountWithheld = sumBy(
      taxedEntries.map((entry) => ItemEntry.fromJson(entry)),
      'taxAmount',
    );
    return { entries: taxedEntries, isInclusiveTax, taxAmountWithheld };
  }

  /**
   * Associates the tax of expense categories. Expenses have no discounts,
   * so each category's tax comes straight from its amount.
   * @param {Array} categories
   * @param {{ date?: Date | string; isInclusiveTax?: boolean }} options
   * @returns {Promise<Object | null>} `null` while the setting is off.
   */
  public async transformExpenseCategories<
    T extends { amount?: number; taxRateId?: number },
  >(
    categories: T[],
    options: { date?: Date | string; isInclusiveTax?: boolean },
  ): Promise<{
    categories: Array<
      T & {
        taxRateId: number | null;
        taxRate: number | null;
        taxableAmount: number;
        lineTaxAmount: number;
      }
    >;
    isInclusiveTax: boolean;
    taxAmountWithheld: number;
    totalAmount: number;
  } | null> {
    if (!(await this.isEnabled())) return null;

    await this.validators.validateItemEntriesTaxCodeId(categories as any[]);

    const isInclusiveTax = !!options.isInclusiveTax;
    const withRates = await this.taxTransactions.assocTaxRateFromTaxIdToEntries(
      categories.map((category) => ({ ...category })) as any[],
      options.date,
    );
    const taxedCategories = withRates.map((category: any) => {
      const taxRate = category.taxRateId ? category.taxRate || 0 : 0;
      const amounts = calcAmountTax(
        category.amount || 0,
        taxRate,
        isInclusiveTax,
      );
      return {
        ...category,
        taxRateId: category.taxRateId || null,
        taxRate: category.taxRateId ? taxRate : null,
        ...amounts,
      };
    });
    const taxAmountWithheld = sumBy(taxedCategories, 'lineTaxAmount');
    const totalAmount =
      sumBy(taxedCategories, (category) => category.amount || 0) +
      (isInclusiveTax ? 0 : taxAmountWithheld);

    return {
      categories: taxedCategories,
      isInclusiveTax,
      taxAmountWithheld,
      totalAmount,
    };
  }

  /**
   * Rewrites the tax rate transactions of the given document from its
   * stored lines.
   * @param {string} referenceType
   * @param {number} referenceId
   * @param {Knex.Transaction} trx
   */
  public async rewriteTaxTransactions(
    referenceType: string,
    referenceId: number,
    trx?: Knex.Transaction,
  ) {
    if (!(await this.isEnabled())) return;

    const entries = await this.itemEntryModel()
      .query(trx)
      .where({ referenceType, referenceId });

    await this.writeTaxTransactions.removeTaxTransactionsFromItemEntries(
      referenceId,
      referenceType,
      trx,
    );
    await this.writeTaxTransactions.writeTaxTransactionsFromItemEntries(
      entries,
      trx,
    );
  }

  /**
   * Rewrites the tax rate transactions of an expense from its categories.
   * @param {number} expenseId
   * @param {Array} categories
   * @param {Knex.Transaction} trx
   */
  public async rewriteExpenseTaxTransactions(
    expenseId: number,
    categories: Array<{ taxRateId?: number | null; taxRate?: number | null }>,
    trx?: Knex.Transaction,
  ) {
    if (!(await this.isEnabled())) return;

    await this.removeTaxTransactions('Expense', expenseId, trx);
    await this.writeTaxTransactions.writeTaxTransactionsFromItemEntries(
      categories.map((category) => ({
        taxRateId: category.taxRateId,
        taxRate: category.taxRate,
        referenceType: 'Expense',
        referenceId: expenseId,
      })) as any[],
      trx,
    );
  }

  /**
   * Removes the tax rate transactions of the given document.
   * Runs whatever the setting, so no transaction outlives its document.
   * @param {string} referenceType
   * @param {number} referenceId
   * @param {Knex.Transaction} trx
   */
  public async removeTaxTransactions(
    referenceType: string,
    referenceId: number,
    trx?: Knex.Transaction,
  ) {
    await this.writeTaxTransactions.removeTaxTransactionsFromItemEntries(
      referenceId,
      referenceType,
      trx,
    );
  }
}
