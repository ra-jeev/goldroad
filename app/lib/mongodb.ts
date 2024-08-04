import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
} else if (!process.env.DB_NAME) {
  throw new Error('Missing environment variable: "DB_NAME"');
}

const uri = process.env.MONGODB_URI;
const options = {};

let clientPromise: Promise<MongoClient> = new MongoClient(
  uri,
  options
).connect();

export default clientPromise;
