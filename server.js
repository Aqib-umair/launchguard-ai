import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function getLatestScanId() {
  const { data: latest } = await supabase.from('scans').select('*').order('created_at', { ascending: false }).limit(1).single();
  return latest ? latest.id : null;
}

app.get('/api/config', (req, res) => res.json({ supabaseUrl: process.env.SUPABASE_URL, supabaseAnonKey: process.env.SUPABASE_ANON_KEY }));

app.get('/api/health', asyncHandler(async (req, res) => {
  const isHealthy = true;
  res.status(isHealthy ? 200 : 503).json({ status: isHealthy ? 'healthy' : 'degraded', timestamp: new Date().toISOString() });
}));

app.get('/api/dashboard', asyncHandler(async (req, res) => {
  const { data: latestScan } = await supabase.from('scans').select('*').order('created_at', { ascending: false }).limit(1).single();
  if (!latestScan) return res.json({ hasScan: false });
  const { data: vulnerabilities } = await supabase.from('vulnerabilities').select('*').eq('scan_id', latestScan.id);
  const { data: brokenFlows } = await supabase.from('broken_flows').select('*').eq('scan_id', latestScan.id);
  const { data: journeyNodes } = await supabase.from('journey_nodes').select('*').eq('scan_id', latestScan.id);
  const { data: networkLogs } = await supabase.from('network_logs').select('*').eq('scan_id', latestScan.id);
  
  res.json({
    hasScan: true, score: latestScan.score || 0, brokenFlows: brokenFlows ? brokenFlows.length : 0,
    apiFailures: latestScan.api_failures || 0, performance: latestScan.performance || 98,
    a11y: 0, security: 0, fixes: vulnerabilities ? vulnerabilities.length : 0,
    bugsFound: vulnerabilities ? vulnerabilities.length : 0, pagesScanned: journeyNodes ? journeyNodes.length : 0,
    apiCallsChecked: networkLogs ? networkLogs.length : 0, consoleErrs: latestScan.api_failures || 0,
    networkErrs: latestScan.api_failures || 0, latestScanName: latestScan.name, latestScanStatus: latestScan.status,
  });
}));

app.get('/api/reports/:scanId', asyncHandler(async (req, res) => {
  const { data: report } = await supabase.from('reports').select('*').eq('scan_id', req.params.scanId).single();
  res.json(report || { report_data: {} });
}));

app.get('/api/repo/preview', asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url || !url.includes('github.com')) return res.status(400).json({ error: 'Valid GitHub URL required.' });
  
  const repoId = url.replace('https://github.com/', '').replace(/\/$/, '');
  let preview = {
    repo: repoId,
    name: repoId.split('/')[1] || repoId,
    owner: repoId.split('/')[0] || 'Unknown',
    description: '',
    stars: 0,
    forks: 0,
    language: 'Unknown',
    framework: 'Unknown',
    packageManager: 'NPM',
    database: 'Unknown',
    deployment: 'Unknown',
    estimatedPages: Math.floor(Math.random() * 20) + 5,
    techStack: 'Node.js, Express'
  };
  
  try {
    const ghRes = await fetch(`https://api.github.com/repos/${repoId}`);
    if (ghRes.ok) {
      const data = await ghRes.json();
      preview.name = data.name || preview.name;
      preview.description = data.description || '';
      preview.stars = data.stargazers_count || 0;
      preview.forks = data.forks_count || 0;
      preview.owner = data.owner?.login || preview.owner;
      preview.language = data.language || 'Unknown';
    }
  } catch (e) {
    console.error('Preview fetch error:', e.message);
  }
  
  res.json(preview);
}));

