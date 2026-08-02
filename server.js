import express from 'express';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import cors from 'cors';
import { supabase } from './lib/supabase.js';
import { runScan } from './scanner.js';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(JSON.stringify({ endpoint: req.originalUrl, method: req.method, error: err.message, stack: err.stack }));
    if (!res.headersSent) {
      res.status(500).json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
    }
  });
};

async function getLatestScanId() {
  const { data } = await supabase.from('scans').select('id').order('created_at', { ascending: false }).limit(1);
  return data && data.length > 0 ? data[0].id : null;
}

app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

// API Routes
app.post('/api/login', asyncHandler(async (req, res) => {
  const { name, email, github_username, avatar } = req.body;
  let { data: user } = await supabase.from('users').select('*').eq('email', email).single();
  
  if (!user) {
    const { data } = await supabase.from('users').insert([{ 
      name, email, github_username, avatar, 
      login_timestamp: new Date().toISOString(), 
      last_login: new Date().toISOString() 
    }]).select().single();
    user = data;
  } else {
    const { data } = await supabase.from('users').update({ 
      last_login: new Date().toISOString() 
    }).eq('email', email).select().single();
    user = data;
  }
  res.json({ user });
}));

app.get('/api/reports/:scanId', asyncHandler(async (req, res) => {
  const { scanId } = req.params;
  const { data: scan } = await supabase.from('scans').select('*').eq('id', scanId).single();
  if (!scan) return res.status(404).json({ error: 'Scan not found' });
  
  const { data: repo } = await supabase.from('repositories').select('*').eq('id', scan.repository_id).single();
  const { data: issues } = await supabase.from('issues').select('*').eq('scan_id', scanId);
  const { data: flows } = await supabase.from('broken_flows').select('*').eq('scan_id', scanId);
  const { data: evals } = await supabase.from('evals').select('*').eq('scan_id', scanId);
  const { data: aiReport } = await supabase.from('ai_reports').select('*').eq('scan_id', scanId).single();
  
  res.json({ scan, repo, issues, flows, evals, aiData: aiReport ? aiReport.summary_json : null });
}));

app.get('/api/dashboard', asyncHandler(async (req, res) => {
  const { data: latestScan } = await supabase.from('scans').select('*').order('created_at', { ascending: false }).limit(1).single();
  if (!latestScan) return res.json({ hasScan: false });
  
  const { data: issues } = await supabase.from('issues').select('*').eq('scan_id', latestScan.id);
  const { data: brokenFlows } = await supabase.from('broken_flows').select('*').eq('scan_id', latestScan.id);
  
  res.json({
    hasScan: true,
    score: latestScan.score,
    brokenFlows: brokenFlows ? brokenFlows.length : 0,
    apiFailures: latestScan.api_failures,
    performance: latestScan.performance || 98,
    a11y: 0, security: 0, fixes: issues ? issues.length : 0, consoleErrs: latestScan.api_failures, networkErrs: latestScan.api_failures,
    latestScanName: latestScan.name,
    latestScanStatus: latestScan.status
  });
}));

