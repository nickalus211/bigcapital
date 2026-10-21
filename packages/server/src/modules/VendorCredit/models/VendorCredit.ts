import type { TaxRateTransaction } from '@/modules/TaxRates/models/TaxRateTransaction.model';
import { Model, raw } from 'objection';
import { Vendor } from '@/modules/Vendors/models/Vendor';
import { Warehouse } from '@/modules/Warehouses/models/Warehouse.model';
import { Branch } from '@/modules/Branches/models/Branch.model';
import { ItemEntry } from '@/modules/TransactionItemEntry/models/ItemEntry';
import { DiscountType } from '@/common/types/Discount';
import { TenantBaseModel } from '@/modules/System/models/TenantBaseModel';
import { ExportableModel } from '@/modules/Export/decorators/ExportableModel.decorator';
import { ImportableModel } from '@/modules/Import/decorators/Import.decorator';
import { InjectModelMeta } from '@/modules/Tenancy/TenancyModels/decorators/InjectModelMeta.decorator';
import { VendorCreditMeta } from './VendorCredit.meta';
import { sanitizeSortDirection } from '@/modules/DynamicListing/DynamicFilter/sanitizeSortDirection';
import { InjectModelDefaultViews } from '@/modules/Views/decorators/InjectModelDefaultViews.decorator';
import { VendorCreditDefaultViews } from '../constants';
import { InjectAttachable } from '@/modules/Attachments/decorators/InjectAttachable.decorator';

/**
 * The creditable amount in SQL: the lines' amount plus any exclusive tax.
 */
const CREDIT_AMOUNT_SQL =
  'COALESCE(AMOUNT) + IF(IS_INCLUSIVE_TAX, 0, COALESCE(TAX_AMOUNT_WITHHELD, 0))';

@InjectAttachable()
@ExportableModel()
@ImportableModel()
@InjectModelMeta(VendorCreditMeta)
@InjectModelDefaultViews(VendorCreditDefaultViews)
export class VendorCredit extends TenantBaseModel {
  // Tax (`tax.extended_documents`); null on untaxed documents.
  public isInclusiveTax: boolean;
  public taxAmountWithheld: number | null;
  public taxes?: TaxRateTransaction[];

  vendorId: number;
  amount: number;
  currencyCode: string;

  vendorCreditDate: Date;
  vendorCreditNumber: string;

  referenceNo: string;
  refundedAmount: number;
  invoicedAmount: number;
  adjustment: number;
  exchangeRate: number;
  note: string;
  openedAt: Date;
  userId: number;

  discount: number;
  discountType: DiscountType;

  branchId: number;
  warehouseId: number;

  vendor?: Vendor;
  warehouse?: Warehouse;
  branch?: Branch;
  entries?: ItemEntry[];
  attachments?: Document[];

  createdAt: Date;
  updatedAt: Date;

  /**
   * Table name
   */
  static get tableName() {
    return 'vendor_credits';
  }
  /**
   * Vendor credit amount in local currency.
   * @returns {number}
   */
  get localAmount() {
    return this.amount * this.exchangeRate;
  }

  /**
   * Vendor credit subtotal.
   * @returns {number}
   */
  get subtotal() {
    return this.amount;
  }

  /**
   * Vendor credit subtotal in local currency.
   * @returns {number}
   */
  get subtotalLocal() {
    return this.subtotal * this.exchangeRate;
  }

  /**
   * Discount amount.
   * @returns {number}
   */
  get discountAmount() {
    return this.discountType === DiscountType.Amount
      ? this.discount
      : this.subtotal * (this.discount / 100);
  }

  /**
   * Discount amount in local currency.
   * @returns {number | null}
   */
  get discountAmountLocal() {
    return this.discountAmount ? this.discountAmount * this.exchangeRate : null;
  }

  /**
   * Discount percentage.
   * @returns {number | null}
   */
  get discountPercentage(): number | null {
    return this.discountType === DiscountType.Percentage ? this.discount : null;
  }

  /**
   * Adjustment amount in local currency.
   * @returns {number | null}
   */
  get adjustmentLocal() {
    return this.adjustment ? this.adjustment * this.exchangeRate : null;
  }

  /**
   * Vendor credit total.
   * @returns {number}
   */
  get total() {
    return (
      this.subtotal -
      this.discountAmount +
      this.adjustment +
      this.exclusiveTaxAmount
    );
  }

  /**
   * Tax added on top of the lines. Inclusive tax is already in the line
   * rates, and untaxed documents carry none.
   * @returns {number}
   */
  get exclusiveTaxAmount(): number {
    return this.isInclusiveTax ? 0 : this.taxAmountWithheld || 0;
  }

  /**
   * Tax amount withheld in base currency.
   * @returns {number}
   */
  get taxAmountWithheldLocal(): number {
    return (this.taxAmountWithheld || 0) * this.exchangeRate;
  }

  /**
   * Amount available to refund or apply: the lines' amount plus any
   * exclusive tax. Matches `CREDIT_AMOUNT_SQL`.
   * @returns {number}
   */
  get creditAmount(): number {
    return this.amount + this.exclusiveTaxAmount;
  }

  /**
   * Vendor credit total in local currency.
   * @returns {number}
   */
  get totalLocal() {
    return this.total * this.exchangeRate;
  }

