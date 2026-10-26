import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { ERRORS } from '../Bills.constants';
import { Bill } from '../models/Bill';
import { ServiceError } from '@/modules/Items/ServiceError';
import { BillPaymentEntry } from '@/modules/BillPayments/models/BillPaymentEntry';
import { VendorCreditAppliedBill } from '@/modules/VendorCreditsApplyBills/models/VendorCreditAppliedBill';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { BillEntryDto } from '../dtos/Bill.dto';
import { BillLandedCostsBridge } from '../integrations/BillLandedCostsBridge';
import { Account } from '@/modules/Accounts/models/Account.model';

@Injectable()
export class BillsValidators {
  constructor(
    @Inject(Bill.name) private billModel: TenantModelProxy<typeof Bill>,

    @Inject(BillPaymentEntry.name)
    private billPaymentEntryModel: TenantModelProxy<typeof BillPaymentEntry>,

    @Inject(VendorCreditAppliedBill.name)
    private vendorCreditAppliedBillModel: TenantModelProxy<
      typeof VendorCreditAppliedBill
    >,

    private readonly landedCostsBridge: BillLandedCostsBridge,

    @Inject(Account.name)
    private accountModel: TenantModelProxy<typeof Account>,
  ) {}

  /**
   * Validates the account lines of the bill: every line needs an item or a
   * cost account, and the cost accounts must exist.
   * @param {BillEntryDto[]} entries
   */
  public async validateBillAccountLines(entries: BillEntryDto[]) {
    const hasItem = (entry: BillEntryDto) =>
      entry.itemId !== undefined && entry.itemId !== null;

    if (entries.some((entry) => !hasItem(entry) && !entry.costAccountId)) {
      throw new ServiceError(
        ERRORS.BILL_ENTRY_ITEM_OR_ACCOUNT_REQUIRED,
        'Each bill line needs an item or an account.',
      );
    }
    const accountsIds = [
      ...new Set(
        entries.filter((e) => e.costAccountId).map((e) => e.costAccountId),
      ),
    ];
    if (accountsIds.length === 0) return;

    const foundAccounts = await this.accountModel()
      .query()
      .whereIn('id', accountsIds);

    if (foundAccounts.length !== accountsIds.length) {
      throw new ServiceError(
        ERRORS.BILL_ENTRY_ACCOUNT_NOT_FOUND,
        'A bill line account was not found.',
      );
    }
  }

  /**
   * Validates the bill existance.
   * @param {Bill | undefined | null} bill
   */
  public validateBillExistance(bill: Bill | undefined | null) {
    if (!bill) {
      throw new ServiceError(ERRORS.BILL_NOT_FOUND);
    }
  }

  /**
   * Validates the bill amount is bigger than paid amount.
   * @param {number} billAmount
   * @param {number} paidAmount
   */
  public validateBillAmountBiggerPaidAmount(
    billAmount: number,
    paidAmount: number,
  ) {
    if (billAmount < paidAmount) {
      throw new ServiceError(ERRORS.BILL_AMOUNT_SMALLER_THAN_PAID_AMOUNT);
    }
  }

  /**
   * Validates the bill number existance.
   */
  public async validateBillNumberExists(
    billNumber: string,
    notBillId?: number,
  ) {
    const foundBills = await this.billModel()
      .query()
      .where('bill_number', billNumber)
      .onBuild((builder) => {
        if (notBillId) {
          builder.whereNot('id', notBillId);
        }
      });

    if (foundBills.length > 0) {
      throw new ServiceError(
        ERRORS.BILL_NUMBER_EXISTS,
        'The bill number is not unique.',
      );
    }
  }

  /**
   * Validate the bill has no payment entries.
   * @param {number} billId - Bill id.
   * @param {Knex.Transaction} trx
   */
  public async validateBillHasNoEntries(
    billId: number,
    trx?: Knex.Transaction,
  ) {
    // Retrieve the bill associate payment made entries.
    const entries = await this.billPaymentEntryModel()
      .query(trx)
      .where('bill_id', billId);

    if (entries.length > 0) {
      throw new ServiceError(ERRORS.BILL_HAS_ASSOCIATED_PAYMENT_ENTRIES);
    }
    return entries;
  }

  /**
   * Validate the bill number require.
   * @param {string} billNo -
   */
  public validateBillNoRequire(billNo: string) {
    if (!billNo) {
      throw new ServiceError(ERRORS.BILL_NO_IS_REQUIRED);
    }
  }

  /**
   * Validate bill transaction has no associated allocated landed cost transactions.
   * @param {number} billId
   * @param {Knex.Transaction} trx
   */
  public async validateBillHasNoLandedCost(
    billId: number,
    trx?: Knex.Transaction,
  ) {
    await this.landedCostsBridge.validateBillHasNoLandedCosts(billId, trx);
  }

  /**
   * Validate transaction entries that have landed cost type should not be
   * inventory items.
   * @param {IItemEntryDTO[]} newEntriesDTO -
   */
  public async validateCostEntriesShouldBeInventoryItems(
    newEntriesDTO: BillEntryDto[],
  ) {
    await this.landedCostsBridge.validateBillEntries(newEntriesDTO);
  }

  /**
   *
   * @param {number} billId
   */
  public validateBillHasNoAppliedToCredit = async (
    billId: number,
    trx?: Knex.Transaction,
  ) => {
    const appliedTransactions = await this.vendorCreditAppliedBillModel()
      .query(trx)
      .where('billId', billId);

    if (appliedTransactions.length > 0) {
      throw new ServiceError(ERRORS.BILL_HAS_APPLIED_TO_VENDOR_CREDIT);
    }
  };

  /**
   * Validate the given vendor has no associated bills transactions.
   * @param {number} vendorId - Vendor id.
   */
  public async validateVendorHasNoBills(vendorId: number) {
    const bills = await this.billModel().query().where('vendor_id', vendorId);

    if (bills.length > 0) {
      throw new ServiceError(ERRORS.VENDOR_HAS_BILLS);
    }
  }
}