app.get('/api/repo/preview', asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url || !url.includes('github.com')) {
    return res.json({ repo: '', owner: '', name: '', branch: '', language: 'Unknown', framework: 'Web API', packageManager: 'Unknown', testing: 'None', database: 'None', deployment: 'Unknown', stars: 0, forks: 0, description: '', readme: '', estimatedPages: 5, techStack: 'Unknown' });
  }
  try {
    const parts = url.replace(/\/$/, '').split('/');
    const repoOwner = parts[parts.length - 2];
    const repoName = parts[parts.length - 1];
    
    let repo = `${repoOwner}/${repoName}`;
    let owner = repoOwner;
    let name = repoName;
    let branch = 'main';
    let language = 'JavaScript';
    let framework = 'Web API';
    let packageManager = 'Unknown';
    let testing = 'None';
    let database = 'None';
    let deployment = 'Unknown';
    let stars = 0;
    let forks = 0;
    let description = '';
    let readme = '';
    let estimatedPages = 5;
    let techStack = [];
    
    const ghRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`);
    if (ghRes.ok) {
      const data = await ghRes.json();
      if (data.language) language = data.language;
      repo = data.full_name;
      branch = data.default_branch || 'main';
      stars = data.stargazers_count;
      forks = data.forks_count;
      description = data.description || '';
    }
    
    const treeRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/${branch}?recursive=1`);
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      if (treeData.tree) {
        const files = treeData.tree.map(t => t.path);
        
        if (files.includes('package-lock.json')) packageManager = 'npm';
        else if (files.includes('yarn.lock')) packageManager = 'Yarn';
        else if (files.includes('pnpm-lock.yaml')) packageManager = 'pnpm';
        
        if (files.includes('next.config.js') || files.includes('next.config.mjs')) framework = 'Next.js';
        else if (files.includes('vite.config.js') || files.includes('vite.config.ts')) framework = 'Vite / React';
        else if (files.includes('angular.json')) framework = 'Angular';
        
        const appPages = files.filter(f => f.startsWith('app/') && f.endsWith('page.tsx'));
        const pagesDir = files.filter(f => f.startsWith('pages/') && f.endsWith('.tsx'));
        estimatedPages = Math.max(5, appPages.length + pagesDir.length);
      }
    }
    
    const rmRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/readme`);
    if (rmRes.ok) {
      const rmData = await rmRes.json();
      if (rmData.content) readme = Buffer.from(rmData.content, 'base64').toString();
    }
    
    if (techStack.length === 0) techStack.push(language, framework);
    
    res.json({ 
      repo, owner, name, branch, language, framework, packageManager, testing, database, deployment,
      stars, forks, description, readme: readme.substring(0, 1000) + (readme.length > 1000 ? '...' : ''),
      estimatedPages, techStack: techStack.join(', ')
    });
  } catch (err) {
    res.json({ repo: '', owner: '', name: '', branch: '', language: 'Unknown', framework: 'Web API', packageManager: 'Unknown', testing: 'None', database: 'None', deployment: 'Unknown', stars: 0, forks: 0, description: '', readme: '', estimatedPages: 5, techStack: 'Unknown' });
  }
}));

app.post('/api/scans', asyncHandler(async (req, res) => {
  const { name, repoUrl, deployUrl, user_id } = req.body;
  const repoId = repoUrl ? repoUrl.replace('https://github.com/', '') : `repo-${randomUUID().split('-')[0]}`;
  
  await supabase.from('repositories').upsert([{ id: repoId, name: repoUrl, url: repoUrl, user_id }]);
  
  const id = `SCAN-LG-2026-${randomUUID().split('-')[0].toUpperCase()}`;
  await supabase.from('scans').insert([{ id, repository_id: repoId, name, deploy_url: deployUrl, status: 'queued' }]);
  
  // Start scan asynchronously
  runScan(id, repoUrl, deployUrl);
  res.status(201).json({ id, name, status: 'queued' });
}));

app.get('/api/scans', asyncHandler(async (req, res) => {
  const { data: scans } = await supabase.from('scans').select('*').order('created_at', { ascending: false }).limit(10);
  res.json(scans || []);
}));

app.get('/api/issues', asyncHandler(async (req, res) => {
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json([]);
  const { data: issues } = await supabase.from('issues').select('*').eq('scan_id', sid).order('created_at', { ascending: false });
  res.json(issues || []);
}));

app.get('/api/issues/:id', asyncHandler(async (req, res) => {
  const { data: issue } = await supabase.from('issues').select('*').eq('id', req.params.id).single();
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  res.json(issue);
}));

app.get('/api/ollama/ping', asyncHandler(async (req, res) => {
  try {
    const fetchRes = await fetch('http://localhost:11434/api/tags');
    if (fetchRes.ok) return res.json({ status: 'ok' });
    res.status(500).json({ status: 'error' });
  } catch (e) {
    res.status(500).json({ status: 'error' });
  }
}));

app.get('/api/broken_flows', asyncHandler(async (req, res) => {
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json([]);
  const { data: flows } = await supabase.from('broken_flows').select('*').eq('scan_id', sid);
  res.json(flows || []);
}));

app.get('/api/journeys', asyncHandler(async (req, res) => {
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json([]);
  const { data: nodes } = await supabase.from('journey_nodes').select('*').eq('scan_id', sid);
  res.json(nodes || []);
}));

app.get('/api/evals', asyncHandler(async (req, res) => {
  const sid = req.query.scanId || await getLatestScanId();
  if (!sid) return res.json([]);
  const { data: evals } = await supabase.from('evals').select('*').eq('scan_id', sid);
  res.json(evals || []);
}));

app.get('/api/ai_fix_plans', asyncHandler(async (req, res) => {
  const issueId = req.query.issueId;
  if (!issueId) return res.json([]);
  const { data: plans } = await supabase.from('ai_fix_plans').select('*').eq('issue_id', issueId);
  res.json(plans || []);
}));

app.post('/api/ai/fix', async (req, res) => {
  const { issueId, mode, model, apiKey } = req.body;
  console.log(`\n[AI Fix Assistant] Incoming request - Issue: ${issueId}, Mode: ${mode}, Model: ${model}`);
  
  try {
    // Check if plan already exists
    const { data: existingPlans } = await supabase.from('ai_fix_plans').select('*').eq('issue_id', issueId);
    if (existingPlans && existingPlans.length > 0) {
      console.log(`[AI Fix Assistant] Fix plan already exists. Returning cached plan.`);
      return res.json(JSON.parse(existingPlans[0].problem_analysis)); // Just return 200, frontend will fetch it
    }

    const { data: issue } = await supabase.from('issues').select('*').eq('id', issueId).single();
    if (!issue) return res.status(404).json({ error: `Bug ID ${issueId} does not exist.` });
    
    const { data: scan } = await supabase.from('scans').select('*').eq('id', issue.scan_id).single();
    if (!scan) return res.status(400).json({ error: 'Required scan data was not collected.' });
    
    let packageJson = '';
    let readme = '';
    try { packageJson = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'); } catch(e) {}
    try { readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf-8'); } catch(e) {}
    
    const prompt = `You are a Principal AI Software Engineer analyzing a production bug.
