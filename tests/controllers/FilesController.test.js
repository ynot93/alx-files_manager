const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const FilesController = require('../controllers/FilesController');

const app = express();
app.use(bodyParser.json());
app.post('/files', FilesController.postUpload);
app.get('/files/:id', FilesController.getShow);
app.get('/files', FilesController.getIndex);
app.get('/files/:id/data', FilesController.getFile);

describe('FilesController Endpoints', () => {
  let token;
  let fileId;

  beforeAll(async () => {
    await request(app)
      .get('/connect')
      .set('Authorization', `Basic ${Buffer.from('test@example.com:password').toString('base64')}`)
      .then((res) => {
        token = res.body.token;
      });

    // Upload a file for testing pagination
    const uploadRes = await request(app)
      .post('/files')
      .set('X-Token', token)
      .send({
        name: 'myText.txt',
        type: 'file',
        data: Buffer.from('Hello Webstack!', 'utf-8').toString('base64'),
      });
    fileId = uploadRes.body.id;
  });

  test('GET /files pagination', async () => {
    // Request first page with limit of 5
    const res1 = await request(app)
      .get('/files')
      .set('X-Token', token)
      .query({ page: 1, limit: 5 });

    expect(res1.statusCode).toEqual(200);
    expect(Array.isArray(res1.body)).toBe(true);
    expect(res1.body.length).toBeLessThanOrEqual(5);

    // Request second page with limit of 5
    const res2 = await request(app)
      .get('/files')
      .set('X-Token', token)
      .query({ page: 2, limit: 5 });

    expect(res2.statusCode).toEqual(200);
    expect(Array.isArray(res2.body)).toBe(true);
    expect(res2.body.length).toBeLessThanOrEqual(5);

    // More tests as needed for different scenarios 
  });

  test('GET /files/:id', async () => {
    const res = await request(app)
      .get(`/files/${fileId}`)
      .set('X-Token', token);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.id).toEqual(fileId);
  });

  test('GET /files/:id/data', async () => {
    const res = await request(app)
      .get(`/files/${fileId}/data`)
      .set('X-Token', token);
    expect(res.statusCode).toEqual(200);
    expect(res.text).toEqual('Hello Webstack!');
  });
});
