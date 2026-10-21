import request = require('supertest');
import { faker } from '@faker-js/faker';
import { app } from './init-app-test';

/**
 * The GCT engine (M2) on the Jamaica organization, whose setup turned on
 * `tax.calc_after_discount` and `tax.extended_documents` and pointed the
 * output and input tax at the GCT accounts. See docs/setup/local-mamp.md
 * for building the `jm@example.com` organization.
 */
const JM_EMAIL = process.env.E2E_JM_EMAIL || 'jm@example.com';
const JM_PASSWORD = process.env.E2E_JM_PASSWORD || '1231231230';

const jm = { organizationId: '', authorization: '' };

const jmRequest = (method: 'get' | 'post' | 'put' | 'delete', url: string) =>
  request(app.getHttpServer())
    [method](url)
    .set('organization-id', jm.organizationId)
    .set('Authorization', jm.authorization);

interface Leg {
  accountId: number;
  debit: number;
  credit: number;
}

const amount = (value: any) => Number(value?.amount ?? value ?? 0);

const fetchLegs = async (referenceType: string, referenceId: number) => {
  const res = await jmRequest('get', '/reports/transactions-by-reference')
    .query({ referenceType, referenceId })
    .expect(200);

  return res.body.transactions.map((t) => ({
    accountId: t.account_id,
    debit: amount(t.debit),
    credit: amount(t.credit),
  })) as Leg[];
};

const expectBalanced = (legs: Leg[]) => {
  const debits = legs.reduce((sum, leg) => sum + leg.debit, 0);
  const credits = legs.reduce((sum, leg) => sum + leg.credit, 0);

  expect(debits).toBeCloseTo(credits, 2);
};

/** Net movement (debit − credit) on the account. */
const netOn = (legs: Leg[], accountId: number) =>
  legs
    .filter((leg) => leg.accountId === accountId)
    .reduce((sum, leg) => sum + leg.debit - leg.credit, 0);

const setTaxOption = (key: string, value: boolean) =>
  jmRequest('put', '/settings')
    .send({ options: [{ group: 'tax', key, value }] })
    .expect(200);

const ids = {
  gct: 0,
  outputTax: 0,
  inputTax: 0,
  customer: 0,
  vendor: 0,
  item: 0,
  cash: 0,
  expense: 0,
};

beforeAll(async () => {
  const signin = await request(app.getHttpServer())
    .post('/auth/signin')
    .send({ email: JM_EMAIL, password: JM_PASSWORD });

  if (signin.status !== 201) {
    throw new Error(
      `Sign in as ${JM_EMAIL} failed. Build a Jamaica (JM) organization for it first.`,
    );
  }
  jm.organizationId = signin.body.organization_id;
  jm.authorization = `Bearer ${signin.body.access_token}`;

  await jmRequest('put', '/transactions-locking/cancel-lock').send({
    reason: 'Cancel lock for GCT e2e test',
  });

  const taxRates = await jmRequest('get', '/tax-rates').expect(200);
  ids.gct = taxRates.body.find((r) => r.code === 'GCT-STD').id;

  const accounts = (await jmRequest('get', '/accounts').expect(200)).body
    .accounts;
  const bySlug = (slug: string) => accounts.find((a) => a.slug === slug).id;
  ids.outputTax = bySlug('tax-payable');
  ids.inputTax = bySlug('gct-input-tax');
  ids.cash = accounts.find((a) => a.account_type === 'cash').id;
  ids.expense = accounts.find((a) => a.account_type === 'expense').id;
  const income = accounts.find((a) => a.account_type === 'income').id;
  const cost = accounts.find((a) => a.account_type === 'cost-of-goods-sold').id;

  ids.customer = (
    await jmRequest('post', '/customers')
      .send({
        displayName: `GCT Customer ${Date.now()}`,
        customerType: 'business',
        currencyCode: 'JMD',
      })
      .expect(201)
  ).body.id;

  ids.vendor = (
    await jmRequest('post', '/vendors')
      .send({ displayName: `GCT Vendor ${Date.now()}`, currencyCode: 'JMD' })
      .expect(201)
  ).body.id;

  ids.item = (
    await jmRequest('post', '/items')
      .send({
        name: `GCT Service ${Date.now()}-${faker.string.alphanumeric(4)}`,
        type: 'service',
        sellable: true,
        purchasable: true,
        sellAccountId: income,
        costAccountId: cost,
        sellPrice: 100,
        costPrice: 100,
        sellTaxRateId: ids.gct,
        purchaseTaxRateId: ids.gct,
      })
      .expect(201)
  ).body.id;
});

