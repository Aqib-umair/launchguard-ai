// ╔══════════════════════════════════════════════════════════════╗
// ║                LaunchGuard AI – server.js                  ║
// ║  All imports fixed. Playwright lazy-loaded. JSON-safe.     ║
// ╚══════════════════════════════════════════════════════════════╝
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// ── Startup env audit ──────────────────────────────────────────
console.log('[STARTUP] Environment variable audit:', {
  SUPABASE_URL:             !!process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY:        !!process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY:!!process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENROUTER_API_KEY:       !!process.env.OPENROUTER_API_KEY,
  GEMINI_API_KEY:           !!process.env.GEMINI_API_KEY,
  VERCEL:                   !!process.env.VERCEL,
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Supabase clients ───────────────────────────────────────────
// Anon client (used for sign-in)
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null;

if (!supabase) {
  console.error('[STARTUP] WARNING: supabase anon client NOT initialized (missing SUPABASE_URL or SUPABASE_ANON_KEY)');
}

// Admin client (used for createUser, service operations)
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

if (!supabaseAdmin) {
  console.error('[STARTUP] WARNING: supabaseAdmin NOT initialized (missing SUPABASE_SERVICE_ROLE_KEY)');
}

// ── Express app ────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Async error wrapper ────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('[BACKEND ERROR]', {
      endpoint: req.originalUrl,
      method:   req.method,
      error:    err.message,
      stack:    err.stack,
    });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
  });
};

// ── Helper ────────────────────────────────────────────────────
async function getLatestScanId() {
  if (!supabase) return null;
  const { data } = await supabase.from('scans').select('id').order('created_at', { ascending: false }).limit(1);
  return data && data.length > 0 ? data[0].id : null;
}

// ══════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', asyncHandler(async (req, res) => {
  let supabaseStatus = 'not_configured';
  if (supabase) {
    try {
      const { error } = await supabase.from('users').select('id').limit(1);
      supabaseStatus = error ? `error: ${error.message}` : 'connected';
    } catch (e) {
      supabaseStatus = `exception: ${e.message}`;
    }
  }
  res.json({
    status: 'ok',
    server: 'running',
    supabase: supabaseStatus,
    env: {
      SUPABASE_URL:              !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY:         !!process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      OPENROUTER_API_KEY:        !!process.env.OPENROUTER_API_KEY,
    },
    ts: new Date().toISOString(),
  });
}));

// ── Config ────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return res.status(500).json({
      success: false,
      error: 'Missing Supabase configuration in environment variables.',
      supabaseUrl: null,
      supabaseAnonKey: null,
    });
  }
  res.json({ success: true, supabaseUrl: url, supabaseAnonKey: key });
});

// ── Signup ────────────────────────────────────────────────────
app.post('/api/auth/signup', asyncHandler(async (req, res) => {
  const { name, email, password, github_username } = req.body;
  console.log('[SIGNUP] Step 1: request received for', email);

  if (!supabaseAdmin) {
    return res.status(500).json({ success: false, error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing.' });
  }

  console.log('[SIGNUP] Step 2: calling supabaseAdmin.auth.admin.createUser');
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, github_username },
  });

  if (authError) {
    console.error('[SIGNUP] Step 2 FAILED:', authError.message);
    return res.status(400).json({ success: false, error: authError.message });
  }

  const authUserId = authData.user.id;
  console.log('[SIGNUP] Step 2 OK: auth user created, id =', authUserId);

  console.log('[SIGNUP] Step 3: inserting into public.users');
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .insert([{
      auth_user_id: authUserId,
      name,
      email,
      github_username: github_username || null,
      login_timestamp: new Date().toISOString(),
      last_login:      new Date().toISOString(),
    }])
    .select()
    .single();

  if (profileError) {
    console.error('[SIGNUP] Step 3 FAILED:', profileError.message, profileError.details);
    return res.status(500).json({ success: false, error: 'Profile creation failed: ' + profileError.message });
  }

  console.log('[SIGNUP] Step 3 OK: public.users row created, id =', profile.id);
  console.log('[SIGNUP] Step 4: returning success response');
  res.json({ success: true, user: profile, authUserId });
}));

