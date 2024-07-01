const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const AuthController = require('../controllers/AuthController');

const app = express();
app.use(bodyParser.json());
app.get('/connect', AuthController.getConnect);
app.get('/disconnect', AuthController.getDisconnect);

describe('AuthController Endpoints', () => {
  let token;

  test('GET /connect', async () => {
    const auth = Buffer.from('test@example.com:password').toString('base64');
    const res = await request(app)
      .get('/connect')
      .set('Authorization', `Basic ${auth}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    token = res.body.token;
  });

  test('GET /disconnect', async () => {
    const res = await request(app)
      .get('/disconnect')
      .set('X-Token', token);
    expect(res.statusCode).toEqual(204);
  });
});
