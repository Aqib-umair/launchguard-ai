import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

class MockDb {
  constructor() {
    this.scans = [];
    this.issues = [];
    this.flows = [];
    this.nodes = [];
    this.evals = [];
    this.ai_fix_requests = [];
  }
  async exec() {}
  async run(sql, params) { return { lastID: 1 }; }
  async get(sql, params) { return null; }
  async all(sql, params) { return []; }
}

export async function initDb() {
  const isVercel = !!process.env.VERCEL;
  
  if (isVercel) {
    console.log(`[DB] Vercel detected. Initializing Mock DB to prevent sqlite3 native binding crashes.`);
    db = new MockDb();
    return;
  }

  try {
    const sqlite3 = (await import('sqlite3')).default;
    const { open } = await import('sqlite');
    
    const dbPath = path.join(__dirname, 'launchguard.db');
    console.log(`[DB] Initializing SQLite database at: ${dbPath}`);
    
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS scans (id TEXT PRIMARY KEY, name TEXT, repo_url TEXT, deploy_url TEXT, status TEXT, score INTEGER, broken_flows INTEGER DEFAULT 0, api_failures INTEGER DEFAULT 0, performance INTEGER DEFAULT 0, error_message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS issues (id TEXT PRIMARY KEY, scan_id TEXT, title TEXT, status TEXT, severity TEXT, area TEXT, root_cause TEXT, patch TEXT, affected_url TEXT, affected_component TEXT, before_code TEXT, after_code TEXT, screenshot TEXT, console_error TEXT, network_error TEXT, stack_trace TEXT, confidence INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS flows (id TEXT PRIMARY KEY, scan_id TEXT, name TEXT, score INTEGER, fail_step TEXT, duration TEXT, screenshot TEXT, console_error TEXT, network_error TEXT, dom_snapshot TEXT, severity TEXT, confidence INTEGER);
      CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, scan_id TEXT, path TEXT, status TEXT, screenshot TEXT, errors TEXT, console_errors TEXT, network_errors TEXT, load_time INTEGER, a11y_score INTEGER, perf_score INTEGER);
      CREATE TABLE IF NOT EXISTS evals (id TEXT PRIMARY KEY, scan_id TEXT, name TEXT, target_url TEXT, prompt TEXT, status TEXT, reasoning TEXT);
      CREATE TABLE IF NOT EXISTS ai_fix_requests (id TEXT PRIMARY KEY, issue_id TEXT, scan_id TEXT, model TEXT, response_json TEXT, execution_time INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    `);
    
    // Ensure existing databases get the new column
    try {
      await db.exec(\`ALTER TABLE scans ADD COLUMN error_message TEXT;\`);
    } catch (e) {
      // Column likely already exists, ignore
    }
  } catch (err) {
    console.error(`[DB] Failed to initialize real SQLite DB, falling back to Mock:`, err.message);
    db = new MockDb();
  }
}

export function getDb() {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

export async function getLatestScanId(dbInstance) {
  const latestScan = await dbInstance.get(`SELECT id FROM scans ORDER BY created_at DESC LIMIT 1`);
  return latestScan ? latestScan.id : null;
}
