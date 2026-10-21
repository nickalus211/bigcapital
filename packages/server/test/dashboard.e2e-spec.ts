import request = require('supertest');
import { app, AuthorizationHeader, orgainzationId } from './init-app-test';

describe('Dashboard (e2e)', () => {
  it('/dashboard/boot (GET)', () => {
    return request(app.getHttpServer())
      .get('/dashboard/boot')
      .set('organization-id', orgainzationId)
      .set('Authorization', AuthorizationHeader)
      .expect(200);
  });

  it('/dashboard/boot (GET) returns the hidden modules', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/boot')
      .set('organization-id', orgainzationId)
      .set('Authorization', AuthorizationHeader)
      .expect(200);

    expect(Array.isArray(response.body.hidden_modules)).toBe(true);
  });

  it('/dashboard/boot (GET) lists the Jamaica feature', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/boot')
      .set('organization-id', orgainzationId)
      .set('Authorization', AuthorizationHeader)
      .expect(200);

    const jamaica = response.body.features.find(
      (feature) => feature.name === 'jamaica',
    );
    expect(jamaica).toBeDefined();
    expect(jamaica.default_accessible).toBe(false);
  });
});
