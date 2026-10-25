import request = require('supertest');
import { faker } from '@faker-js/faker';
import { app, AuthorizationHeader, orgainzationId } from './init-app-test';

/**
 * Withholding tax on payments received and WHT certificates (M5) on the
 * Jamaica organization. Each run uses a random future tax year so reruns
 * don't add up.
 */
const JM_EMAIL = process.env.E2E_JM_EMAIL || 'jm@example.com';
const JM_PASSWORD = process.env.E2E_JM_PASSWORD || '1231231230';

const jm = { organizationId: '', authorization: '' };

const jmRequest = (method: 'get' | 'post' | 'put' | 'delete', url: string) =>
  request(app.getHttpServer())
    [method](url)
    .set('organization-id', jm.organizationId)
    .set('Authorization', jm.authorization);

const usRequest = (method: 'get' | 'post' | 'put' | 'delete', url: string) =>
  request(app.getHttpServer())
    [method](url)
    .set('organization-id', orgainzationId)
    .set('Authorization', AuthorizationHeader);

const year = 2100 + Math.floor(Math.random() * 800);
const ids = { customer: 0, otherCustomer: 0, item: 0, invoice: 0, payment: 0 };
const accounts = { cash: 0, receivable: 0, wht: 0 };

const amount = (value: any) => Number(value?.amount ?? value ?? 0);

const fetchLegs = async (referenceId: number) => {
  const res = await jmRequest('get', '/reports/transactions-by-reference')
    .query({ referenceType: 'PaymentReceive', referenceId })
    .expect(200);

  return res.body.transactions.map((t) => ({
    accountId: t.account_id,
    debit: amount(t.debit),
    credit: amount(t.credit),
  }));
};

const netOn = (legs: any[], accountId: number) =>
  legs
    .filter((leg) => leg.accountId === accountId)
    .reduce((sum, leg) => sum + leg.debit - leg.credit, 0);

const createInvoice = async (customerId: number, rate: number) =>
  (
    await jmRequest('post', '/sale-invoices')
      .send({
        customerId,
        invoiceDate: `${year}-05-10`,
        dueDate: `${year}-06-10`,
        delivered: true,
        entries: [{ index: 1, itemId: ids.item, quantity: 1, rate }],
      })
      .expect(201)
  ).body.id;

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
    reason: 'Cancel lock for withholding tax e2e test',
  });
  // Sets tax.withholding_account_id on organizations set up before M5.
  await jmRequest('post', '/jamaica/setup').send({}).expect(201);

  const accountsList = (await jmRequest('get', '/accounts').expect(200)).body
    .accounts;
  const ofType = (type: string) =>
    accountsList.find((a) => a.account_type === type).id;
  accounts.cash = ofType('cash');
  accounts.receivable = ofType('accounts-receivable');
  accounts.wht = accountsList.find((a) => a.slug === 'wht-receivable').id;

  const customer = (name: string) =>
    jmRequest('post', '/customers')
      .send({
        displayName: `${name} ${faker.string.alphanumeric(6)}`,
        customerType: 'business',
        currencyCode: 'JMD',
      })
      .expect(201);
  ids.customer = (await customer('WHT Customer')).body.id;
  ids.otherCustomer = (await customer('WHT Other')).body.id;

  ids.item = (
    await jmRequest('post', '/items')
      .send({
        name: `WHT Service ${Date.now()}-${faker.string.alphanumeric(4)}`,
        type: 'service',
        sellable: true,
        sellAccountId: ofType('income'),
      })
      .expect(201)
  ).body.id;
  ids.invoice = await createInvoice(ids.customer, 10000);
});

