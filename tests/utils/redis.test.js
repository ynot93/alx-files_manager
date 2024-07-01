const redis = require('redis');
const { promisify } = require('util');

const redisClient = redis.createClient();

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

const redisUtils = {
  isAlive() {
    return redisClient.connected;
  },

  async set(key, value, expiration) {
    const setAsync = promisify(redisClient.set).bind(redisClient);
    await setAsync(key, value);
    await this.expire(key, expiration);
  },

  async get(key) {
    const getAsync = promisify(redisClient.get).bind(redisClient);
    return await getAsync(key);
  },

  async del(key) {
    const delAsync = promisify(redisClient.del).bind(redisClient);
    await delAsync(key);
  },

  async expire(key, seconds) {
    const expireAsync = promisify(redisClient.expire).bind(redisClient);
    await expireAsync(key, seconds);
  },
};

module.exports = redisUtils;
