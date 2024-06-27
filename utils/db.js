import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}`;
    
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
        console.log('MongoDB client connected to the server');
      })
      .catch((err) => {
        console.log(`MongoDB client not connected to the server: ${err.message}`);
      });
  }

  /**
   * Checks if the MongoDB client is connected.
   * @returns {boolean} True if the client is connected, otherwise false.
   */
  isAlive() {
    return this.client.isConnected();
  }

  /**
   * Returns the number of documents in the 'users' collection.
   * @returns {Promise<number>} The number of documents in the 'users' collection.
   */
  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  /**
   * Returns the number of documents in the 'files' collection.
   * @returns {Promise<number>} The number of documents in the 'files' collection.
   */
  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
