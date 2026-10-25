import request = require('supertest');
import { faker } from '@faker-js/faker';
import { app, AuthorizationHeader, orgainzationId } from './init-app-test';

/**
 * Customs entries (M6) on the Jamaica organization. Each run uses a random
 * future month so reruns don't add up on the GCT return.
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
const date = `${year}-04-10`;
const accounts = {
  bank: 0,
  income: 0,
  cogs: 0,
  inventory: 0,
  expense: 0,
  inputTax: 0,
  advanceGct: 0,
  customsDuties: 0,
};
const ids = { vendor: 0, widget: 0, gadget: 0, service: 0, bill: 0 };
const billEntries = { widget: 0, gadget: 0 };

const amount = (value: any) => Number(value?.amount ?? value ?? 0);

const fetchLegs = async (referenceType: string, referenceId: number) => {
  const res = await jmRequest('get', '/reports/transactions-by-reference')
    .query({ referenceType, referenceId })
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

const createItem = async (name: string, type: 'inventory' | 'service') =>
  (
    await jmRequest('post', '/items')
      .send({
        name: `${name} ${Date.now()}-${faker.string.alphanumeric(4)}`,
        type,
        sellable: true,
        purchasable: true,
        sellAccountId: accounts.income,
        costAccountId: type === 'inventory' ? accounts.cogs : accounts.expense,
        ...(type === 'inventory' && { inventoryAccountId: accounts.inventory }),
      })
      .expect(201)
  ).body.id;

const createBill = (entries: any[], open = true) =>
  jmRequest('post', '/bills').send({
    vendorId: ids.vendor,
    billDate: date,
    dueDate: date,
    billNumber: `MIA-${faker.string.alphanumeric(8)}`,
    open,
    entries,
  });

const entryBody = (overrides: Record<string, any> = {}) => ({
  entryNumber: `C78-${faker.string.alphanumeric(10)}`,
  entryDate: date,
  paymentAccountId: accounts.bank,
  billId: ids.bill,
  fobAmount: 90000,
  freightAmount: 8000,
  insuranceAmount: 2000,
  customsDutyRate: 20,
  cafAmount: 2500,
  ...overrides,
});

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
    reason: 'Cancel lock for customs e2e test',
  });
  // Seeds the M6 accounts and rates on organizations set up earlier.
  await jmRequest('post', '/jamaica/setup').send({}).expect(201);

  const list = (await jmRequest('get', '/accounts').expect(200)).body.accounts;
  const ofType = (type: string) =>
    list.find((a) => a.account_type === type && !a.slug?.startsWith('customs'))
      .id;
  const bySlug = (slug: string) => list.find((a) => a.slug === slug).id;
  accounts.bank = ofType('bank');
  accounts.income = ofType('income');
  accounts.cogs = ofType('cost-of-goods-sold');
  accounts.inventory = ofType('inventory');
  accounts.expense = ofType('expense');
  accounts.inputTax = bySlug('gct-input-tax');
  accounts.advanceGct = bySlug('advance-gct');
  accounts.customsDuties = bySlug('customs-duties');

  ids.vendor = (
    await jmRequest('post', '/vendors')
      .send({
        displayName: `Customs Supplier ${faker.string.alphanumeric(6)}`,
        currencyCode: 'JMD',
      })
      .expect(201)
  ).body.id;
  ids.widget = await createItem('Widget', 'inventory');
  ids.gadget = await createItem('Gadget', 'inventory');
  ids.service = await createItem('Handling', 'service');

  const bill = (
    await createBill([
      { index: 1, itemId: ids.widget, quantity: 10, rate: 5000 },
      { index: 2, itemId: ids.gadget, quantity: 5, rate: 8000 },
      { index: 3, itemId: ids.service, quantity: 1, rate: 1000 },
    ]).expect(201)
  ).body;
  ids.bill = bill.id;
  billEntries.widget = bill.entries.find((e) => e.item_id === ids.widget).id;
  billEntries.gadget = bill.entries.find((e) => e.item_id === ids.gadget).id;
});

describe('Jamaica customs entries (e2e)', () => {
  let entryId: number;

  it('works out the duties, taxes and allocation', async () => {
    const res = await jmRequest('post', '/jamaica/customs-entries/calculate')
      .send({ ...entryBody(), entryNumber: undefined })
      .expect(200);

    expect(res.body).toMatchObject({
      cif_amount: 100000,
      customs_duty_amount: 20000,
      scf_amount: 300,
      epl_amount: 500,
      import_gct_base: 120800,
      import_gct_amount: 18120,
      advance_gct_amount: 6040,
      duties_amount: 23300,
      taxes_amount: 24160,
      total_amount: 47460,
      overrides: [],
    });
    // 23,300 by value: 50,000 widgets, 40,000 gadgets; none on the service.
    expect(res.body.allocations).toEqual([
      expect.objectContaining({ entry_id: billEntries.widget, cost: 12944.44 }),
      expect.objectContaining({ entry_id: billEntries.gadget, cost: 10355.56 }),
    ]);
  });

  it('posts the duties to inventory and the GCT to recoverable accounts', async () => {
    const entry = (
      await jmRequest('post', '/jamaica/customs-entries')
        .send(entryBody())
        .expect(201)
    ).body;
    entryId = entry.id;
    expect(entry.expense_id).toBeTruthy();
    expect(entry.landed_cost_id).toBeTruthy();

    const expenseLegs = await fetchLegs('Expense', entry.expense_id);
    expect(netOn(expenseLegs, accounts.bank)).toBeCloseTo(-23300, 2);
    expect(netOn(expenseLegs, accounts.customsDuties)).toBeCloseTo(23300, 2);

    const landedLegs = await fetchLegs('LandedCost', entry.landed_cost_id);
    expect(netOn(landedLegs, accounts.inventory)).toBeCloseTo(23300, 2);
    expect(netOn(landedLegs, accounts.customsDuties)).toBeCloseTo(-23300, 2);

    const taxLegs = await fetchLegs('CustomsEntry', entry.id);
    expect(netOn(taxLegs, accounts.bank)).toBeCloseTo(-24160, 2);
    expect(netOn(taxLegs, accounts.inputTax)).toBeCloseTo(18120, 2);
    expect(netOn(taxLegs, accounts.advanceGct)).toBeCloseTo(6040, 2);

    const allocated = (
      await jmRequest(
        'get',
        `/landed-cost/bills/${ids.bill}/transactions`,
      ).expect(200)
    ).body.data;
    expect(allocated).toHaveLength(1);
    expect(allocated[0].amount).toBe(23300);
  });

  it('claims import GCT and advance GCT on the GCT return', async () => {
    const res = await jmRequest('get', '/jamaica/gct-return')
      .query({ fromDate: `${year}-04-01`, toDate: `${year}-04-30` })
      .expect(200);

    expect(res.body.purchases.import_gct).toEqual({
      taxable_amount: 120800,
      tax_amount: 18120,
    });
    expect(res.body.purchases.input_tax).toBe(18120);
    expect(res.body.advance_gct_credit).toBe(6040);
    expect(res.body.net_gct).toBe(-24160);
    expect(res.body.documents.customs_entries).toBe(1);
  });

  it('refuses deleting the expense the entry posted', async () => {
    const entry = (
      await jmRequest('get', `/jamaica/customs-entries/${entryId}`).expect(200)
    ).body;
    const res = await jmRequest(
      'delete',
      `/expenses/${entry.expense_id}`,
    ).expect(400);
    expect(res.body.errors[0].type).toBe('CUSTOMS_ENTRY_EXPENSE');
  });

  it('uses the C78 amounts on edit and reposts', async () => {
    const before = (
      await jmRequest('get', `/jamaica/customs-entries/${entryId}`).expect(200)
    ).body;

    const edited = (
      await jmRequest('put', `/jamaica/customs-entries/${entryId}`)
        .send(
          entryBody({
            entryNumber: before.entry_number,
            allocationMethod: 'quantity',
            customsDutyAmount: 10000,
            advanceGctAmount: 0,
          }),
        )
        .expect(200)
    ).body;
    // 10,000 + 300 + 500 + 2,500
    expect(edited.duties_amount).toBe(13300);
    // 15% of 110,800
    expect(edited.import_gct_amount).toBe(16620);
    expect(edited.advance_gct_amount).toBe(0);
    expect(edited.overrides.map((o) => o.field)).toEqual([
      'customs_duty_amount',
      'advance_gct_amount',
    ]);
    // By quantity: 10 widgets, 5 gadgets.
    expect(edited.allocations.map((a) => a.cost)).toEqual([8866.67, 4433.33]);

    // The first posting is gone.
    expect(await fetchLegs('Expense', before.expense_id)).toEqual([]);
    expect(await fetchLegs('LandedCost', before.landed_cost_id)).toEqual([]);
    const taxLegs = await fetchLegs('CustomsEntry', entryId);
    expect(netOn(taxLegs, accounts.advanceGct)).toBe(0);
    expect(netOn(taxLegs, accounts.inputTax)).toBeCloseTo(16620, 2);
  });

  it('validates the entry', async () => {
    const existing = (
      await jmRequest('get', `/jamaica/customs-entries/${entryId}`).expect(200)
    ).body;
    const errorOf = async (body: Record<string, any>) =>
      (
        await jmRequest('post', '/jamaica/customs-entries')
          .send(entryBody(body))
          .expect(400)
      ).body.errors[0].type;

    expect(await errorOf({ entryNumber: existing.entry_number })).toBe(
      'CUSTOMS_ENTRY_NUMBER_EXISTS',
    );
    expect(await errorOf({ paymentAccountId: accounts.income })).toBe(
      'CUSTOMS_PAYMENT_ACCOUNT_INVALID',
    );
    const draft = (
      await createBill(
        [{ index: 1, itemId: ids.widget, quantity: 1, rate: 100 }],
        false,
      ).expect(201)
    ).body;
    expect(await errorOf({ billId: draft.id })).toBe('CUSTOMS_BILL_NOT_OPEN');

    const services = (
      await createBill([
        { index: 1, itemId: ids.service, quantity: 1, rate: 100 },
      ]).expect(201)
    ).body;
    expect(await errorOf({ billId: services.id })).toBe(
      'CUSTOMS_BILL_NO_INVENTORY_ITEMS',
    );
  });

  it('expenses the duties without a bill', async () => {
    const entry = (
      await jmRequest('post', '/jamaica/customs-entries')
        .send(entryBody({ billId: null }))
        .expect(201)
    ).body;
    expect(entry.landed_cost_id).toBeNull();

    const legs = await fetchLegs('Expense', entry.expense_id);
    expect(netOn(legs, accounts.customsDuties)).toBeCloseTo(23300, 2);

    await jmRequest('delete', `/jamaica/customs-entries/${entry.id}`).expect(
      200,
    );
  });

  it('deletes the entry with what it posted', async () => {
    const entry = (
      await jmRequest('get', `/jamaica/customs-entries/${entryId}`).expect(200)
    ).body;
    await jmRequest('delete', `/jamaica/customs-entries/${entryId}`).expect(
      200,
    );

    expect(await fetchLegs('Expense', entry.expense_id)).toEqual([]);
    expect(await fetchLegs('LandedCost', entry.landed_cost_id)).toEqual([]);
    expect(await fetchLegs('CustomsEntry', entryId)).toEqual([]);
    await jmRequest('get', `/jamaica/customs-entries/${entryId}`).expect(400);

    // Without the allocation the bill can be deleted again.
    await jmRequest('delete', `/bills/${ids.bill}`).expect(200);
  });

  it('refuses the endpoints while the Jamaica feature is off', async () => {
    const res = await usRequest('get', '/jamaica/customs-entries').expect(400);
    expect(res.body.errors[0].type).toBe('JAMAICA_FEATURE_NOT_ENABLED');
  });
});
