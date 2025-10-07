import sqlite3 from "sqlite3";
import { open } from "sqlite";

// Open or create database
export async function initDB() {
  const db = await open({
    filename: "./refurbyte.db",
    driver: sqlite3.Database,
  });

  // Create users table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      last_message TEXT,
      last_service TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}
