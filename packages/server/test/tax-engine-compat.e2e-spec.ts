import request = require('supertest');
import { faker } from '@faker-js/faker';
import { app } from './init-app-test';
import {
  authHeaders,
  cancelTransactionsLock,
  createCustomer,
  createServiceItem,
  createTaxRate,
  expectBalanced,
  fetchLegs,
  getBaseCurrency,
} from './_utils/gl';

/**
 * The shared organization never turns the `tax.*` settings on, so these
 * cases pin the upstream behaviour M2 must keep, plus the two fixes that
 * apply to every tenant.
 */
describe('Tax engine backward compatibility (e2e)', () => {
  let customerId: number;
  let itemId: number;
  let taxRate10: number;

  beforeAll(async () => {
    await cancelTransactionsLock();

    customerId = await createCustomer(await getBaseCurrency());
    itemId = await createServiceItem();
    taxRate10 = await createTaxRate(10);
  });

  const createInvoice = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/sale-invoices')
      .set(authHeaders())
      .send({
        customerId,
        invoiceDate: '2023-01-01',
        dueDate: '2023-02-01',
        invoiceNo: faker.string.uuid(),
        delivered: true,
        branchId: 1,
        warehouseId: 1,
        ...body,
      })
      .expect(201);

  it('keeps tax on the amount before the line discount', async () => {
    const created = await createInvoice({
      entries: [
        {
          index: 1,
          itemId,
          quantity: 1,
          rate: 100,
          discount: 10,
          taxRateId: taxRate10,
        },
      ],
    });
    const res = await request(app.getHttpServer())
      .get(`/sale-invoices/${created.body.id}`)
      .set(authHeaders())
      .expect(200);

    expect(res.body.tax_amount_withheld).toBe(10);
    expect(res.body.entries[0].line_tax_amount ?? null).toBeNull();
  });

  it('posts a balanced journal for an invoice with a line discount', async () => {
    const created = await createInvoice({
      entries: [{ index: 1, itemId, quantity: 2, rate: 100, discount: 10 }],
    });
    expect(created.body.balance).toBe(180);

    const legs = await fetchLegs('SaleInvoice', created.body.id);
    expectBalanced(legs);
  });

  it('sums the tax line from the lines charged at that rate', async () => {
    const created = await createInvoice({
      entries: [
        { index: 1, itemId, quantity: 1, rate: 100, taxRateId: taxRate10 },
        { index: 2, itemId, quantity: 1, rate: 300 },
      ],
    });
    const res = await request(app.getHttpServer())
      .get(`/sale-invoices/${created.body.id}`)
      .set(authHeaders())
      .expect(200);

    expect(res.body.taxes).toHaveLength(1);
    expect(res.body.taxes[0].tax_rate_amount).toBe(10);
  });

  it('ignores tax on sale receipts while extended documents are off', async () => {
    const accounts = await request(app.getHttpServer())
      .get('/accounts')
      .set(authHeaders())
      .expect(200);
    const cash = accounts.body.accounts.find((a) => a.account_type === 'cash');

    const created = await request(app.getHttpServer())
      .post('/sale-receipts')
      .set(authHeaders())
      .send({
        customerId,
        depositAccountId: cash.id,
        receiptDate: '2023-01-01',
        closed: true,
        branchId: 1,
        warehouseId: 1,
        isInclusiveTax: true,
        entries: [
          { index: 1, itemId, quantity: 1, rate: 100, taxRateId: taxRate10 },
        ],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/sale-receipts/${created.body.id}`)
      .set(authHeaders())
      .expect(200);

    expect(res.body.total).toBe(100);
    expect(res.body.tax_amount_withheld ?? null).toBeNull();
    expect(res.body.is_inclusive_tax).toBeFalsy();
    expect(res.body.taxes).toEqual([]);

    const legs = await fetchLegs('SaleReceipt', created.body.id);
    expectBalanced(legs);
    expect(
      legs.filter((leg) => leg.debit.amount || leg.credit.amount),
    ).toHaveLength(2);
  });
});