// ── Login ─────────────────────────────────────────────────────
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  console.log('[LOGIN] Step 1: request received for', email);

  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Server misconfigured: Supabase anon client not initialized.' });
  }

  console.log('[LOGIN] Step 2: calling supabase.auth.signInWithPassword');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    console.error('[LOGIN] Step 2 FAILED:', signInError.message);
    return res.status(401).json({ success: false, error: signInError.message });
  }

  const authUserId = signInData.user.id;
  console.log('[LOGIN] Step 2 OK: signed in, id =', authUserId);

  let profile = null;
  if (supabaseAdmin) {
    const { data, error: profileError } = await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('auth_user_id', authUserId)
      .select()
      .single();
    if (profileError) {
      console.warn('[LOGIN] Step 3 WARNING: could not update last_login:', profileError.message);
    } else {
      profile = data;
    }
  }

  console.log('[LOGIN] Step 3 OK: returning success response');
  res.json({
    success: true,
    user:    profile || { email, auth_user_id: authUserId },
    session: signInData.session,
  });
}));

// ── Legacy login (deprecated) ──────────────────────────────────
app.post('/api/login', (req, res) => {
  res.status(410).json({ success: false, error: 'Deprecated. Use /api/auth/signup or /api/auth/login.' });
});

// ── Dashboard ─────────────────────────────────────────────────
app.get('/api/dashboard', asyncHandler(async (req, res) => {
  if (!supabase) return res.json({ hasScan: false });
  const { data: latestScan } = await supabase.from('scans').select('*').order('created_at', { ascending: false }).limit(1).single();
  if (!latestScan) return res.json({ hasScan: false });
  const { data: issues }      = await supabase.from('issues').select('*').eq('scan_id', latestScan.id);
  const { data: brokenFlows } = await supabase.from('broken_flows').select('*').eq('scan_id', latestScan.id);
  res.json({
    hasScan: true,
    score: latestScan.score,
    brokenFlows: brokenFlows ? brokenFlows.length : 0,
    apiFailures: latestScan.api_failures,
    performance: latestScan.performance || 98,
    a11y: 0, security: 0,
    fixes: issues ? issues.length : 0,
    consoleErrs: latestScan.api_failures,
    networkErrs: latestScan.api_failures,
    latestScanName:   latestScan.name,
    latestScanStatus: latestScan.status,
  });
}));

// ── Reports ───────────────────────────────────────────────────
app.get('/api/reports/:scanId', asyncHandler(async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not initialized.' });
  const { scanId } = req.params;
  const { data: scan }     = await supabase.from('scans').select('*').eq('id', scanId).single();
  if (!scan) return res.status(404).json({ error: 'Scan not found' });
  const { data: repo }     = await supabase.from('repositories').select('*').eq('id', scan.repository_id).single();
  const { data: issues }   = await supabase.from('issues').select('*').eq('scan_id', scanId);
  const { data: flows }    = await supabase.from('broken_flows').select('*').eq('scan_id', scanId);
  const { data: evals }    = await supabase.from('evals').select('*').eq('scan_id', scanId);
  const { data: aiReport } = await supabase.from('ai_reports').select('*').eq('scan_id', scanId).single();
  res.json({ scan, repo, issues, flows, evals, aiData: aiReport ? aiReport.summary_json : null });
}));