/** Two lines: 2 × 100 less 10% at GCT, and 1 × 50 untaxed. */
const lines = () => [
  {
    index: 1,
    itemId: ids.item,
    quantity: 2,
    rate: 100,
    discount: 10,
    taxRateId: ids.gct,
  },
  { index: 2, itemId: ids.item, quantity: 1, rate: 50, taxRateId: null },
];

describe('GCT on invoices and bills (e2e)', () => {
  it('charges GCT after line and document discounts', async () => {
    const created = await jmRequest('post', '/sale-invoices')
      .send({
        customerId: ids.customer,
        invoiceDate: '2026-10-01',
        dueDate: '2026-10-31',
        invoiceNo: faker.string.uuid(),
        delivered: true,
        discountType: 'amount',
        discount: 23,
        entries: lines(),
      })
      .expect(201);

    const res = await jmRequest(
      'get',
      `/sale-invoices/${created.body.id}`,
    ).expect(200);

    // Lines net 180 + 50 = 230; the 23 discount takes 10% off each line.
    // GCT: 180 × 0.9 × 15% = 24.30.
    expect(res.body.subtotal).toBe(230);
    expect(res.body.tax_amount_withheld).toBeCloseTo(24.3, 2);
    expect(res.body.total).toBeCloseTo(230 - 23 + 24.3, 2);
    expect(res.body.entries[0]).toMatchObject({
      taxable_amount: 162,
      line_tax_amount: 24.3,
    });
    expect(res.body.taxes).toHaveLength(1);
    expect(res.body.taxes[0].tax_rate_amount).toBeCloseTo(24.3, 2);

    const legs = await fetchLegs('SaleInvoice', created.body.id);
    expectBalanced(legs);
    expect(netOn(legs, ids.outputTax)).toBeCloseTo(-24.3, 2);
  });

  it('resets the stored GCT when an edit removes the tax', async () => {
    const body = {
      customerId: ids.customer,
      invoiceDate: '2026-10-01',
      dueDate: '2026-10-31',
      invoiceNo: faker.string.uuid(),
      delivered: true,
      entries: lines(),
    };
    const created = await jmRequest('post', '/sale-invoices')
      .send(body)
      .expect(201);

    await jmRequest('put', `/sale-invoices/${created.body.id}`)
      .send({
        ...body,
        entries: lines().map((line) => ({ ...line, taxRateId: null })),
      })
      .expect(200);

    const res = await jmRequest(
      'get',
      `/sale-invoices/${created.body.id}`,
    ).expect(200);

    expect(res.body.tax_amount_withheld).toBe(0);
    expect(res.body.total).toBe(230);
  });

  it('posts bill GCT to the input tax account', async () => {
    const created = await jmRequest('post', '/bills')
      .send({
        vendorId: ids.vendor,
        billDate: '2026-10-01',
        dueDate: '2026-10-31',
        billNumber: faker.string.uuid(),
        open: true,
        entries: lines(),
      })
      .expect(201);

    const legs = await fetchLegs('Bill', created.body.id);
    expectBalanced(legs);
    expect(netOn(legs, ids.inputTax)).toBeCloseTo(27, 2);
    expect(netOn(legs, ids.outputTax)).toBeCloseTo(0, 2);
  });
});

