const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'cotton_finder';
const MONGO_COLLECTION_ARITZIA = process.env.MONGO_COLLECTION_ARITZIA || 'products';

let client = null;
let db = null;

async function connect() {
  if (client) {
    return client;
  }

  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(MONGO_DB);
    console.log('✅ Connected to MongoDB');
    return client;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

async function disconnect() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('🔌 Disconnected from MongoDB');
  }
}

function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connect() first.');
  }
  return db;
}

function getAritziaCollection() {
  return getDb().collection(MONGO_COLLECTION_ARITZIA);
}

module.exports = {
  connect,
  disconnect,
  getDb,
  getAritziaCollection,
};
