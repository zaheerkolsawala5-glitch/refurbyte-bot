// database.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function initDB() {
  const db = await open({
    filename: "./refurbyte.db",
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      last_message TEXT,
      last_service TEXT,
      last_interaction TEXT DEFAULT CURRENT_TIMESTAMP,
      followup_sent INTEGER DEFAULT 0
    )
  `);

  return db;
}
