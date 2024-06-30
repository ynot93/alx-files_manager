const sha1 = require('sha1');
const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;

    // Check for the Basic Auth header
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Decode Base64 credentials
    const encodedCredentials = authHeader.substring('Basic '.length);
    const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
    const [email, password] = decodedCredentials.split(':');

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Hash the provided password
    const hashedPassword = sha1(password);

    try {
      // Retrieve the user from the database
      const user = await dbClient.getUser(email);

      // Check if user exists and password matches
      if (!user || user.password !== hashedPassword) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Generate a new token
      const token = uuidv4();
      const key = `auth_${token}`;

      // Store the token in Redis with a 24-hour expiration
      await redisClient.set(key, user._id.toString(), 86400)  // 24 hours expiration
        .catch((err) => {
          console.error('Error setting Redis key:', err);
          return res.status(500).json({ error: 'Internal Server Error' });
        });

      // Return the token
      return res.status(200).json({ token });
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    // Check if token is provided
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    try {
      const userId = await redisClient.get(key);
      
      // Check if token is valid
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Delete the token from Redis
      await redisClient.del(key)
        .catch((err) => {
          console.error('Error deleting Redis key:', err);
          return res.status(500).json({ error: 'Internal Server Error' });
        });

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = AuthController;
