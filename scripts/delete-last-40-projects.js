/**
 * One-off script: delete the last 40 projects (by createdAt).
 * Run from repo root: node --env-file=.env scripts/delete-last-40-projects.js
 */

const { MongoClient } = require("mongodb");

const MONGODB_URL = process.env.MONGODB_URL || process.env.mongodb_url;
const DB_NAME = process.env.DB_NAME || process.env.db_name;

if (!MONGODB_URL || !DB_NAME) {
  console.error("Set MONGODB_URL and DB_NAME (or use --env-file=.env)");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(MONGODB_URL);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const coll = db.collection("projects");

    const last40 = await coll
      .find({})
      .sort({ createdAt: -1 })
      .limit(40)
      .project({ _id: 1, name: 1, createdAt: 1 })
      .toArray();

    if (last40.length === 0) {
      console.log("No projects found.");
      return;
    }

    console.log(`Found ${last40.length} project(s) to delete (newest first):`);
    last40.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} (${p._id}) ${p.createdAt}`);
    });

    const ids = last40.map((p) => p._id);
    const result = await coll.deleteMany({ _id: { $in: ids } });
    console.log(`\nDeleted ${result.deletedCount} project(s).`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
