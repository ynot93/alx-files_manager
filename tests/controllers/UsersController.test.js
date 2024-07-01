const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const UsersController = require('../controllers/UsersController');

const app = express();
app.use(bodyParser.json());
app.post('/users', UsersController.postNew);
app.get('/users/me', UsersController.getMe);

describe('UsersController Endpoints', () => {
  let token;

  test('POST /users', async () => {
    const res = await request(app)
      .post('/users')
      .send({ email: 'test@example.com', password: 'password' });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('email');
  });

  test('GET /users/me', async () => {
    await request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:password').toString('base64')}`)
      .then((res) => {
        token = res.body.token;
      });

    const res = await request(app)
      .get('/users/me')
      .set('X-Token', token);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('id');
  });
});
