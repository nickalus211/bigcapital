import request = require('supertest');
import { app, AuthorizationHeader, orgainzationId } from './init-app-test';

const makeSettingsRequest = () => ({
  options: [
    {
      group: 'credit_note',
      key: 'customer_notes',
      value: 'Customer Notes...',
    },
    {
      group: 'credit_note',
      key: 'terms_conditions',
      value: 'Terms & Conditions...',
    },
  ],
});

describe('Settings (e2e)', () => {
  it('/settings (PUT)', () => {
    return request(app.getHttpServer())
      .put('/settings')
      .set('organization-id', orgainzationId)
      .set('Authorization', AuthorizationHeader)
      .send(makeSettingsRequest())
      .expect(200);
  });

  it('/settings (PUT) accepts the Jamaica feature flag', async () => {
    const setJamaica = (value: boolean) =>
      request(app.getHttpServer())
        .put('/settings')
        .set('organization-id', orgainzationId)
        .set('Authorization', AuthorizationHeader)
        .send({ options: [{ group: 'features', key: 'jamaica', value }] })
        .expect(200);

    await setJamaica(true);

    const boot = await request(app.getHttpServer())
      .get('/dashboard/boot')
      .set('organization-id', orgainzationId)
      .set('Authorization', AuthorizationHeader)
      .expect(200);

    const jamaica = boot.body.features.find(
      (feature) => feature.name === 'jamaica',
    );
    expect(jamaica.is_accessible).toBe(true);

    // Restore the default so other suites are unaffected.
    await setJamaica(false);
  });

  it('/settings (GET)', () => {
    return request(app.getHttpServer())
      .get('/settings')
      .set('organization-id', orgainzationId)
      .set('Authorization', AuthorizationHeader)
      .expect(200);
  });
});