app.post('/api/scans/start', asyncHandler(async (req, res) => {
  console.log('ENDPOINT HIT: /api/scans/start', req.body);
  const { name, repoUrl, deployUrl, user_id } = req.body;
  const repoId = repoUrl ? repoUrl.replace('https://github.com/', '').replace(/\/$/, '') : `repo-${randomUUID().split('-')[0]}`;
  
  const repositoryObject = { 
    id: repoId, 
    user_email: user_id || 'test@example.com',
    name: repoUrl || 'Local Test', 
    owner: '',
    url: repoUrl || 'http://localhost', 
    framework: 'Unknown',
    language: 'Unknown',
    architecture: 'Unknown',
    readme_summary: '',
    tech_stack: '',
    estimated_pages: 0,
    stars: 0,
    forks: 0,
    description: ''
  };
  
  console.log("INSERT PAYLOAD", repositoryObject);
  const { error: repoErr } = await supabase.from('repositories').upsert([repositoryObject]);
  console.log(repoErr);
  
  if (repoErr) {
    return res.status(500).json(repoErr);
  }

  // Fetch GitHub Metadata after successful insert
  let ghName = repositoryObject.name;
  let ghOwner = '';
  let ghLanguage = '';
  let ghStars = 0;
  let ghDescription = '';
  let ghForks = 0;
  
  if (repoUrl && repoUrl.includes('github.com')) {
    try {
      const ghRes = await fetch(`https://api.github.com/repos/${repoId}`);
      if (ghRes.ok) {
        const ghData = await ghRes.json();
        ghName = ghData.name || ghName;
        ghOwner = ghData.owner?.login || '';
        ghLanguage = ghData.language || '';
        ghStars = ghData.stargazers_count || 0;
        ghDescription = ghData.description || '';
        ghForks = ghData.forks_count || 0;
        
        // Update repository record
        const { error: updateErr } = await supabase.from('repositories').update({
          name: ghName,
          owner: ghOwner,
          language: ghLanguage,
          stars: ghStars,
          description: ghDescription,
          forks: ghForks
        }).eq('id', repoId);
        
        if (updateErr) console.error('Failed to update repo metadata:', updateErr);
      }
    } catch (e) {
      console.error('GitHub API Fetch failed:', e.message);
    }
  }

  const id = `SCAN-LG-2026-${randomUUID().split('-')[0].toUpperCase()}`;
  const scanName = name || ghName || 'Test Scan';
  const { error: scanErr } = await supabase.from('scans').insert([{ id, repository_id: repoId, name: scanName, deploy_url: deployUrl || '', status: 'queued' }]);
  
  if (scanErr) {
    return res.status(500).json(scanErr);
  }
  
  // Start Scanner Asynchronously
  import('./scanner.js').then(({ runScan }) => runScan(id, repoUrl, deployUrl, supabase)).catch(console.error);
  res.status(201).json({ id, name: scanName, status: 'queued' });
}));

app.get('/api/scan_logs', asyncHandler(async (req, res) => {
  const sid = req.query.scanId;
  if (!sid) return res.json([]);
  const { data: logs } = await supabase.from('scan_logs').select('*').eq('scan_id', sid);
  res.json(logs || []);
}));

app.get('/api/scans/:id', asyncHandler(async (req, res) => {
  const { data: scan } = await supabase.from('scans').select('*').eq('id', req.params.id).single();
  res.json(scan || {});
}));

app.get('/api/scans', asyncHandler(async (req, res) => {
  const { data: scans } = await supabase.from('scans').select('*').order('created_at', { ascending: false }).limit(10);
  res.json(scans || []);
}));

app.get('/api/issues', asyncHandler(async (req, res) => {
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json([]);
  const { data: issues } = await supabase.from('vulnerabilities').select('*').eq('scan_id', sid);
  res.json(issues || []);
}));

app.get('/api/issues/:id', asyncHandler(async (req, res) => {
  const { data: issue } = await supabase.from('vulnerabilities').select('*').eq('id', req.params.id).single();
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  res.json(issue);
}));

app.get('/api/broken_flows', asyncHandler(async (req, res) => {
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json([]);
  const { data: flows } = await supabase.from('broken_flows').select('*').eq('scan_id', sid);
  res.json(flows || []);
}));

app.get('/api/journeys', asyncHandler(async (req, res) => {
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json({ nodes: [], edges: [] });
  const { data: nodes } = await supabase.from('journey_nodes').select('*').eq('scan_id', sid);
  const { data: edges } = await supabase.from('journey_edges').select('*').eq('scan_id', sid);
  res.json({ nodes: nodes || [], edges: edges || [] });
}));

app.get('/api/evals', asyncHandler(async (req, res) => {
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json([]);
  const { data: evals } = await supabase.from('evals').select('*').eq('scan_id', sid);
  res.json(evals || []);
}));

app.get('/api/ai_fix_plans', asyncHandler(async (req, res) => {
  const { issueId } = req.query;
  if (!issueId) return res.json([]);
  const { data: plans } = await supabase.from('ai_fix_plans').select('*').eq('vulnerability_id', issueId);
  res.json(plans || []);
}));

app.get('/api/ai/fix/recent', asyncHandler(async (req, res) => {
  const { data: fixes } = await supabase.from('ai_fix_plans').select('*').order('created_at', { ascending: false }).limit(5);
  res.json(fixes || []);
}));

app.get('/api/ollama/ping', asyncHandler(async (req, res) => {
  try {
    const r = await fetch('http://localhost:11434/api/tags');
    if (r.ok) return res.json({ status: 'ok' });
    res.status(500).json({ status: 'error' });
  } catch (e) {
    res.status(500).json({ status: 'error', reason: 'Ollama not running' });
  }
}));

app.post('/api/ai/fix', async (req, res) => {
  res.status(500).json({ error: 'AI Fix Endpoint Called' });
});

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found: ' + req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR HANDLER]', err.message, err.stack);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error', stack: err.stack });
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL_ENV) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`LaunchGuard AI running on http://localhost:${port}`));
} else if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`LaunchGuard AI running on http://localhost:${port}`));
}

export default app;
