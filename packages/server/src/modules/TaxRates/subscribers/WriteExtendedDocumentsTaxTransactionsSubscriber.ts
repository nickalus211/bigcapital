import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Knex } from 'knex';
import { events } from '@/common/events/events';
import { ExtendedDocumentsTaxService } from '../ExtendedDocumentsTax.service';

interface DocumentPayload {
  trx?: Knex.Transaction;
  [key: string]: any;
}

/**
 * Keeps the tax rate transactions of sale receipts, credit notes, vendor
 * credits and estimates in sync with their lines (`tax.extended_documents`).
 */
@Injectable()
export class WriteExtendedDocumentsTaxTransactionsSubscriber {
  constructor(
    private readonly extendedDocumentsTax: ExtendedDocumentsTaxService,
  ) {}

  private rewrite = (type: string, id: number, trx?: Knex.Transaction) =>
    this.extendedDocumentsTax.rewriteTaxTransactions(type, id, trx);

  private remove = (type: string, id: number, trx?: Knex.Transaction) =>
    this.extendedDocumentsTax.removeTaxTransactions(type, id, trx);

  @OnEvent(events.saleReceipt.onCreated)
  @OnEvent(events.saleReceipt.onEdited)
  async onSaleReceiptSaved({ saleReceipt, trx }: DocumentPayload) {
    await this.rewrite('SaleReceipt', saleReceipt.id, trx);
  }

  @OnEvent(events.saleReceipt.onDeleted)
  async onSaleReceiptDeleted({ oldSaleReceipt, trx }: DocumentPayload) {
    await this.remove('SaleReceipt', oldSaleReceipt.id, trx);
  }

  @OnEvent(events.creditNote.onCreated)
  @OnEvent(events.creditNote.onEdited)
  async onCreditNoteSaved({ creditNote, trx }: DocumentPayload) {
    await this.rewrite('CreditNote', creditNote.id, trx);
  }

  @OnEvent(events.creditNote.onDeleted)
  async onCreditNoteDeleted({ oldCreditNote, trx }: DocumentPayload) {
    await this.remove('CreditNote', oldCreditNote.id, trx);
  }

  @OnEvent(events.vendorCredit.onCreated)
  @OnEvent(events.vendorCredit.onEdited)
  async onVendorCreditSaved({ vendorCredit, trx }: DocumentPayload) {
    await this.rewrite('VendorCredit', vendorCredit.id, trx);
  }

  @OnEvent(events.vendorCredit.onDeleted)
  async onVendorCreditDeleted({ oldVendorCredit, trx }: DocumentPayload) {
    await this.remove('VendorCredit', oldVendorCredit.id, trx);
  }

  @OnEvent(events.saleEstimate.onCreated)
  @OnEvent(events.saleEstimate.onEdited)
  async onSaleEstimateSaved({ saleEstimate, trx }: DocumentPayload) {
    await this.rewrite('SaleEstimate', saleEstimate.id, trx);
  }

  @OnEvent(events.expenses.onCreated)
  @OnEvent(events.expenses.onEdited)
  async onExpenseSaved({ expense, trx }: DocumentPayload) {
    await this.extendedDocumentsTax.rewriteExpenseTaxTransactions(
      expense.id,
      expense.categories || [],
      trx,
    );
  }

  @OnEvent(events.expenses.onDeleted)
  async onExpenseDeleted({ oldExpense, trx }: DocumentPayload) {
    await this.remove('Expense', oldExpense.id, trx);
  }

  @OnEvent(events.saleEstimate.onDeleted)
  async onSaleEstimateDeleted({ oldSaleEstimate, trx }: DocumentPayload) {
    await this.remove('SaleEstimate', oldSaleEstimate.id, trx);
  }
}
