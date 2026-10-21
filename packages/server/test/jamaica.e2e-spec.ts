import request = require('supertest');
import { app, AuthorizationHeader, orgainzationId } from './init-app-test';

/**
 * The Jamaica suite uses its own organization located in Jamaica, so the
 * setup (feature flag, tax settings, accounts) never leaks into the shared
 * e2e organization. Like `kk@kk.com`, it is built once through the running
 * API (organization builds can't run inside the ts-jest app because tenant
 * migrations load from the compiled build); see docs/setup/local-mamp.md.
 */
const JM_EMAIL = process.env.E2E_JM_EMAIL || 'jm@example.com';
const JM_PASSWORD = process.env.E2E_JM_PASSWORD || '1231231230';

const jm = {
  organizationId: '',
  authorization: '',
};

const jmRequest = (method: 'get' | 'post' | 'put' | 'delete', url: string) =>
  request(app.getHttpServer())
    [method](url)
    .set('organization-id', jm.organizationId)
    .set('Authorization', jm.authorization);

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
});

describe('Jamaica setup (e2e)', () => {
  it('ran the setup when the organization located in Jamaica was built', async () => {
    const res = await jmRequest('get', '/jamaica/settings').expect(200);

    expect(res.body.setup_at).toBeTruthy();
    expect(res.body.filing_frequency).toBe('monthly');
  });

  it('seeds the GCT tax rates with their tax types', async () => {
    const res = await jmRequest('get', '/tax-rates').expect(200);
    const byCode = Object.fromEntries(res.body.map((r) => [r.code, r]));

    expect(byCode['GCT-STD']).toMatchObject({
      rate: 15,
      tax_type: 'standard',
    });
    expect(byCode['GCT-STD'].active).toBeTruthy();
    expect(byCode['GCT-ZERO'].tax_type).toBe('zero_rated');
    expect(byCode['GCT-EXEMPT'].tax_type).toBe('exempt');
    expect(byCode['GCT-OOS'].tax_type).toBe('out_of_scope');
    expect(byCode['GCT-TEL'].active).toBeFalsy();
    expect(byCode['TAX-SALES'].active).toBeFalsy();
  });

  it('is idempotent', async () => {
    await jmRequest('post', '/jamaica/setup').expect(201);
    const res = await jmRequest('post', '/jamaica/setup').expect(201);

    expect(res.body.created).toEqual([]);
    expect(res.body.updated).toEqual([]);
    expect(res.body.skipped).toContain('tax_rate:GCT-STD');
  });

  it('reports without applying on a dry run', async () => {
    const res = await jmRequest('post', '/jamaica/setup?dry_run=true').expect(
      201,
    );
    expect(res.body.dry_run).toBe(true);
  });

  it('accepts the dry run flag in the body', async () => {
    const res = await jmRequest('post', '/jamaica/setup')
      .send({ dry_run: true })
      .expect(201);

    expect(res.body.dry_run).toBe(true);
  });

  it('saves the GCT settings and keeps omitted fields', async () => {
    await jmRequest('put', '/jamaica/settings')
      .send({ gct_registered: true, gct_registration_number: 'GCT-000123' })
      .expect(200);

    const res = await jmRequest('put', '/jamaica/settings')
      .send({ apportionment_enabled: true })
      .expect(200);

    expect(res.body).toMatchObject({
      gct_registered: true,
      gct_registration_number: 'GCT-000123',
      apportionment_enabled: true,
    });
  });

  it('rejects the Jamaica settings while the feature is off', async () => {
    const res = await request(app.getHttpServer())
      .get('/jamaica/settings')
      .set('organization-id', orgainzationId)
      .set('Authorization', AuthorizationHeader);

    expect(res.status).not.toBe(200);
  });
});

describe('Tax rate tax type (e2e)', () => {
  it('creates a tax rate with a tax type', async () => {
    const res = await jmRequest('post', '/tax-rates')
      .send({
        name: 'GCT Zero E2E',
        code: `ZERO-${Date.now()}`,
        rate: 0,
        tax_type: 'zero_rated',
        active: true,
      })
      .expect(201);

    expect(res.body.data?.tax_type ?? res.body.tax_type).toBe('zero_rated');

    await jmRequest('delete', `/tax-rates/${res.body.data?.id ?? res.body.id}`);
  });

  it('rejects an unknown tax type', () => {
    return jmRequest('post', '/tax-rates')
      .send({
        name: 'Bad type',
        code: `BAD-${Date.now()}`,
        rate: 5,
        tax_type: 'luxury',
      })
      .expect(400);
  });
});

describe('Contact tax number (e2e)', () => {
  it('stores the customer TRN', async () => {
    const created = await jmRequest('post', '/customers')
      .send({
        customer_type: 'business',
        currency_code: 'JMD',
        display_name: `TRN Customer ${Date.now()}`,
        tax_number: '123456789',
      })
      .expect(201);

    const id = created.body.id ?? created.body.data?.id;
    const res = await jmRequest('get', `/customers/${id}`).expect(200);

    expect(res.body.tax_number).toBe('123456789');
  });

  it('stores the vendor TRN', async () => {
    const created = await jmRequest('post', '/vendors')
      .send({
        display_name: `TRN Vendor ${Date.now()}`,
        tax_number: '987654321',
      })
      .expect(201);

    const id = created.body.id ?? created.body.data?.id;
    const res = await jmRequest('get', `/vendors/${id}`).expect(200);

    expect(res.body.tax_number).toBe('987654321');
  });
});
