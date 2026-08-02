import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let dbInstance = null;
const memoryStore = {};

class MemoryAdapter {
  async insert(table, data) {
    if (!memoryStore[table]) memoryStore[table] = [];
    if (!data.id) data.id = Math.random().toString(36).substr(2, 9);
    memoryStore[table].push(data);
    return { lastID: data.id };
  }
  
  async update(table, data, where) {
    if (!memoryStore[table]) return true;
    for (let i = 0; i < memoryStore[table].length; i++) {
      const item = memoryStore[table][i];
      let match = true;
      for (const [k, v] of Object.entries(where)) {
        if (item[k] !== v) { match = false; break; }
      }
      if (match) {
        memoryStore[table][i] = { ...item, ...data };
      }
    }
    return true;
  }
  
  async get(table, where = {}, options = {}) {
    if (!memoryStore[table]) return null;
    let results = memoryStore[table].filter(item => {
      for (const [k, v] of Object.entries(where)) {
        if (item[k] !== v) return false;
      }
      return true;
    });
    
    if (options.orderBy) {
      results.sort((a, b) => {
        if (a[options.orderBy] < b[options.orderBy]) return options.order === 'asc' ? -1 : 1;
        if (a[options.orderBy] > b[options.orderBy]) return options.order === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return results.length > 0 ? results[0] : null;
  }
  
  async all(table, where = {}, options = {}) {
    if (!memoryStore[table]) return [];
    let results = memoryStore[table].filter(item => {
      for (const [k, v] of Object.entries(where)) {
        if (item[k] !== v) return false;
      }
      return true;
    });
    
    if (options.orderBy) {
      results.sort((a, b) => {
        if (a[options.orderBy] < b[options.orderBy]) return options.order === 'asc' ? -1 : 1;
        if (a[options.orderBy] > b[options.orderBy]) return options.order === 'asc' ? 1 : -1;
        return 0;
      });
    }
    if (options.limit) return results.slice(0, options.limit);
    return results;
  }
  
  async raw(sql, params) {
    console.warn("[MemoryDB] raw() is not supported.");
  }
}


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
    console.warn("[DB] WARNING: Supabase credentials not found. Falling back to MemoryAdapter (local session only).");
    dbInstance = new MemoryAdapter();
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
