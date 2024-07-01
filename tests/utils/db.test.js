const { MongoClient } = require('mongodb');

const dbClient = {
  client: new MongoClient('mongodb://localhost:27017', { useNewUrlParser: true }),

  async connect() {
    await this.client.connect();
  },

  isAlive() {
    return this.client.isConnected();
  },

  async nbUsers() {
    const usersCollection = this.client.db().collection('users');
    return await usersCollection.countDocuments();
  },

  async nbFiles() {
    const filesCollection = this.client.db().collection('files');
    return await filesCollection.countDocuments();
  },

  async userExist(email) {
    const usersCollection = this.client.db().collection('users');
    const user = await usersCollection.findOne({ email });
    return !!user;
  },

  async createUser(email, password) {
    const usersCollection = this.client.db().collection('users');
    const result = await usersCollection.insertOne({ email, password });
    return result;
  },

  async getUser(email) {
    const usersCollection = this.client.db().collection('users');
    const user = await usersCollection.findOne({ email });
    return user;
  },

  async getUserById(id) {
    const usersCollection = this.client.db().collection('users');
    const user = await usersCollection.findOne({ _id: id });
    return user;
  },
};

module.exports = dbClient;
