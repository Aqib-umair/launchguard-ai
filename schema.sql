-- Supabase SQL Schema for LaunchGuard AI Reliability Platform

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    username TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Repositories
CREATE TABLE IF NOT EXISTS repositories (
    id TEXT PRIMARY KEY, -- Can be github owner/repo
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner TEXT,
    url TEXT NOT NULL,
    framework TEXT,
    language TEXT,
    architecture TEXT,
    readme_summary TEXT,
    tech_stack TEXT,
    estimated_pages INTEGER,
    stars INTEGER,
    forks INTEGER,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Repository Analysis
CREATE TABLE IF NOT EXISTS repository_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id TEXT REFERENCES repositories(id) ON DELETE CASCADE,
    architecture_summary TEXT,
    repository_summary TEXT,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Scans
CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    repository_id TEXT REFERENCES repositories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    deploy_url TEXT,
    status TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    api_failures INTEGER DEFAULT 0,
    performance INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Journeys
CREATE TABLE IF NOT EXISTS journeys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Journey Nodes
CREATE TABLE IF NOT EXISTS journey_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    status_code INTEGER,
    load_time INTEGER,
    a11y_score INTEGER,
    perf_score INTEGER,
    screenshot_url TEXT,
    console_errors INTEGER DEFAULT 0,
    network_errors INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Journey Edges
CREATE TABLE IF NOT EXISTS journey_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
    source_path TEXT NOT NULL,
    target_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Broken Flows
CREATE TABLE IF NOT EXISTS broken_flows (
    id TEXT PRIMARY KEY,
    scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    score INTEGER,
    fail_step TEXT,
    duration TEXT,
    screenshot_url TEXT,
    console_error TEXT,
    network_error TEXT,
    dom_snapshot TEXT,
    severity TEXT,
    confidence INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Evals
CREATE TABLE IF NOT EXISTS evals (
    id TEXT PRIMARY KEY,
    scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_url TEXT,
    prompt TEXT,
    status TEXT, -- PASSED, FAILED
    reasoning TEXT,
    score INTEGER,
    recommendation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Issues
CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY, -- BUG-LG-YYYY-XXXX
    scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'OPEN',
    severity TEXT,
    area TEXT,
    root_cause TEXT,
    patch TEXT,
    affected_url TEXT,
    affected_component TEXT,
    affected_file TEXT,
    before_code TEXT,
    after_code TEXT,
    screenshot_url TEXT,
    console_error TEXT,
    network_error TEXT,
    stack_trace TEXT,
    confidence INTEGER,
    recommendation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Stack Traces
CREATE TABLE IF NOT EXISTS stack_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE,
    trace TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Console Logs
CREATE TABLE IF NOT EXISTS console_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
    path TEXT,
    level TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Network Logs
CREATE TABLE IF NOT EXISTS network_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
    path TEXT,
    url TEXT,
    status INTEGER,
    method TEXT,
    duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Screenshots
CREATE TABLE IF NOT EXISTS screenshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
    path TEXT,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. AI Fix Plans
CREATE TABLE IF NOT EXISTS ai_fix_plans (
    id TEXT PRIMARY KEY,
    issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE,
    problem_analysis TEXT,
    engineering_solution TEXT,
    developer_prompt TEXT,
    ide_usage_guide TEXT,
    model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. AI Reports
CREATE TABLE IF NOT EXISTS ai_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
    summary_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. Engineering Prompts
CREATE TABLE IF NOT EXISTS engineering_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id TEXT REFERENCES scans(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
