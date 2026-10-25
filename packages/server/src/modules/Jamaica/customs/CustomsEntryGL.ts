import { AccountNormal } from '@/modules/Accounts/Accounts.types';
import { Ledger } from '@/modules/Ledger/Ledger';
import { ILedgerEntry } from '@/modules/Ledger/types/Ledger.types';
import { CustomsEntry } from './models/CustomsEntry.model';

/**
 * The taxes paid on a customs entry: Dr import GCT (input tax) and advance
 * GCT, Cr the payment account. The duties and fees post through the
 * entry's expense instead, so they can be allocated to inventory.
 */
export class CustomsEntryGL {
  private inputTaxAccountId: number;
  private advanceGctAccountId: number;
  private currencyCode: string;
  private paymentAccountNormal: string = AccountNormal.DEBIT;

  constructor(private readonly entry: CustomsEntry) {}

  setInputTaxAccountId(accountId: number) {
    this.inputTaxAccountId = accountId;
    return this;
  }

  setAdvanceGctAccountId(accountId: number) {
    this.advanceGctAccountId = accountId;
    return this;
  }

  setCurrencyCode(currencyCode: string) {
    this.currencyCode = currencyCode;
    return this;
  }

  setPaymentAccountNormal(accountNormal: string) {
    this.paymentAccountNormal = accountNormal;
    return this;
  }

  private get commonEntry() {
    return {
      currencyCode: this.currencyCode,
      exchangeRate: 1,
      transactionType: 'CustomsEntry',
      transactionId: this.entry.id,
      transactionNumber: this.entry.entryNumber,
      referenceNumber: this.entry.referenceNo,
      date: this.entry.entryDate,
      userId: this.entry.userId,
      debit: 0,
      credit: 0,
    };
  }

  /**
   * @returns {ILedgerEntry[]}
   */
  public getEntries(): ILedgerEntry[] {
    const importGct = Number(this.entry.importGctAmount) || 0;
    const advanceGct = Number(this.entry.advanceGctAmount) || 0;
    const total = importGct + advanceGct;

    if (total <= 0) return [];

    return [
      {
        ...this.commonEntry,
        credit: total,
        accountId: this.entry.paymentAccountId,
        accountNormal: this.paymentAccountNormal,
        index: 1,
      },
      ...(importGct > 0
        ? [
            {
              ...this.commonEntry,
              debit: importGct,
              accountId: this.inputTaxAccountId,
              accountNormal: AccountNormal.DEBIT,
              note: 'Import GCT',
              index: 2,
            },
          ]
        : []),
      ...(advanceGct > 0
        ? [
            {
              ...this.commonEntry,
              debit: advanceGct,
              accountId: this.advanceGctAccountId,
              accountNormal: AccountNormal.DEBIT,
              note: 'Advance GCT',
              index: 3,
            },
          ]
        : []),
    ];
  }

  public getLedger(): Ledger {
    return new Ledger(this.getEntries());
  }
}
