import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

console.log("SUPABASE_URL =", !!process.env.SUPABASE_URL);
console.log("SUPABASE_ANON_KEY =", !!process.env.SUPABASE_ANON_KEY);
console.log("SUPABASE_SERVICE_ROLE_KEY =", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client = null;
let adminClient = null;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("SUPABASE_ANON_KEY");
  console.error("Missing environment variables for anon client:", missing.join(", "));
} else {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.error("Exception during createClient(anon):", e);
  }
}

if (!supabaseUrl || !supabaseServiceRole) {
  const missing = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabaseServiceRole) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  console.error("Missing environment variables for admin client:", missing.join(", "));
} else {
  try {
    adminClient = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  } catch (e) {
    console.error("Exception during createClient(admin):", e);
  }
}

export const supabase = client;
export const supabaseAdmin = adminClient;
