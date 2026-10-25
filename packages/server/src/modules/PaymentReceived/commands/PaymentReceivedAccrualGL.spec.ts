import { PaymentReceivedAccrualGL } from './PaymentReceivedAccrualGL';
import { PaymentReceived } from '../models/PaymentReceived';

const buildPayment = (attrs: Partial<PaymentReceived> = {}) =>
  PaymentReceived.fromJson({
    id: 1,
    paymentReceiveNo: 'PAY-00001',
    paymentDate: '2024-01-01',
    currencyCode: 'JMD',
    exchangeRate: 1,
    amount: 1000,
    depositAccountId: 100,
    customerId: 5,
    entries: [],
    ...attrs,
  } as any);

const buildGL = (payment: PaymentReceived) =>
  new PaymentReceivedAccrualGL(payment)
    .setARAccountId(200)
    .setExchangeGainOrLossAccountId(300)
    .setWithholdingTaxAccountId(600)
    .setBaseCurrencyCode('JMD');

const sumOf = (entries: any[], accountId: number, field: 'debit' | 'credit') =>
  entries
    .filter((entry) => entry.accountId === accountId)
    .reduce((total, entry) => total + entry[field], 0);

describe('PaymentReceivedAccrualGL', () => {
  it('deposits the full amount without withholding tax', () => {
    const entries = buildGL(buildPayment()).GLEntries();

    expect(entries).toHaveLength(2);
    expect(sumOf(entries, 100, 'debit')).toBe(1000);
    expect(sumOf(entries, 200, 'credit')).toBe(1000);
  });

  it('splits the debit between the deposit and the withheld tax', () => {
    const entries = buildGL(
      buildPayment({ withholdingTaxAmount: 30 }),
    ).GLEntries();

    expect(sumOf(entries, 100, 'debit')).toBe(970);
    expect(sumOf(entries, 600, 'debit')).toBe(30);
    expect(sumOf(entries, 200, 'credit')).toBe(1000);
  });

  it('converts the withheld tax at the exchange rate', () => {
    const entries = buildGL(
      buildPayment({
        currencyCode: 'USD',
        exchangeRate: 150,
        amount: 100,
        withholdingTaxAmount: 3,
      }),
    ).GLEntries();

    expect(sumOf(entries, 100, 'debit')).toBe(14550);
    expect(sumOf(entries, 600, 'debit')).toBe(450);
    expect(sumOf(entries, 200, 'credit')).toBe(15000);
  });
});
