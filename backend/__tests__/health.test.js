const request = require('supertest');
const app = require('../server'); // express 인스턴스를 export 하도록 수정 필요

describe('Health & Metrics', () => {
  it('GET /healthz returns OK', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });
});