describe('GCT on the extended documents (e2e)', () => {
  it('taxes sale receipts', async () => {
    const created = await jmRequest('post', '/sale-receipts')
      .send({
        customerId: ids.customer,
        depositAccountId: ids.cash,
        receiptDate: '2026-10-02',
        closed: true,
        entries: lines(),
      })
      .expect(201);

    const res = await jmRequest(
      'get',
      `/sale-receipts/${created.body.id}`,
    ).expect(200);

    expect(res.body.tax_amount_withheld).toBeCloseTo(27, 2);
    expect(res.body.total).toBeCloseTo(257, 2);
    expect(res.body.taxes[0].tax_rate_amount).toBeCloseTo(27, 2);

    const legs = await fetchLegs('SaleReceipt', created.body.id);
    expectBalanced(legs);
    expect(netOn(legs, ids.cash)).toBeCloseTo(257, 2);
    expect(netOn(legs, ids.outputTax)).toBeCloseTo(-27, 2);
  });

  it('taxes credit notes and credits their total', async () => {
    const created = await jmRequest('post', '/credit-notes')
      .send({
        customerId: ids.customer,
        creditNoteDate: '2026-10-02',
        open: true,
        entries: lines(),
      })
      .expect(201);

    const res = await jmRequest(
      'get',
      `/credit-notes/${created.body.id}`,
    ).expect(200);

    expect(res.body.total).toBeCloseTo(257, 2);
    expect(res.body.credits_remaining).toBeCloseTo(257, 2);

    const legs = await fetchLegs('CreditNote', created.body.id);
    expectBalanced(legs);
    expect(netOn(legs, ids.outputTax)).toBeCloseTo(27, 2);
  });

  it('extracts inclusive GCT from vendor credits', async () => {
    const created = await jmRequest('post', '/vendor-credits')
      .send({
        vendorId: ids.vendor,
        vendorCreditDate: '2026-10-02',
        open: true,
        isInclusiveTax: true,
        entries: [
          {
            index: 1,
            itemId: ids.item,
            quantity: 1,
            rate: 115,
            taxRateId: ids.gct,
          },
        ],
      })
      .expect(201);

    const res = await jmRequest(
      'get',
      `/vendor-credits/${created.body.id}`,
    ).expect(200);

    expect(res.body.is_inclusive_tax).toBeTruthy();
    expect(res.body.tax_amount_withheld).toBeCloseTo(15, 2);
    expect(res.body.total).toBeCloseTo(115, 2);

    const legs = await fetchLegs('VendorCredit', created.body.id);
    expectBalanced(legs);
    expect(netOn(legs, ids.inputTax)).toBeCloseTo(-15, 2);
  });

  it('taxes estimates', async () => {
    const created = await jmRequest('post', '/sale-estimates')
      .send({
        customerId: ids.customer,
        estimateDate: '2026-10-02',
        expirationDate: '2026-11-02',
        entries: lines(),
      })
      .expect(201);

    const res = await jmRequest(
      'get',
      `/sale-estimates/${created.body.id}`,
    ).expect(200);

    expect(res.body.tax_amount_withheld).toBeCloseTo(27, 2);
    expect(res.body.total).toBeCloseTo(257, 2);
  });

  it('extracts inclusive GCT from expense lines', async () => {
    const created = await jmRequest('post', '/expenses')
      .send({
        paymentDate: '2026-10-02',
        paymentAccountId: ids.cash,
        publish: true,
        isInclusiveTax: true,
        categories: [
          {
            index: 1,
            expenseAccountId: ids.expense,
            amount: 1150,
            taxRateId: ids.gct,
          },
          { index: 2, expenseAccountId: ids.expense, amount: 100 },
        ],
      })
      .expect(201);

    const res = await jmRequest('get', `/expenses/${created.body.id}`).expect(
      200,
    );

    expect(res.body.total_amount).toBeCloseTo(1250, 2);
    expect(res.body.tax_amount_withheld).toBeCloseTo(150, 2);
    expect(res.body.categories[0]).toMatchObject({
      taxable_amount: 1000,
      line_tax_amount: 150,
    });

    const legs = await fetchLegs('Expense', created.body.id);
    expectBalanced(legs);
    expect(netOn(legs, ids.cash)).toBeCloseTo(-1250, 2);
    expect(netOn(legs, ids.inputTax)).toBeCloseTo(150, 2);
  });
});

describe('Default tax rate from the item (e2e)', () => {
  afterAll(() => setTaxOption('default_from_item', false));

  const createInvoice = (entries: Array<Record<string, unknown>>) =>
    jmRequest('post', '/sale-invoices')
      .send({
        customerId: ids.customer,
        invoiceDate: '2026-10-03',
        dueDate: '2026-10-31',
        invoiceNo: faker.string.uuid(),
        delivered: true,
        entries,
      })
      .expect(201);

  it('leaves lines without a rate untaxed while the setting is off', async () => {
    const created = await createInvoice([
      { index: 1, itemId: ids.item, quantity: 1, rate: 100 },
    ]);
    expect(created.body.entries[0].tax_rate_id ?? null).toBeNull();
  });

  it('fills only the lines that omit a rate while the setting is on', async () => {
    await setTaxOption('default_from_item', true);

    const created = await createInvoice([
      { index: 1, itemId: ids.item, quantity: 1, rate: 100 },
      { index: 2, itemId: ids.item, quantity: 1, rate: 100, taxRateId: null },
    ]);
    const [omitted, explicitNull] = created.body.entries;

    expect(omitted.tax_rate_id).toBe(ids.gct);
    expect(explicitNull.tax_rate_id ?? null).toBeNull();
    expect(created.body.tax_amount_withheld).toBeCloseTo(15, 2);
  });
});
