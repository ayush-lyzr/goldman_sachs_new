import mongoose from "mongoose";
// Explicitly import mongodb to ensure it's bundled with mongoose
import "mongodb";

const MONGODB_URL = process.env.MONGODB_URL ?? process.env.mongodb_url;
const DB_NAME = process.env.DB_NAME ?? process.env.db_name;

// Debug logging for environment variables
console.log("[MongoDB Config] Environment variable check:");
console.log("[MongoDB Config] MONGODB_URL present:", !!MONGODB_URL);
console.log("[MongoDB Config] DB_NAME present:", !!DB_NAME);
console.log("[MongoDB Config] Available env vars:", Object.keys(process.env).filter(k => 
  k.includes('MONGODB') || k.includes('DB_NAME') || k.includes('mongodb') || k.includes('db_name')
));

if (!MONGODB_URL) {
  console.error("[MongoDB Config] ERROR: MONGODB_URL not found in environment");
  throw new Error(
    "Missing MongoDB connection string. Set MONGODB_URL or mongodb_url in your environment.",
  );
}

if (!DB_NAME) {
  console.error("[MongoDB Config] ERROR: DB_NAME not found in environment");
  throw new Error(
    "Missing database name. Set DB_NAME or db_name in your environment.",
  );
}

console.log("[MongoDB Config] Configuration loaded successfully");

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
