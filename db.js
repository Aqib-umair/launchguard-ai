import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dbInstance = null;

class SupabaseAdapter {
  constructor(url, key) {
    this.supabase = createClient(url, key);
  }
  
  async insert(table, data) {
    const { data: result, error } = await this.supabase.from(table).insert([data]).select();
    if (error) { console.error(`[Supabase] Insert Error (${table}):`, error); throw error; }
    return { lastID: result && result.length > 0 ? result[0].id : null };
  }
  
  async update(table, data, where) {
    let query = this.supabase.from(table).update(data);
    for (const [k, v] of Object.entries(where)) {
      query = query.eq(k, v);
    }
    const { error } = await query;
    if (error) { console.error(`[Supabase] Update Error (${table}):`, error); throw error; }
    return true;
  }
  
  async get(table, where = {}, options = {}) {
    let query = this.supabase.from(table).select('*');
    for (const [k, v] of Object.entries(where)) {
      query = query.eq(k, v);
    }
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.order === 'asc' });
    }
    query = query.limit(1);
    
    const { data, error } = await query;
    if (error) { console.error(`[Supabase] Get Error (${table}):`, error); throw error; }
    return data && data.length > 0 ? data[0] : null;
  }
  
  async all(table, where = {}, options = {}) {
    let query = this.supabase.from(table).select('*');
    for (const [k, v] of Object.entries(where)) {
      query = query.eq(k, v);
    }
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.order === 'asc' });
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const { data, error } = await query;
    if (error) { console.error(`[Supabase] All Error (${table}):`, error); throw error; }
    return data || [];
  }
  
  async raw(sql, params) {
    console.warn("[Supabase] raw() is not supported on REST API. Rewrite to use insert/get/all/update.");
  }
}

class SQLiteAdapter {
  constructor(sqliteDb) {
    this.db = sqliteDb;
  }
  
  async insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    return await this.db.run(sql, values);
  }
  
  async update(table, data, where) {
    const dataKeys = Object.keys(data);
    const setClause = dataKeys.map(k => `${k} = ?`).join(', ');
    const whereKeys = Object.keys(where);
    const whereClause = whereKeys.map(k => `${k} = ?`).join(' AND ');
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(where)];
    return await this.db.run(sql, params);
  }
  
  async get(table, where = {}, options = {}) {
    const keys = Object.keys(where);
    let sql = `SELECT * FROM ${table}`;
    let params = [];
    if (keys.length > 0) {
      sql += ` WHERE ` + keys.map(k => `${k} = ?`).join(' AND ');
      params = Object.values(where);
    }
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy} ${options.order === 'asc' ? 'ASC' : 'DESC'}`;
    }
    sql += ` LIMIT 1`;
    return await this.db.get(sql, params);
  }
  
  async all(table, where = {}, options = {}) {
    const keys = Object.keys(where);
    let sql = `SELECT * FROM ${table}`;
    let params = [];
    if (keys.length > 0) {
      sql += ` WHERE ` + keys.map(k => `${k} = ?`).join(' AND ');
      params = Object.values(where);
    }
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy} ${options.order === 'asc' ? 'ASC' : 'DESC'}`;
    }
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    return await this.db.all(sql, params);
  }
  
  async raw(sql, params) {
    if (sql.trim().toUpperCase().startsWith('SELECT')) return await this.db.all(sql, params);
    return await this.db.run(sql, params);
  }
}

