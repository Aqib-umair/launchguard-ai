-- ============================================================
-- Migration: Add auth_user_id and profile columns to users
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add missing columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- 2. Make auth_user_id unique (links Supabase Auth → public.users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_user_id_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_auth_user_id_unique UNIQUE (auth_user_id);
  END IF;
END $$;

-- 3. Enable RLS on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. Drop old policies if they exist and recreate
DROP POLICY IF EXISTS "service_role_full_access_users" ON users;
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;

-- 5. Service role can do everything (backend uses service role key)
CREATE POLICY "service_role_full_access_users"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Authenticated users can read their own row
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- 7. Authenticated users can update their own row
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id);
