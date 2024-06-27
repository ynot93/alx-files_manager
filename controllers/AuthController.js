import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

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
    await redisClient.set(key, user._id.toString(), 'EX', 86400); // 24 hours expiration

    // Return the token
    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    // Check if token is provided
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    // Check if token is valid
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete the token from Redis
    await redisClient.del(key);
    return res.status(204).send();
  }
}

module.exports = AuthController;
