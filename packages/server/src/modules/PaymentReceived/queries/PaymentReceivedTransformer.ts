import { Transformer } from '../../Transformer/Transformer';
import { PaymentReceived } from '../models/PaymentReceived';
import { PaymentReceivedEntry } from '../models/PaymentReceivedEntry';
import { PaymentReceivedEntryTransfromer } from './PaymentReceivedEntryTransformer';
import { AttachmentTransformer } from '@/modules/Attachments/Attachment.transformer';

export class PaymentReceiveTransfromer extends Transformer {
  /**
   * Include these attributes to payment receive object.
   * @returns {Array}
   */
  public includeAttributes = (): string[] => {
    return [
      'subtotalFormatted',
      'formatttedTotal',
      'formattedPaymentDate',
      'formattedCreatedAt',
      'formattedAmount',
      'formattedExchangeRate',
      'formattedWithholdingTaxAmount',
      'formattedDepositAmount',
      'entries',
      'attachments',
    ];
  };

  /**
   * Retrieve formatted payment receive date.
   * @param {PaymentReceived} invoice
   * @returns {String}
   */
  protected formattedPaymentDate = (payment: PaymentReceived): string => {
    return this.formatDate(payment.paymentDate);
  };

  /**
   * Retrieves the formatted created at date.
   * @param {PaymentReceived} payment
   * @returns {string}
   */
  protected formattedCreatedAt = (payment: PaymentReceived): string => {
    return this.formatDate(payment.createdAt);
  };

  /**
   * Retrieve the formatted payment subtotal.
   * @param {PaymentReceived} payment
   * @returns {string}
   */
  protected subtotalFormatted = (payment: PaymentReceived): string => {
    return this.formatNumber(payment.amount, {
      currencyCode: payment.currencyCode,
    });
  };

  /**
   * Retrieves the formatted total.
   * @param {PaymentReceived} payment
   * @returns {string}
   */
  protected formatttedTotal = (payment: PaymentReceived): string => {
    return this.formatNumber(payment.amount, {
      currencyCode: payment.currencyCode,
      money: true,
    });
  };

  /**
   * Retrieve formatted payment amount.
   * @param {PaymentReceived} invoice
   * @returns {string}
   */
  protected formattedAmount = (payment: PaymentReceived): string => {
    return this.formatNumber(payment.amount, {
      currencyCode: payment.currencyCode,
    });
  };

  /**
   * Retrieves the formatted tax the customer withheld, empty when none.
   * @param {PaymentReceived} payment
   * @returns {string}
   */
  protected formattedWithholdingTaxAmount = (
    payment: PaymentReceived,
  ): string => {
    if (!payment.withholdingTaxAmount) return '';

    return this.formatNumber(payment.withholdingTaxAmount, {
      currencyCode: payment.currencyCode,
    });
  };

  /**
   * Retrieves the formatted amount deposited (amount less withheld tax).
   * @param {PaymentReceived} payment
   * @returns {string}
   */
  protected formattedDepositAmount = (payment: PaymentReceived): string => {
    return this.formatNumber(payment.depositAmount, {
      currencyCode: payment.currencyCode,
    });
  };

  /**
   * Retrieve the formatted exchange rate.
   * @param   {PaymentReceived} payment
   * @returns {string}
   */
  protected formattedExchangeRate = (payment: PaymentReceived): string => {
    return this.formatNumber(payment.exchangeRate);
  };

  /**
   * Retrieves the payment entries.
   * @param {PaymentReceived} payment
   * @returns {IPaymentReceivedEntry[]}
   */
  protected entries = (payment: PaymentReceived): PaymentReceivedEntry[] => {
    return this.item(payment.entries, new PaymentReceivedEntryTransfromer());
  };

  /**
   * Retrieves the payment received attachments.
   * @param {PaymentReceived} payment
   * @returns
   */
  protected attachments = (payment: PaymentReceived) => {
    return this.item(payment.attachments, new AttachmentTransformer());
  };
}
