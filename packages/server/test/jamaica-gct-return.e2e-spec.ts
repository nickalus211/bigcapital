import request = require('supertest');
import { faker } from '@faker-js/faker';
import { app, AuthorizationHeader, orgainzationId } from './init-app-test';

/**
 * The GCT return (M4) on the Jamaica organization. Each run posts its
 * documents into a random future month so reruns don't add up.
 */
const JM_EMAIL = process.env.E2E_JM_EMAIL || 'jm@example.com';
const JM_PASSWORD = process.env.E2E_JM_PASSWORD || '1231231230';

const jm = { organizationId: '', authorization: '' };

const jmRequest = (method: 'get' | 'post' | 'put' | 'delete', url: string) =>
  request(app.getHttpServer())
    [method](url)
    .set('organization-id', jm.organizationId)
    .set('Authorization', jm.authorization);

const year = 2100 + Math.floor(Math.random() * 800);
const date = `${year}-03-10`;
const period = { from_date: `${year}-03-01`, to_date: `${year}-03-31` };

const ids = { std: 0, zero: 0, exempt: 0, item: 0, customer: 0, vendor: 0 };
const accounts = { cash: 0, expense: 0 };

const line = (rate: number, taxRateId: number) => ({
  index: 1,
  itemId: ids.item,
  quantity: 1,
  rate,
  taxRateId,
});

const setApportionment = (value: boolean) =>
  jmRequest('put', '/jamaica/settings')
    .send({ apportionment_enabled: value })
    .expect(200);

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
    reason: 'Cancel lock for GCT return e2e test',
  });
  await jmRequest('put', '/jamaica/settings')
    .send({ gct_registered: true, gct_registration_number: 'GCT-000123' })
    .expect(200);

  const taxRates = (await jmRequest('get', '/tax-rates').expect(200)).body;
  const byCode = (code: string) => taxRates.find((r) => r.code === code).id;
  ids.std = byCode('GCT-STD');
  ids.zero = byCode('GCT-ZERO');
  ids.exempt = byCode('GCT-EXEMPT');

  const accountsList = (await jmRequest('get', '/accounts').expect(200)).body
    .accounts;
  const ofType = (type: string) =>
    accountsList.find((a) => a.account_type === type).id;
  accounts.cash = ofType('cash');
  accounts.expense = ofType('expense');

  ids.item = (
    await jmRequest('post', '/items')
      .send({
        name: `GR Service ${Date.now()}-${faker.string.alphanumeric(4)}`,
        type: 'service',
        sellable: true,
        purchasable: true,
        sellAccountId: ofType('income'),
        costAccountId: ofType('cost-of-goods-sold'),
      })
      .expect(201)
  ).body.id;
  ids.customer = (
    await jmRequest('post', '/customers')
      .send({
        displayName: `GR Customer ${Date.now()}`,
        customerType: 'business',
        currencyCode: 'JMD',
      })
      .expect(201)
  ).body.id;
  ids.vendor = (
    await jmRequest('post', '/vendors')
      .send({ displayName: `GR Vendor ${Date.now()}`, currencyCode: 'JMD' })
      .expect(201)
  ).body.id;

  const invoice = (entries: unknown[], delivered = true) =>
    jmRequest('post', '/sale-invoices')
      .send({
        customerId: ids.customer,
        invoiceDate: date,
        dueDate: date,
        invoiceNo: faker.string.uuid(),
        delivered,
        entries,
      })
      .expect(201);

  // Sales: 1,000 standard (GCT 150), 300 zero-rated, 400 exempt.
  await invoice([line(1000, ids.std)]);
  await invoice([line(300, ids.zero)]);
  await invoice([line(400, ids.exempt)]);
  // A draft invoice isn't a supply yet.
  await invoice([line(5000, ids.std)], false);

  // Credit note: 200 standard (GCT 30).
  await jmRequest('post', '/credit-notes')
    .send({
      customerId: ids.customer,
      creditNoteDate: date,
      open: true,
      entries: [line(200, ids.std)],
    })
    .expect(201);

  // Purchases: bill 400 (GCT 60), expense 115 incl. GCT 15.
  await jmRequest('post', '/bills')
    .send({
      vendorId: ids.vendor,
      billDate: date,
      dueDate: date,
      billNumber: faker.string.uuid(),
      open: true,
      entries: [line(400, ids.std)],
    })
    .expect(201);
  await jmRequest('post', '/expenses')
    .send({
      paymentDate: date,
      paymentAccountId: accounts.cash,
      publish: true,
      isInclusiveTax: true,
      categories: [
        {
          index: 1,
          expenseAccountId: accounts.expense,
          amount: 115,
          taxRateId: ids.std,
        },
      ],
    })
    .expect(201);
});

afterAll(() => setApportionment(false));

describe('GCT return (e2e)', () => {
  it('totals supplies by tax type, net of credit notes', async () => {
    await setApportionment(false);
    const res = await jmRequest('get', '/jamaica/gct-return')
      .query(period)
      .expect(200);

    expect(res.body.supplies).toMatchObject({
      standard_rated_amount: 800,
      zero_rated_amount: 300,
      exempt_amount: 400,
      total_amount: 1500,
    });
    expect(res.body.supplies.standard_rated).toEqual([
      expect.objectContaining({
        code: 'GCT-STD',
        taxable_amount: 800,
        tax_amount: 120,
      }),
    ]);
    expect(res.body.output_tax).toBe(120);
    expect(res.body.purchases.input_tax).toBe(75);
    expect(res.body.net_gct).toBe(45);
    expect(res.body.position).toBe('payable');
    // The last working day of April.
    expect(res.body.due_date.startsWith(`${year}-04-`)).toBe(true);
    expect(res.body.documents).toMatchObject({
      sale_invoices: 3,
      credit_notes: 1,
      bills: 1,
      expenses: 1,
    });
  });

  it('apportions input tax to taxable supplies', async () => {
    await setApportionment(true);
    const res = await jmRequest('get', '/jamaica/gct-return')
      .query(period)
      .expect(200);

    // Taxable 1,100 of 1,500 supplies: 73.33% of 75 input tax.
    expect(res.body.apportionment).toEqual({
      enabled: true,
      taxable_supplies_amount: 1100,
      total_supplies_amount: 1500,
      ratio: 0.7333,
      claimable_input_tax: 55,
      disallowed_input_tax: 20,
    });
    expect(res.body.net_gct).toBe(65);
  });

  it('is not available while the Jamaica feature is off', async () => {
    const res = await request(app.getHttpServer())
      .get('/jamaica/gct-return')
      .set('organization-id', orgainzationId)
      .set('Authorization', AuthorizationHeader);

    expect(res.status).not.toBe(200);
  });
});
