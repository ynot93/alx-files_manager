const sha1 = require('sha1');
const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const encodedCredentials = authHeader.substring('Basic '.length);
    const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
    const [email, password] = decodedCredentials.split(':');

    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hashedPassword = sha1(password);

    try {
      const user = await dbClient.getUser(email);

      if (!user || user.password !== hashedPassword) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = uuidv4();
      const key = `auth_${token}`;

      await redisClient.set(key, user._id.toString(), 86400);

      // Add logging
      console.log(`Token stored in Redis: key = ${key}, value = ${user._id.toString()}`);

      return res.status(200).json({ token });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    try {
      const userId = await redisClient.get(key);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await redisClient.del(key);

      return res.status(204).send();
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = AuthController;