// ── Repo preview ──────────────────────────────────────────────
app.get('/api/repo/preview', asyncHandler(async (req, res) => {
  const { url } = req.query;
  const empty = { repo:'',owner:'',name:'',branch:'',language:'Unknown',framework:'Web API',packageManager:'Unknown',testing:'None',database:'None',deployment:'Unknown',stars:0,forks:0,description:'',readme:'',estimatedPages:5,techStack:'Unknown' };
  if (!url || !url.includes('github.com')) return res.json(empty);
  try {
    const parts = url.replace(/\/$/, '').split('/');
    const repoOwner = parts[parts.length - 2];
    const repoName  = parts[parts.length - 1];
    let language = 'JavaScript', framework = 'Web API', packageManager = 'Unknown', stars = 0, forks = 0, description = '', readme = '', estimatedPages = 5;
    const ghRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`);
    let branch = 'main';
    if (ghRes.ok) {
      const d = await ghRes.json();
      language = d.language || language;
      branch = d.default_branch || 'main';
      stars = d.stargazers_count; forks = d.forks_count; description = d.description || '';
    }
    const treeRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/${branch}?recursive=1`);
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      if (treeData.tree) {
        const files = treeData.tree.map(t => t.path);
        if (files.includes('package-lock.json')) packageManager = 'npm';
        else if (files.includes('yarn.lock')) packageManager = 'Yarn';
        if (files.includes('next.config.js') || files.includes('next.config.mjs')) framework = 'Next.js';
        else if (files.includes('vite.config.js') || files.includes('vite.config.ts')) framework = 'Vite / React';
        estimatedPages = Math.max(5, files.filter(f => f.endsWith('page.tsx')).length);
      }
    }
    const rmRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/readme`);
    if (rmRes.ok) { const r = await rmRes.json(); if (r.content) readme = Buffer.from(r.content, 'base64').toString(); }
    res.json({ repo:`${repoOwner}/${repoName}`,owner:repoOwner,name:repoName,branch,language,framework,packageManager,testing:'None',database:'None',deployment:'Unknown',stars,forks,description,readme:readme.substring(0,1000),estimatedPages,techStack:`${language}, ${framework}` });
  } catch (err) {
    res.json(empty);
  }
}));

// ── Create scan (Playwright runs server-side, lazy import) ─────
app.post('/api/scans', asyncHandler(async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not initialized.' });
  const { name, repoUrl, deployUrl, user_id } = req.body;
  const repoId = repoUrl ? repoUrl.replace('https://github.com/', '') : `repo-${randomUUID().split('-')[0]}`;
  await supabase.from('repositories').upsert([{ id: repoId, name: repoUrl, url: repoUrl, user_id }]);
  const id = `SCAN-LG-2026-${randomUUID().split('-')[0].toUpperCase()}`;
  await supabase.from('scans').insert([{ id, repository_id: repoId, name, deploy_url: deployUrl, status: 'queued' }]);
  // Lazy-import scanner so Playwright is not loaded at startup
  import('./scanner.js').then(({ runScan }) => runScan(id, repoUrl, deployUrl)).catch(console.error);
  res.status(201).json({ id, name, status: 'queued' });
}));

// ── Scans list ────────────────────────────────────────────────
app.get('/api/scans', asyncHandler(async (req, res) => {
  if (!supabase) return res.json([]);
  const { data: scans } = await supabase.from('scans').select('*').order('created_at', { ascending: false }).limit(10);
  res.json(scans || []);
}));

// ── Issues ────────────────────────────────────────────────────
app.get('/api/issues', asyncHandler(async (req, res) => {
  if (!supabase) return res.json([]);
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json([]);
  const { data: issues } = await supabase.from('issues').select('*').eq('scan_id', sid).order('created_at', { ascending: false });
  res.json(issues || []);
}));

app.get('/api/issues/:id', asyncHandler(async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not initialized.' });
  const { data: issue } = await supabase.from('issues').select('*').eq('id', req.params.id).single();
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  res.json(issue);
}));

// ── Broken flows ──────────────────────────────────────────────
app.get('/api/broken_flows', asyncHandler(async (req, res) => {
  if (!supabase) return res.json([]);
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json([]);
  const { data: flows } = await supabase.from('broken_flows').select('*').eq('scan_id', sid);
  res.json(flows || []);
}));

// ── Journeys ──────────────────────────────────────────────────
app.get('/api/journeys', asyncHandler(async (req, res) => {
  if (!supabase) return res.json([]);
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json([]);
  const { data: nodes } = await supabase.from('journey_nodes').select('*').eq('scan_id', sid);
  res.json(nodes || []);
}));

// ── Evals ─────────────────────────────────────────────────────
app.get('/api/evals', asyncHandler(async (req, res) => {
  if (!supabase) return res.json([]);
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json([]);
  const { data: evals } = await supabase.from('evals').select('*').eq('scan_id', sid);
  res.json(evals || []);
}));

// ── AI fix plans ──────────────────────────────────────────────
app.get('/api/ai_fix_plans', asyncHandler(async (req, res) => {
  if (!supabase) return res.json([]);
  const { issueId } = req.query;
  if (!issueId) return res.json([]);
  const { data: plans } = await supabase.from('ai_fix_plans').select('*').eq('issue_id', issueId);
  res.json(plans || []);
}));

app.get('/api/ai/fix/recent', asyncHandler(async (req, res) => {
  if (!supabase) return res.json([]);
  const { data: fixes } = await supabase.from('ai_fix_plans').select('*').order('created_at', { ascending: false }).limit(5);
  res.json(fixes || []);
}));

// ── Ollama ping ───────────────────────────────────────────────
app.get('/api/ollama/ping', asyncHandler(async (req, res) => {
  try {
    const r = await fetch('http://localhost:11434/api/tags');
    if (r.ok) return res.json({ status: 'ok' });
    res.status(500).json({ status: 'error' });
  } catch (e) {
    res.status(500).json({ status: 'error', reason: 'Ollama not running' });
  }
}));

// ── AI Fix Assistant ──────────────────────────────────────────
app.post('/api/ai/fix', async (req, res) => {
  const { issueId, mode, model, apiKey } = req.body;
  console.log(`[AI Fix] request - Issue: ${issueId}, Mode: ${mode}`);
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not initialized.' });

    const { data: existingPlans } = await supabase.from('ai_fix_plans').select('*').eq('issue_id', issueId);
    if (existingPlans && existingPlans.length > 0) {
      return res.json(JSON.parse(existingPlans[0].problem_analysis));
    }

    const { data: issue } = await supabase.from('issues').select('*').eq('id', issueId).single();
    if (!issue) return res.status(404).json({ error: `Bug ID ${issueId} does not exist.` });
    const { data: scan } = await supabase.from('scans').select('*').eq('id', issue.scan_id).single();
    if (!scan) return res.status(400).json({ error: 'Required scan data was not collected.' });

    let packageJsonContent = '';
    let readmeContent = '';
    try { packageJsonContent = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'); } catch(e) {}
    try { readmeContent = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf-8'); } catch(e) {}

    const prompt = `You are a Principal AI Software Engineer analyzing a production bug.
Return a JSON object EXACTLY matching this structure:
{
  "repository_summary": "...",
  "architecture_mermaid": "...",
  "problem_analysis": { "bug_id": "${issueId}", "severity": "...", "why_happened": "...", "production_impact": "...", "affected_files": ["..."], "affected_function": "...", "affected_component": "...", "root_cause": "...", "bug_explanation": "..." },
  "engineering_solution": { "step_by_step": ["..."], "before_code": "...", "after_code": "...", "suggested_changes": "...", "regression_tests": ["..."], "confidence_score": 96 },
  "developer_prompt": "...",
  "ide_usage_guide": "..."
}
package.json: ${packageJsonContent.slice(0, 1000)}
Issue Title: ${issue.title}
Severity: ${issue.severity}
Console Errors: ${issue.console_error || 'None'}
Stack Trace: ${issue.stack_trace || 'None'}`;

    let aiData;
    if (mode === 'local') {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'llama3', prompt, format: 'json', stream: false })
      });
      if (!ollamaRes.ok) throw new Error('Ollama API Error. Make sure Ollama is running locally.');
      const rawData = await ollamaRes.json();
      aiData = { choices: [{ message: { content: rawData.response } }] };
    } else {
      const finalApiKey = apiKey || process.env.OPENROUTER_API_KEY;
      if (!finalApiKey) return res.status(401).json({ error: 'Invalid OpenRouter API key.' });
      const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${finalApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } })
      });
      if (!openRouterRes.ok) {
        const errText = await openRouterRes.text();
        let msg = `OpenRouter error ${openRouterRes.status}`;
        if (openRouterRes.status === 401) msg = 'Invalid OpenRouter API key.';
        else if (openRouterRes.status === 402) msg = 'Insufficient OpenRouter credits.';
        return res.status(openRouterRes.status).json({ error: msg });
      }
      aiData = await openRouterRes.json();
    }

    let parsedResponse = {};
    try { parsedResponse = JSON.parse(aiData.choices[0].message.content); }
    catch (e) { return res.status(500).json({ error: 'AI returned malformed JSON.' }); }

    const fixId = `FIX-${randomUUID().split('-')[0].toUpperCase()}`;
    await supabase.from('ai_fix_plans').insert([{
      id: fixId, issue_id: issueId,
      problem_analysis:    JSON.stringify(parsedResponse.problem_analysis),
      engineering_solution:JSON.stringify(parsedResponse.engineering_solution),
      developer_prompt:    parsedResponse.developer_prompt,
      ide_usage_guide:     parsedResponse.ide_usage_guide,
      model: model || 'google/gemini-2.5-flash'
    }]);
    res.json(parsedResponse);
  } catch (error) {
    console.error('[AI Fix] Exception:', error.message, error.stack);
    res.status(500).json({ error: error.message || 'Unable to generate AI analysis.' });
  }
});

// ── Static files ──────────────────────────────────────────────
app.use(express.static(__dirname));

// ── Catch-all → index.html ────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── API 404 ───────────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found: ' + req.originalUrl });
});

// ── Global error handler (always JSON) ────────────────────────
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR HANDLER]', err.message, err.stack);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    stack: err.stack,
  });
});

// ── Start (local dev only) ─────────────────────────────────────
if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`LaunchGuard AI running on http://localhost:${port}`));
}

export default app;