Return a JSON object EXACTLY matching this structure:
{
  "repository_summary": "Explain what the project does. Frontend framework, Backend framework, Database, Authentication, Main dependencies, Build system. Use beginner-friendly language.",
  "architecture_mermaid": "Generate a clean visual architecture diagram based on the repository (README, package.json). Do NOT hardcode this. Return RAW Mermaid markdown ONLY without backticks.",
  "problem_analysis": {
    "bug_id": "${issueId}",
    "severity": "Severity level",
    "why_happened": "Explanation of why the bug occurred",
    "production_impact": "Impact on production",
    "affected_files": ["file1.js"],
    "affected_function": "Function name",
    "affected_component": "Component name",
    "root_cause": "Detailed root cause",
    "bug_explanation": "A beginner-friendly explanation of the bug"
  },
  "engineering_solution": {
    "step_by_step": ["Step 1 explanation", "Step 2 explanation"],
    "before_code": "Raw code before changes",
    "after_code": "Raw code after changes",
    "suggested_changes": "Explanation of changes made",
    "regression_tests": ["Test 1", "Test 2"],
    "confidence_score": 96
  },
  "developer_prompt": "Generate ONE complete engineering prompt that is ready to paste into an AI coding assistant.",
  "ide_usage_guide": "Brief guide on how to use the developer prompt in an IDE."
}

Repository Context:
package.json:
${packageJson.slice(0, 1000)}
README:
${readme.slice(0, 1000)}

Issue Context:
Title: ${issue.title}
Severity: ${issue.severity}
Component: ${issue.affected_component}
Console Errors: ${issue.console_error || 'None'}
Network Errors: ${issue.network_error || 'None'}
Stack Trace:
${issue.stack_trace || 'None'}
`;

    let aiData;
    
    if (mode === 'local') {
      try {
        const ollamaRes = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model || 'llama3', prompt: prompt, format: 'json', stream: false })
        });
        if (!ollamaRes.ok) {
          const errText = await ollamaRes.text();
          throw new Error(`Ollama API Error: ${ollamaRes.status}. Make sure Ollama is running locally.`);
        }
        const rawData = await ollamaRes.json();
        aiData = { choices: [{ message: { content: rawData.response } }] };
      } catch (e) {
        throw new Error('Local AI is unavailable because Ollama is not running.');
      }
    } else {
      // Default to OpenRouter
      const finalApiKey = apiKey || process.env.OPENROUTER_API_KEY;
      if (!finalApiKey || finalApiKey.trim() === '') {
        return res.status(401).json({ error: 'Invalid OpenRouter API key.' });
      }
      
      const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${finalApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model || 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (!openRouterRes.ok) {
        const errText = await openRouterRes.text();
        console.error(`[AI Fix Assistant] OpenRouter Error:`, errText);
        let errorMsg = `OpenRouter API Error: ${openRouterRes.status}`;
        if (openRouterRes.status === 401) errorMsg = 'Invalid OpenRouter API key.';
        else if (openRouterRes.status === 402) errorMsg = 'Insufficient OpenRouter credits.';
        else if (openRouterRes.status === 429) errorMsg = 'Rate limit exceeded.';
        return res.status(openRouterRes.status).json({ error: errorMsg });
      }
      
      aiData = await openRouterRes.json();
    }

    let parsedResponse = {};
    try {
      parsedResponse = JSON.parse(aiData.choices[0].message.content);
    } catch (e) {
      return res.status(500).json({ error: 'Prompt generation failed. AI returned malformed JSON.' });
    }

    const fixId = `FIX-${randomUUID().split('-')[0].toUpperCase()}`;
    await supabase.from('ai_fix_plans').insert([{ 
      id: fixId, 
      issue_id: issueId, 
      problem_analysis: JSON.stringify(parsedResponse.problem_analysis), 
      engineering_solution: JSON.stringify(parsedResponse.engineering_solution), 
      developer_prompt: parsedResponse.developer_prompt, 
      ide_usage_guide: parsedResponse.ide_usage_guide, 
      model: model || (mode === 'local' ? 'ollama/llama3' : 'google/gemini-2.5-flash')
    }]);

    res.json(parsedResponse);
  } catch (error) {
    console.error("[AI Fix Assistant] Exception:", error.message);
    res.status(500).json({ error: error.message || 'Unable to generate AI analysis.' });
  }
});

app.get('/api/ai/fix/recent', asyncHandler(async (req, res) => {
  const { data: fixes } = await supabase.from('ai_fix_plans').select('*').order('created_at', { ascending: false }).limit(5);
  res.json(fixes || []);
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use(express.static(__dirname));
app.use((req, res) => res.sendFile(path.join(__dirname, 'index.html')));

if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`LaunchGuard AI backend running on http://localhost:${port}`));
}

export default app;
