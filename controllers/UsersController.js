const sha1 = require('sha1');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const userExists = await dbClient.userExist(email);
    if (userExists) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const hashedPassword = sha1(password);
    const newUser = await dbClient.createUser(email, hashedPassword);

    return res.status(201).json({ id: newUser.insertedId.toString(), email });
  }

  static async getMe(req, res) {
    const { 'x-token': token } = req.headers;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    // Add logging
    console.log(`Token retrieved from Redis: key = ${key}, userId = ${userId}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.getUserById(userId);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({ email: user.email, id: user._id.toString() });
  }
}

module.exports = UsersController;
