import dbClient from '../utils/db';
import sha1 from 'sha1';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    // Check if user already exists
    const userExists = await dbClient.userExist(email);
    if (userExists) {
      return res.status(400).json({ error: 'Already exist' });
    }

    // Hash the password using SHA1
    const hashedPassword = sha1(password);

    // Insert the new user into the database
    const newUser = await dbClient.createUser(email, hashedPassword);

    // Respond with the newly created user's email and id
    res.status(201).json({ id: newUser.insertedId.toString(), email });
  }
}

export default UsersController;
