const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}`;

    this.client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
        console.log('MongoDB client connected to the server');
      })
      .catch((err) => {
        console.log(`MongoDB client not connected to the server: ${err.message}`);
      });
  }

  // Checks if the MongoDB client is connected.
  isAlive() {
    return this.client.topology.isConnected();
  }

  // Returns the number of documents in the 'users' collection.
  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  // Returns the number of documents in the 'files' collection.
  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }

  // Checks if a user exists by email.
  async userExist(email) {
    const user = await this.db.collection('users').findOne({ email });
    return user !== null;
  }

  // Creates a new user in the database.
  async createUser(email, hashedPassword) {
    const result = await this.db.collection('users').insertOne({ email, password: hashedPassword });
    return result;
  }

  // Retrieves a reference to the `users` collection.
  async usersCollection() {
    return this.db.collection('users');
  }

  // Retrieves a reference to the `files` collection.
  async filesCollection() {
    return this.db.collection('files');
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
