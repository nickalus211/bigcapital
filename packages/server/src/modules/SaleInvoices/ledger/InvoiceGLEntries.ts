import { Knex } from 'knex';
import { Inject, Injectable } from '@nestjs/common';
import { LedgerStorageService } from '../../Ledger/LedgerStorage.service';
import { SaleInvoice } from '../models/SaleInvoice';
import { AccountRepository } from '../../Accounts/repositories/Account.repository';
import { InvoiceAccrualGL } from './InvoiceAccrualGL';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { TaxAccountsService } from '@/modules/TaxRates/TaxAccounts.service';

@Injectable()
export class SaleInvoiceGLEntries {
  constructor(
    private readonly ledegrRepository: LedgerStorageService,
    private readonly accountRepository: AccountRepository,
    private readonly taxAccounts: TaxAccountsService,

    @Inject(SaleInvoice.name)
    private readonly saleInvoiceModel: TenantModelProxy<typeof SaleInvoice>,
  ) {}

  /**
   * Writes a sale invoice GL entries.
   * @param {number} saleInvoiceId - Sale invoice id.
   * @param {Knex.Transaction} trx
   */
  public writeInvoiceGLEntries = async (
    saleInvoiceId: number,
    trx?: Knex.Transaction,
  ) => {
    const saleInvoice = await this.saleInvoiceModel()
      .query(trx)
      .findById(saleInvoiceId)
      .withGraphFetched('entries.item');

    // Find or create the A/R account.
    const ARAccount =
      await this.accountRepository.findOrCreateAccountReceivable(
        saleInvoice.currencyCode,
        {},
        trx,
      );
    // Output tax account (`tax.output_tax_account_id`, else tax payable).
    const taxPayableAccountId =
      await this.taxAccounts.getOutputTaxAccountId(trx);
    // Find or create the discount expense account.
    const discountAccount =
      await this.accountRepository.findOrCreateDiscountAccount({}, trx);
    // Find or create the other charges account.
    const otherChargesAccount =
      await this.accountRepository.findOrCreateOtherChargesAccount({}, trx);

    // Retrieves the ledger of the invoice.
    const invoiceAccrualGL = new InvoiceAccrualGL(saleInvoice);

    invoiceAccrualGL.setARAccountId(ARAccount.id);
    invoiceAccrualGL.setTaxPayableAccountId(taxPayableAccountId);
    invoiceAccrualGL.setDiscountAccountId(discountAccount.id);
    invoiceAccrualGL.setOtherChargesAccountId(otherChargesAccount.id);

    const ledger = invoiceAccrualGL.getInvoiceLedger();

    // Commits the ledger entries to the storage as UOW.
    await this.ledegrRepository.commit(ledger, trx);
  };

  /**
   * Rewrites the given invoice GL entries.
   * @param {number} saleInvoiceId
   * @param {Knex.Transaction} trx
   */
  public rewritesInvoiceGLEntries = async (
    saleInvoiceId: number,
    trx?: Knex.Transaction,
  ) => {
    // Reverts the invoice GL entries.
    await this.revertInvoiceGLEntries(saleInvoiceId, trx);

    // Writes the invoice GL entries.
    await this.writeInvoiceGLEntries(saleInvoiceId, trx);
  };

  /**
   * Reverts the given invoice GL entries.
   * @param {number} saleInvoiceId - Sale invoice id.
   * @param {Knex.Transaction} trx
   */
  public revertInvoiceGLEntries = async (
    saleInvoiceId: number,
    trx?: Knex.Transaction,
  ) => {
    await this.ledegrRepository.deleteByReference(
      saleInvoiceId,
      'SaleInvoice',
      trx,
    );
  };
}
