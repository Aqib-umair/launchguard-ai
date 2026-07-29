import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

export async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'launchguard.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      name TEXT,
      repo_url TEXT,
      deploy_url TEXT,
      status TEXT,
      score INTEGER,
      broken_flows INTEGER DEFAULT 0,
      api_failures INTEGER DEFAULT 0,
      performance INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      scan_id TEXT,
      title TEXT,
      status TEXT,
      severity TEXT,
      area TEXT,
      root_cause TEXT,
      patch TEXT,
      affected_url TEXT,
      affected_component TEXT,
      before_code TEXT,
      after_code TEXT,
      screenshot TEXT,
      console_error TEXT,
      network_error TEXT,
      stack_trace TEXT,
      confidence INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      scan_id TEXT,
      name TEXT,
      score INTEGER,
      fail_step TEXT,
      duration TEXT,
      screenshot TEXT,
      console_error TEXT,
      network_error TEXT,
      dom_snapshot TEXT,
      severity TEXT,
      confidence INTEGER
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      scan_id TEXT,
      path TEXT,
      status TEXT,
      screenshot TEXT,
      errors TEXT,
      console_errors TEXT,
      network_errors TEXT,
      load_time INTEGER,
      a11y_score INTEGER,
      perf_score INTEGER
    );

    CREATE TABLE IF NOT EXISTS evals (
      id TEXT PRIMARY KEY,
      scan_id TEXT,
      name TEXT,
      target_url TEXT,
      prompt TEXT,
      status TEXT,
      reasoning TEXT
    );
  `);

  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not initialized");
  return db;
}
