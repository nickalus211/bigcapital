import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { LedgerStorageService } from '@/modules/Ledger/LedgerStorage.service';
import { SaleReceipt } from '../models/SaleReceipt';
import { AccountRepository } from '@/modules/Accounts/repositories/Account.repository';
import { SaleReceiptGL } from './SaleReceiptGL';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { TaxAccountsService } from '@/modules/TaxRates/TaxAccounts.service';

@Injectable()
export class SaleReceiptGLEntries {
  constructor(
    private readonly ledgerStorage: LedgerStorageService,
    private readonly accountRepository: AccountRepository,
    private readonly taxAccounts: TaxAccountsService,

    @Inject(SaleReceipt.name)
    private readonly saleReceiptModel: TenantModelProxy<typeof SaleReceipt>,
  ) {}

  /**
   * Creates income GL entries.
   * @param {number} saleReceiptId
   * @param {Knex.Transaction} trx
   */
  public writeIncomeGLEntries = async (
    saleReceiptId: number,
    trx?: Knex.Transaction,
  ): Promise<void> => {
    const saleReceipt = await this.saleReceiptModel()
      .query(trx)
      .findById(saleReceiptId)
      .withGraphFetched('entries.item');

    // Find or create the discount expense account.
    const discountAccount =
      await this.accountRepository.findOrCreateDiscountAccount({}, trx);
    // Find or create the other charges account.
    const otherChargesAccount =
      await this.accountRepository.findOrCreateOtherChargesAccount({}, trx);

    // Output tax account, only for taxed receipts (`tax.extended_documents`).
    const taxAccountId =
      saleReceipt.taxAmountWithheld !== null &&
      saleReceipt.taxAmountWithheld !== undefined
        ? await this.taxAccounts.getOutputTaxAccountId(trx)
        : null;

    // Retrieves the income ledger.
    const incomeLedger = new SaleReceiptGL(saleReceipt)
      .setDiscountAccountId(discountAccount.id)
      .setOtherChargesAccountId(otherChargesAccount.id)
      .setTaxPayableAccountId(taxAccountId)
      .getIncomeLedger();

    // Commits the ledger entries to the storage.
    await this.ledgerStorage.commit(incomeLedger, trx);
  };

  /**
   * Reverts the receipt GL entries.
   * @param {number} saleReceiptId - Sale receipt id.
   * @param {Knex.Transaction} trx
   * @returns {Promise<void>}
   */
  public revertReceiptGLEntries = async (
    saleReceiptId: number,
    trx?: Knex.Transaction,
  ): Promise<void> => {
    await this.ledgerStorage.deleteByReference(
      saleReceiptId,
      'SaleReceipt',
      trx,
    );
  };

  /**
   * Rewrites the receipt GL entries.
   * @param {number} saleReceiptId
   * @param {Knex.Transaction} trx
   * @returns {Promise<void>}
   */
  public rewriteReceiptGLEntries = async (
    saleReceiptId: number,
    trx?: Knex.Transaction,
  ): Promise<void> => {
    // Reverts the receipt GL entries.
    await this.revertReceiptGLEntries(saleReceiptId, trx);

    // Writes the income GL entries.
    await this.writeIncomeGLEntries(saleReceiptId, trx);
  };
}
