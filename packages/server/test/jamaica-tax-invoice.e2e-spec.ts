import request = require('supertest');
import { faker } from '@faker-js/faker';
import { app } from './init-app-test';

/**
 * Tax Invoices (M3) on the Jamaica organization: compliance warnings and the
 * Tax Invoice PDF. The suite registers the organization for GCT and sets its
 * TRN and address itself. See docs/setup/local-mamp.md for `jm@example.com`.
 */
const JM_EMAIL = process.env.E2E_JM_EMAIL || 'jm@example.com';
const JM_PASSWORD = process.env.E2E_JM_PASSWORD || '1231231230';

const jm = { organizationId: '', authorization: '' };

const jmRequest = (method: 'get' | 'post' | 'put' | 'delete', url: string) =>
  request(app.getHttpServer())
    [method](url)
    .set('organization-id', jm.organizationId)
    .set('Authorization', jm.authorization);

const ids = { gct: 0, zero: 0, item: 0 };

const createCustomer = async (attrs: Record<string, unknown> = {}) =>
  (
    await jmRequest('post', '/customers')
      .send({
        displayName: `TI Customer ${Date.now()}-${faker.string.alphanumeric(4)}`,
        customerType: 'business',
        currencyCode: 'JMD',
        ...attrs,
      })
      .expect(201)
  ).body.id;

const createInvoice = (customerId: number, entries: unknown[]) =>
  jmRequest('post', '/sale-invoices')
    .send({
      customerId,
      invoiceDate: '2026-10-05',
      dueDate: '2026-11-05',
      invoiceNo: faker.string.uuid(),
      delivered: true,
      entries,
    })
    .expect(201);

const codes = (warnings: Array<{ code: string }>) =>
  warnings.map((warning) => warning.code);

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
    reason: 'Cancel lock for Tax Invoice e2e test',
  });
  await jmRequest('put', '/jamaica/settings')
    .send({ gct_registered: true, gct_registration_number: 'GCT-000123' })
    .expect(200);
  await jmRequest('put', '/organization')
    .send({
      tax_number: '123456789',
      address: { address1: '12 Duke Street', city: 'Kingston' },
    })
    .expect(200);

  const taxRates = (await jmRequest('get', '/tax-rates').expect(200)).body;
  ids.gct = taxRates.find((r) => r.code === 'GCT-STD').id;
  ids.zero = taxRates.find((r) => r.code === 'GCT-ZERO').id;

  const accounts = (await jmRequest('get', '/accounts').expect(200)).body
    .accounts;
  ids.item = (
    await jmRequest('post', '/items')
      .send({
        name: `TI Service ${Date.now()}-${faker.string.alphanumeric(4)}`,
        type: 'service',
        sellable: true,
        sellAccountId: accounts.find((a) => a.account_type === 'income').id,
        sellPrice: 100,
      })
      .expect(201)
  ).body.id;
});

describe('Tax Invoice compliance warnings (e2e)', () => {
  it('returns the warnings with the created and the fetched invoice', async () => {
    const customerId = await createCustomer();
    const created = await createInvoice(customerId, [
      {
        index: 1,
        itemId: ids.item,
        quantity: 1,
        rate: 100,
        taxRateId: ids.gct,
      },
      { index: 2, itemId: ids.item, quantity: 1, rate: 50 },
    ]);
    const expected = [
      'CUSTOMER_ADDRESS_MISSING',
      'CUSTOMER_TRN_MISSING',
      'LINE_TAX_RATE_MISSING',
    ];
    expect(codes(created.body.compliance_warnings)).toEqual(expected);

    const fetched = await jmRequest(
      'get',
      `/sale-invoices/${created.body.id}`,
    ).expect(200);

    expect(codes(fetched.body.compliance_warnings)).toEqual(expected);
    expect(fetched.body.compliance_warnings[2].lines).toEqual([2]);
  });

  it('returns no warnings for a compliant tax invoice', async () => {
    const customerId = await createCustomer({
      taxNumber: '987-654-321',
      billingAddress1: '5 Hope Road',
    });
    const created = await createInvoice(customerId, [
      {
        index: 1,
        itemId: ids.item,
        quantity: 1,
        rate: 100,
        taxRateId: ids.gct,
      },
      {
        index: 2,
        itemId: ids.item,
        quantity: 1,
        rate: 50,
        taxRateId: ids.zero,
      },
    ]);
    expect(created.body.compliance_warnings).toEqual([]);
  });

  it('flags an invalid customer TRN', async () => {
    const customerId = await createCustomer({
      taxNumber: '12345',
      billingAddress1: '5 Hope Road',
    });
    const created = await createInvoice(customerId, [
      {
        index: 1,
        itemId: ids.item,
        quantity: 1,
        rate: 100,
        taxRateId: ids.gct,
      },
    ]);
    expect(codes(created.body.compliance_warnings)).toEqual([
      'CUSTOMER_TRN_INVALID',
    ]);
  });
});

describe('Tax Invoice PDF (e2e)', () => {
  it('prints the title, the TRNs and each line GCT', async () => {
    const customerId = await createCustomer({
      taxNumber: '987654321',
      billingAddress1: '5 Hope Road',
    });
    const created = await createInvoice(customerId, [
      {
        index: 1,
        itemId: ids.item,
        quantity: 2,
        rate: 100,
        discount: 10,
        taxRateId: ids.gct,
      },
    ]);
    const res = await jmRequest(
      'get',
      `/sale-invoices/${created.body.id}/html`,
    ).expect(200);
    const html = res.text;

    expect(html).toContain('Tax Invoice');
    expect(html).toContain('TRN: 123-456-789');
    expect(html).toContain('GCT Reg. No.: GCT-000123');
    expect(html).toContain('TRN: 987-654-321');
    expect(html).toContain('Amount excl. GCT');
    expect(html).toContain('27.00');
  });

  it('prints the tax lines and the number on a taxed receipt', async () => {
    const accounts = (await jmRequest('get', '/accounts').expect(200)).body
      .accounts;
    const customerId = await createCustomer();
    const created = await jmRequest('post', '/sale-receipts')
      .send({
        customerId,
        depositAccountId: accounts.find((a) => a.account_type === 'cash').id,
        receiptDate: '2026-10-05',
        receiptNumber: `R-${Date.now()}`,
        closed: true,
        entries: [
          {
            index: 1,
            itemId: ids.item,
            quantity: 1,
            rate: 100,
            taxRateId: ids.gct,
          },
        ],
      })
      .expect(201);

    const res = await jmRequest('get', `/sale-receipts/${created.body.id}`)
      .set('accept', 'application/json+html')
      .expect(200);
    const html = res.body.html_content;

    expect(html).toContain('GCT Standard (15%)');
    expect(html).toContain('115.00');
    expect(html).toContain(created.body.receipt_number);
  });
});