class MockAdapter {
  constructor() {
    console.log("[DB] Initialized Memory Mock DB (Warning: Data will not persist on serverless)");
    this.tables = {
      users: [], repositories: [], scans: [], journeys: [], broken_flows: [], issues: [], ai_fix_plans: [], reports: []
    };
  }
  async insert(table, data) {
    if(!this.tables[table]) this.tables[table] = [];
    const id = data.id || Date.now().toString();
    this.tables[table].push({ ...data, id });
    return { lastID: id };
  }
  async update(table, data, where) {
    if(!this.tables[table]) return;
    const items = this.tables[table].filter(item => Object.keys(where).every(k => item[k] === where[k]));
    items.forEach(item => Object.assign(item, data));
  }
  async get(table, where = {}, options = {}) {
    if(!this.tables[table]) return null;
    let items = this.tables[table].filter(item => Object.keys(where).every(k => item[k] === where[k]));
    if (options.orderBy) items.sort((a,b) => options.order === 'asc' ? (a[options.orderBy] > b[options.orderBy] ? 1 : -1) : (a[options.orderBy] < b[options.orderBy] ? 1 : -1));
    return items.length > 0 ? items[0] : null;
  }
  async all(table, where = {}, options = {}) {
    if(!this.tables[table]) return [];
    let items = this.tables[table].filter(item => Object.keys(where).every(k => item[k] === where[k]));
    if (options.orderBy) items.sort((a,b) => options.order === 'asc' ? (a[options.orderBy] > b[options.orderBy] ? 1 : -1) : (a[options.orderBy] < b[options.orderBy] ? 1 : -1));
    if (options.limit) items = items.slice(0, options.limit);
    return items;
  }
  async raw() {}
}

export async function initDb() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    console.log(`[DB] Supabase credentials found. Initializing Supabase client.`);
    dbInstance = new SupabaseAdapter(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    return;
  }
  
  if (!!process.env.VERCEL) {
    console.log(`[DB] Vercel detected without Supabase keys. Using Mock DB (Data will NOT persist). Please add SUPABASE_URL and SUPABASE_ANON_KEY.`);
    dbInstance = new MockAdapter();
    return;
  }

  try {
    const sqlite3 = (await import('sqlite3')).default;
    const { open } = await import('sqlite');
    
    const dbPath = path.join(__dirname, 'launchguard.db');
    console.log(`[DB] Initializing SQLite database at: ${dbPath}`);
    
    const sqliteDb = await open({ filename: dbPath, driver: sqlite3.Database });
    
    await sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS repositories (id TEXT PRIMARY KEY, user_id INTEGER, name TEXT, url TEXT, framework TEXT, language TEXT, architecture TEXT, readme_summary TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS scans (id TEXT PRIMARY KEY, repository_id TEXT, name TEXT, deploy_url TEXT, status TEXT, score INTEGER, api_failures INTEGER DEFAULT 0, performance INTEGER DEFAULT 0, error_message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS journeys (id TEXT PRIMARY KEY, scan_id TEXT, path TEXT, status TEXT, screenshot TEXT, errors TEXT, console_errors TEXT, network_errors TEXT, load_time INTEGER, a11y_score INTEGER, perf_score INTEGER);
      CREATE TABLE IF NOT EXISTS broken_flows (id TEXT PRIMARY KEY, scan_id TEXT, name TEXT, score INTEGER, fail_step TEXT, duration TEXT, screenshot TEXT, console_error TEXT, network_error TEXT, dom_snapshot TEXT, severity TEXT, confidence INTEGER);
      CREATE TABLE IF NOT EXISTS issues (id TEXT PRIMARY KEY, scan_id TEXT, title TEXT, status TEXT, severity TEXT, area TEXT, root_cause TEXT, patch TEXT, affected_url TEXT, affected_component TEXT, before_code TEXT, after_code TEXT, screenshot TEXT, console_error TEXT, network_error TEXT, stack_trace TEXT, confidence INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS ai_fix_plans (id TEXT PRIMARY KEY, issue_id TEXT, problem_analysis TEXT, engineering_solution TEXT, developer_prompt TEXT, ide_usage_guide TEXT, model TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, scan_id TEXT, summary TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    `);
    
    dbInstance = new SQLiteAdapter(sqliteDb);
  } catch (err) {
    console.error(`[DB] Failed to initialize SQLite:`, err.message);
    dbInstance = new MockAdapter();
  }
}

export function getDb() {
  if (!dbInstance) throw new Error("Database not initialized. Call initDb() first.");
  return dbInstance;
}

export async function getLatestScanId(db) {
  const latestScan = await db.get('scans', {}, { orderBy: 'created_at', order: 'desc' });
  return latestScan ? latestScan.id : null;
}