describe('Jamaica withholding tax (e2e)', () => {
  it('deposits the amount less the withheld tax', async () => {
    const res = await jmRequest('post', '/payments-received')
      .send({
        customerId: ids.customer,
        paymentDate: `${year}-05-20`,
        depositAccountId: accounts.cash,
        amount: 10000,
        withholdingTaxAmount: 300,
        entries: [{ index: 1, invoiceId: ids.invoice, paymentAmount: 10000 }],
      })
      .expect(201);
    ids.payment = res.body.id;

    const payment = (
      await jmRequest('get', `/payments-received/${ids.payment}`).expect(200)
    ).body;
    expect(payment.withholding_tax_amount).toBe(300);
    expect(payment.deposit_amount).toBe(9700);
    expect(payment.formatted_withholding_tax_amount).toBe('300.00');

    const legs = await fetchLegs(ids.payment);
    expect(netOn(legs, accounts.cash)).toBeCloseTo(9700, 2);
    expect(netOn(legs, accounts.wht)).toBeCloseTo(300, 2);
    expect(netOn(legs, accounts.receivable)).toBeCloseTo(-10000, 2);

    // The invoice is paid in full.
    const invoice = (
      await jmRequest('get', `/sale-invoices/${ids.invoice}`).expect(200)
    ).body;
    expect(Number(invoice.payment_amount)).toBe(10000);
  });

  it('keeps the withheld tax when an edit omits it, clears it with 0', async () => {
    const body = {
      customerId: ids.customer,
      paymentDate: `${year}-05-20`,
      depositAccountId: accounts.cash,
      amount: 10000,
      entries: [{ index: 1, invoiceId: ids.invoice, paymentAmount: 10000 }],
    };
    await jmRequest('put', `/payments-received/${ids.payment}`)
      .send(body)
      .expect(200);
    let payment = (
      await jmRequest('get', `/payments-received/${ids.payment}`).expect(200)
    ).body;
    expect(payment.withholding_tax_amount).toBe(300);

    await jmRequest('put', `/payments-received/${ids.payment}`)
      .send({ ...body, withholdingTaxAmount: 0 })
      .expect(200);
    payment = (
      await jmRequest('get', `/payments-received/${ids.payment}`).expect(200)
    ).body;
    expect(payment.deposit_amount).toBe(10000);
    expect(netOn(await fetchLegs(ids.payment), accounts.wht)).toBe(0);

    await jmRequest('put', `/payments-received/${ids.payment}`)
      .send({ ...body, withholdingTaxAmount: 300 })
      .expect(200);
  });

  it('refuses withheld tax above the payment amount', async () => {
    const invoiceId = await createInvoice(ids.customer, 100);
    const res = await jmRequest('post', '/payments-received')
      .send({
        customerId: ids.customer,
        paymentDate: `${year}-05-21`,
        depositAccountId: accounts.cash,
        amount: 100,
        withholdingTaxAmount: 101,
        entries: [{ index: 1, invoiceId, paymentAmount: 100 }],
      })
      .expect(400);
    expect(res.body.errors[0].type).toBe('WITHHOLDING_TAX_EXCEEDS_AMOUNT');
  });

  it('records certificates and summarizes the year', async () => {
    const otherInvoice = await createInvoice(ids.otherCustomer, 5000);
    await jmRequest('post', '/payments-received')
      .send({
        customerId: ids.otherCustomer,
        paymentDate: `${year}-11-02`,
        depositAccountId: accounts.cash,
        amount: 5000,
        withholdingTaxAmount: 150,
        entries: [{ index: 1, invoiceId: otherInvoice, paymentAmount: 5000 }],
      })
      .expect(201);

    // Tax year from period_to.
    const certificate = (
      await jmRequest('post', '/jamaica/wht-certificates')
        .send({
          customerId: ids.customer,
          certificateNumber: 'C-1',
          certificateDate: `${year + 1}-01-20`,
          periodFrom: `${year}-01-01`,
          periodTo: `${year}-12-31`,
          amount: 300,
        })
        .expect(201)
    ).body;
    expect(certificate.tax_year).toBe(year);

    const summary = (
      await jmRequest('get', '/jamaica/wht-summary').query({ year }).expect(200)
    ).body;
    expect(summary.rate).toBe(3);
    expect(summary.totals).toEqual({
      withheld_amount: 450,
      certified_amount: 300,
      uncertified_amount: 150,
    });
    expect(summary.s04).toEqual({ line: 'F24', credit_amount: 300 });

    const row = (customerId: number) =>
      summary.customers.find((c) => c.customer_id === customerId);
    expect(row(ids.customer).status).toBe('certified');
    expect(row(ids.otherCustomer)).toMatchObject({
      withheld_amount: 150,
      certified_amount: 0,
      difference_amount: 150,
      status: 'missing',
    });
    expect(summary.warnings.map((w) => w.code)).toContain(
      'CERTIFICATES_MISSING',
    );

    const list = (
      await jmRequest('get', '/jamaica/wht-certificates')
        .query({ taxYear: year })
        .expect(200)
    ).body;
    expect(list.map((c) => c.id)).toEqual([certificate.id]);

    await jmRequest('put', `/jamaica/wht-certificates/${certificate.id}`)
      .send({
        customerId: ids.customer,
        certificateDate: `${year + 1}-01-20`,
        taxYear: year,
        amount: 250,
      })
      .expect(200);
    await jmRequest(
      'delete',
      `/jamaica/wht-certificates/${certificate.id}`,
    ).expect(200);
    await jmRequest(
      'get',
      `/jamaica/wht-certificates/${certificate.id}`,
    ).expect(400);
  });

  it('refuses the endpoints while the Jamaica feature is off', async () => {
    const res = await usRequest('get', '/jamaica/wht-summary').expect(400);
    expect(res.body.errors[0].type).toBe('JAMAICA_FEATURE_NOT_ENABLED');
  });
});