  /**
   * Model modifiers.
   */
  static get modifiers() {
    return {
      /**
       * Filters the credit notes in draft status.
       */
      draft(query) {
        query.where('opened_at', null);
      },

      /**
       * Filters the published vendor credits.
       */
      published(query) {
        query.whereNot('opened_at', null);
      },

      /**
       * Filters the open vendor credits.
       */
      open(query) {
        query
          .where(
            raw(`COALESCE(REFUNDED_AMOUNT) + COALESCE(INVOICED_AMOUNT) <
            ${CREDIT_AMOUNT_SQL}`),
          )
          .modify('published');
      },

      /**
       * Filters the closed vendor credits.
       */
      closed(query) {
        query
          .where(
            raw(`COALESCE(REFUNDED_AMOUNT) + COALESCE(INVOICED_AMOUNT) =
            ${CREDIT_AMOUNT_SQL}`),
          )
          .modify('published');
      },

      /**
       * Status filter.
       */
      filterByStatus(query, filterType) {
        switch (filterType) {
          case 'draft':
            query.modify('draft');
            break;
          case 'published':
            query.modify('published');
            break;
          case 'open':
          default:
            query.modify('open');
            break;
          case 'closed':
            query.modify('closed');
            break;
        }
      },

      /**
       *
       */
      sortByStatus(query, order) {
        const dir = sanitizeSortDirection(order);
        query.orderByRaw(
          `COALESCE(REFUNDED_AMOUNT) + COALESCE(INVOICED_AMOUNT) = ${CREDIT_AMOUNT_SQL} ${dir}`,
        );
      },
    };
  }

  /**
   * Timestamps columns.
   */
  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }

  /**
   * Virtual attributes.
   */
  static get virtualAttributes() {
    return [
      'taxAmountWithheldLocal',
      'creditAmount',
      'isDraft',
      'isPublished',
      'isOpen',
      'isClosed',

      'creditsRemaining',
      'localAmount',

      'discountAmount',
      'discountAmountLocal',
      'discountPercentage',

      'adjustmentLocal',

      'total',
      'totalLocal',
    ];
  }

  /**
   * Detarmines whether the vendor credit is draft.
   * @returns {boolean}
   */
  get isDraft() {
    return !this.openedAt;
  }

  /**
   * Detarmines whether vendor credit is published.
   * @returns {boolean}
   */
  get isPublished() {
    return !!this.openedAt;
  }

  /**
   * Detarmines whether the credit note is open.
   * @return {boolean}
   */
  get isOpen() {
    return !!this.openedAt && this.creditsRemaining > 0;
  }

  /**
   * Detarmines whether the credit note is closed.
   * @return {boolean}
   */
  get isClosed() {
    return this.openedAt && this.creditsRemaining === 0;
  }

  /**
   * Retrieve the credits remaining.
   * @returns {number}
   */
  get creditsRemaining() {
    return Math.max(
      this.creditAmount - this.refundedAmount - this.invoicedAmount,
      0,
    );
  }

  /**
   * Bill model settings.
   */
  // static get meta() {
  //   return BillSettings;
  // }

  /**
   * Relationship mapping.
   */
  static get relationMappings() {
    const { Vendor } = require('../../Vendors/models/Vendor');
    const {
      ItemEntry,
    } = require('../../TransactionItemEntry/models/ItemEntry');
    const { Branch } = require('../../Branches/models/Branch.model');
    const { Document } = require('../../ChromiumlyTenancy/models/Document');
    const { Warehouse } = require('../../Warehouses/models/Warehouse.model');

    const {
      TaxRateTransaction,
    } = require('../../TaxRates/models/TaxRateTransaction.model');

    return {
      /**
       * Tax rate transactions of the document.
       */
      taxes: {
        relation: Model.HasManyRelation,
        modelClass: TaxRateTransaction,
        join: {
          from: 'vendor_credits.id',
          to: 'tax_rate_transactions.referenceId',
        },
        filter(builder) {
          builder.where('reference_type', 'VendorCredit');
        },
      },

      /**
       * Vendor credit may belongs to vendor.
       */
      vendor: {
        relation: Model.BelongsToOneRelation,
        modelClass: Vendor,
        join: {
          from: 'vendor_credits.vendorId',
          to: 'contacts.id',
        },
        filter(query) {
          query.where('contact_service', 'vendor');
        },
      },

      /**
       * Vendor credit may has many item entries.
       */
      entries: {
        relation: Model.HasManyRelation,
        modelClass: ItemEntry,
        join: {
          from: 'vendor_credits.id',
          to: 'items_entries.referenceId',
        },
        filter(builder) {
          builder.where('reference_type', 'VendorCredit');
          builder.orderBy('index', 'ASC');
        },
      },

      /**
       * Vendor credit may belongs to branch.
       */
      branch: {
        relation: Model.BelongsToOneRelation,
        modelClass: Branch,
        join: {
          from: 'vendor_credits.branchId',
          to: 'branches.id',
        },
      },

      /**
       * Vendor credit may has associated warehouse.
       */
      warehouse: {
        relation: Model.BelongsToOneRelation,
        modelClass: Warehouse,
        join: {
          from: 'vendor_credits.warehouseId',
          to: 'warehouses.id',
        },
      },

      /**
       * Vendor credit may has many attached attachments.
       */
      attachments: {
        relation: Model.ManyToManyRelation,
        modelClass: Document,
        join: {
          from: 'vendor_credits.id',
          through: {
            from: 'document_links.modelId',
            to: 'document_links.documentId',
          },
          to: 'documents.id',
        },
        filter(query) {
          query.where('model_ref', 'VendorCredit');
        },
      },
    };
  }

  /**
   * Model search attributes.
   */
  static get searchRoles() {
    return [
      { fieldKey: 'credit_number', comparator: 'contains' },
      { condition: 'or', fieldKey: 'reference_no', comparator: 'contains' },
      { condition: 'or', fieldKey: 'amount', comparator: 'equals' },
    ];
  }

  /**
   * Prevents mutate base currency since the model is not empty.
   * @returns {boolean}
   */
  static get preventMutateBaseCurrency() {
    return true;
  }
}
