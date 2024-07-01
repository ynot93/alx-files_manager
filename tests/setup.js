const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const redis = require('redis');

// Mock MongoDB
jest.mock('mongodb', () => {
  const actualMongoDB = jest.requireActual('mongodb');
  return {
    ...actualMongoDB,
    MongoClient: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue({}),
      db: jest.fn().mockReturnThis(),
      collection: jest.fn().mockReturnThis(),
      countDocuments: jest.fn().mockResolvedValue(2),
      findOne: jest.fn().mockResolvedValue(null),
      insertOne: jest.fn().mockResolvedValue({ insertedId: 'mockUserId' }),
    })),
  };
});

// Mock Redis
jest.mock('redis', () => {
  const mSet = jest.fn();
  const mGet = jest.fn();
  const mDel = jest.fn();
  const mExpire = jest.fn();
  const mClient = {
    on: jest.fn(),
    set: mSet,
    get: mGet,
    del: mDel,
    expire: mExpire,
    connected: true,
  };
  return {
    createClient: jest.fn(() => mClient),
    RedisClient: jest.fn(() => mClient),
  };
});

// Initialize Express app
const app = express();
app.use(bodyParser.json());

module.exports = {
  app,
};
