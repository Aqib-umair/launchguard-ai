import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

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

export async function initDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.error("[DB] FATAL ERROR: Supabase credentials not found. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in the environment.");
    // Wait, the client will fail to construct if url/key are undefined.
    // So we just pass empty strings so it fails downstream instead of crashing server.js initialization.
    dbInstance = new SupabaseAdapter(url || 'https://mock.supabase.co', key || 'mock');
    return;
  }
  
  console.log(`[DB] Initializing Supabase client with URL: ${url}`);
  dbInstance = new SupabaseAdapter(url, key);
}

export function getDb() {
  if (!dbInstance) throw new Error("Database not initialized. Call initDb() first.");
  return dbInstance;
}

export async function getLatestScanId(db) {
  const latestScan = await db.get('scans', {}, { orderBy: 'created_at', order: 'desc' });
  return latestScan ? latestScan.id : null;
}
