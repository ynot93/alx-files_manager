const { MongoClient, ObjectId } = require('mongodb');

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

  isAlive() {
    return this.client.topology.isConnected();
  }

  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }

  async userExist(email) {
    const user = await this.db.collection('users').findOne({ email });
    return user !== null;
  }

  async createUser(email, hashedPassword) {
    const result = await this.db.collection('users').insertOne({ email, password: hashedPassword });
    return result;
  }

  async getUser(email) {
    const user = await this.db.collection('users').findOne({ email });
    console.log(`getUser: ${email} returned user: ${user}`);
    return user;
  }

  async getUserById(id) {
    const user = await this.db.collection('users').findOne({ _id: new ObjectId(id) });

    // Add logging
    console.log(`getUserById: ${id} returned user: ${user}`);

    return user;
  }

  // New method to retrieve a file by ID
  async getFileById(id) {
    const file = await this.db.collection('files').findOne({ _id: ObjectId(id) });
    return file;
  }

  // New method to create a file in the database
  async createFile(fileDocument) {
    const result = await this.db.collection('files').insertOne(fileDocument);
    return result.ops[0];
  }

  async usersCollection() {
    return this.db.collection('users');
  }

  async filesCollection() {
    return this.db.collection('files');
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
