import mongoose from "mongoose";

const MONGODB_URL = process.env.MONGODB_URL ?? process.env.mongodb_url;
const DB_NAME = process.env.DB_NAME ?? process.env.db_name;

if (!MONGODB_URL) {
  throw new Error(
    "Missing MongoDB connection string. Set MONGODB_URL or mongodb_url in your environment.",
  );
}

if (!DB_NAME) {
  throw new Error(
    "Missing database name. Set DB_NAME or db_name in your environment.",
  );
}

const connectionString: string = MONGODB_URL;
const dbName: string = DB_NAME;

declare global {
  // eslint-disable-next-line no-var
  var _mongoosePromise: Promise<typeof mongoose> | undefined;
}

let cached = global._mongoosePromise;

export async function connectDB() {
  if (cached) {
    return cached;
  }

  if (mongoose.connection.readyState >= 1) {
    return mongoose;
  }

  cached = mongoose.connect(connectionString, { dbName });
  global._mongoosePromise = cached;

  return cached;
}
