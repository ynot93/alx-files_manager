const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const AppController = require('../controllers/AppController');

const app = express();
app.use(bodyParser.json());
app.get('/status', AppController.getStatus);
app.get('/stats', AppController.getStats);

describe('AppController Endpoints', () => {
  test('GET /status', async () => {
    const res = await request(app).get('/status');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('redis');
    expect(res.body).toHaveProperty('db');
  });

  test('GET /stats', async () => {
    const res = await request(app).get('/stats');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('users');
    expect(res.body).toHaveProperty('files');
  });
});
