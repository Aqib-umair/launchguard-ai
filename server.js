import express from 'express';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import cors from 'cors';
import { initDb, getDb, getLatestScanId } from './db.js';
import { runScan } from './scanner.js';
import { scanEmitter } from './emitter.js';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// Global error handler wrapper for async routes
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(JSON.stringify({ endpoint: req.originalUrl, method: req.method, error: err.message, stack: err.stack }));
    if (!res.headersSent) {
      res.status(500).json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
    }
  });
};

// API Routes
app.post('/api/login', asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const db = getDb();
  let user = await db.get('users', { email });
  if (!user) {
    const result = await db.insert('users', { name, email });
    user = { id: result.lastID, name, email };
  }
  res.json({ user });
}));

app.get('/api/reports/:scanId', asyncHandler(async (req, res) => {
  const { scanId } = req.params;
  const db = getDb();
  
  const scan = await db.get('scans', { id: scanId });
  if (!scan) return res.status(404).json({ error: 'Scan not found' });
  
  const repo = await db.get('repositories', { id: scan.repository_id });
  const issues = await db.all('issues', { scan_id: scanId });
  const flows = await db.all('broken_flows', { scan_id: scanId });
  const evals = await db.all('evals', { scan_id: scanId });
  const aiReport = await db.get('ai_reports', { scan_id: scanId });
  
  res.json({
    scan,
    repo,
    issues,
    flows,
    evals,
    aiData: aiReport ? aiReport.summary_json : null
  });
}));

app.get('/api/dashboard', asyncHandler(async (req, res) => {
  const db = getDb();
  const latestScan = await db.get('scans', {}, { orderBy: 'created_at', order: 'desc' });
  if (!latestScan) return res.json({ hasScan: false });
  
  const issues = await db.all('issues', { scan_id: latestScan.id });
  const brokenFlows = await db.all('broken_flows', { scan_id: latestScan.id });
  
  res.json({
    hasScan: true,
    score: latestScan.score,
    brokenFlows: brokenFlows.length,
    apiFailures: latestScan.api_failures,
    performance: latestScan.performance || 98,
    a11y: 0, security: 0, fixes: issues.length, consoleErrs: latestScan.api_failures, networkErrs: latestScan.api_failures,
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
    
    // Fetch base repository metadata
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
    
    // Fetch repository tree to look for lock files and config files
    const treeRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/${branch}?recursive=1`);
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      if (treeData.tree) {
        const files = treeData.tree.map(t => t.path);
        
        if (files.includes('package-lock.json')) packageManager = 'npm';
        else if (files.includes('yarn.lock')) packageManager = 'Yarn';
        else if (files.includes('pnpm-lock.yaml')) packageManager = 'pnpm';
        else if (files.includes('Pipfile.lock') || files.includes('requirements.txt')) packageManager = 'pip';
        else if (files.includes('go.sum')) packageManager = 'go mod';
        
        if (files.includes('next.config.js') || files.includes('next.config.mjs')) framework = 'Next.js';
        else if (files.includes('nuxt.config.js') || files.includes('nuxt.config.ts')) framework = 'Nuxt.js';
        else if (files.includes('svelte.config.js')) framework = 'SvelteKit';
        else if (files.includes('remix.config.js')) framework = 'Remix';
        else if (files.includes('vite.config.js') || files.includes('vite.config.ts')) framework = 'Vite / React';
        else if (files.includes('angular.json')) framework = 'Angular';
        else if (files.includes('manage.py')) framework = 'Django';
        else if (files.includes('artisan')) framework = 'Laravel';
        else if (files.includes('pom.xml')) framework = 'Spring Boot';
        
        if (files.includes('jest.config.js')) testing = 'Jest';
        else if (files.includes('playwright.config.ts')) testing = 'Playwright';
        else if (files.includes('cypress.config.js')) testing = 'Cypress';
        
        if (files.includes('prisma/schema.prisma')) { database = 'PostgreSQL / Prisma'; techStack.push('Prisma'); }
        else if (files.includes('drizzle.config.ts')) { database = 'Drizzle'; techStack.push('Drizzle'); }
        
        if (files.includes('vercel.json')) deployment = 'Vercel';
        else if (files.includes('netlify.toml')) deployment = 'Netlify';
        else if (files.includes('Dockerfile') || files.includes('docker-compose.yml')) deployment = 'Docker';
        
        if (files.includes('tailwind.config.js') || files.includes('tailwind.config.ts')) techStack.push('Tailwind CSS');
        if (language === 'TypeScript') techStack.push('TypeScript');
        
        // Estimate pages based on typical directories
        const appPages = files.filter(f => f.startsWith('app/') && f.endsWith('page.tsx'));
        const pagesDir = files.filter(f => f.startsWith('pages/') && f.endsWith('.tsx'));
        estimatedPages = Math.max(5, appPages.length + pagesDir.length);
      }
    }
    
    // Fetch README
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
  const { name, repoUrl, deployUrl } = req.body;
  const db = getDb();
  
  const repoId = repoUrl ? repoUrl.replace('https://github.com/', '') : `repo-${randomUUID().split('-')[0]}`;
  
  try {
    await db.insert('repositories', { id: repoId, name: repoUrl, url: repoUrl });
  } catch(e) {
    // Repo might already exist, which is fine
  }
  
  const id = `SCAN-LG-2026-${randomUUID().split('-')[0].toUpperCase()}`;
  await db.insert('scans', { id, repository_id: repoId, name, deploy_url: deployUrl, status: 'queued' });
  runScan(id, repoUrl, deployUrl);
  res.status(201).json({ id, name, status: 'queued' });
}));

app.get('/api/scans', asyncHandler(async (req, res) => {
  const db = getDb();
  const scans = await db.all('scans', {}, { orderBy: 'created_at', order: 'desc', limit: 10 });
  res.json(scans);
}));

app.get('/api/scans/:id/stream', asyncHandler(async (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const db = getDb();
  const scan = await db.get('scans', { id });
  
  if (!scan) {
    res.write(`data: ${JSON.stringify({ log: 'Scan not found.', p: 100, isWarn: true })}\n\n`);
    return res.end();
  }
  
  if (scan.status === 'completed') {
    res.write(`data: ${JSON.stringify({ log: 'Scan Complete\nRepository analyzed successfully.\nArchitecture generated.\nIssues detected.\nAI engineering report ready.\nOpen Results', p: 100, isWarn: false })}\n\n`);
    return res.end();
  }

  if (scan.status === 'failed') {
    const errorLog = scan.error_message ? scan.error_message : 'Unknown error occurred.';
    res.write(`data: ${JSON.stringify({ log: errorLog, p: 100, isWarn: true })}\n\n`);
    return res.end();
  }

  const listener = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.p === 100) { res.end(); scanEmitter.removeListener(`scan:${id}`, listener); }
  };
  scanEmitter.on(`scan:${id}`, listener);
  req.on('close', () => scanEmitter.removeListener(`scan:${id}`, listener));
}));

app.get('/api/issues', asyncHandler(async (req, res) => {
  const db = getDb();
  const sid = req.query.scanId || await getLatestScanId(db);
  const issues = await db.all('issues', { scan_id: sid }, { orderBy: 'created_at', order: 'desc' });
  res.json(issues);
}));

app.get('/api/issues/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const issue = await db.get('issues', { id: req.params.id });
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  res.json(issue);
}));

app.get('/api/ollama/ping', asyncHandler(async (req, res) => {
  try {
    const fetchRes = await fetch('http://localhost:11434/api/tags');
    if (fetchRes.ok) {
      return res.json({ status: 'ok' });
    }
    res.status(500).json({ status: 'error' });
  } catch (e) {
    res.status(500).json({ status: 'error' });
  }
}));

app.get('/api/broken_flows', asyncHandler(async (req, res) => {
  const db = getDb();
  const sid = req.query.scanId || await getLatestScanId(db);
  const flows = await db.all('broken_flows', { scan_id: sid });
  res.json(flows);
}));

app.get('/api/journeys', asyncHandler(async (req, res) => {
  const db = getDb();
  const sid = req.query.scanId || await getLatestScanId(db);
  const nodes = await db.all('journey_nodes', { scan_id: sid });
  res.json(nodes);
}));

app.get('/api/evals', asyncHandler(async (req, res) => {
  const db = getDb();
  const sid = req.query.scanId || await getLatestScanId(db);
  const evals = await db.all('evals', { scan_id: sid });
  res.json(evals);
}));

app.get('/api/ai_fix_plans', asyncHandler(async (req, res) => {
  const db = getDb();
  const issueId = req.query.issueId;
  if (!issueId) return res.json([]);
  const plans = await db.all('ai_fix_plans', { issue_id: issueId });
  res.json(plans);
}));

app.post('/api/ai/fix', async (req, res) => {
  const { issueId, mode, model, apiKey } = req.body;
  console.log(`\n[AI Fix Assistant] Incoming request - Issue: ${issueId}, Mode: ${mode}, Model: ${model}`);
  
  const db = getDb();
  
  try {
    console.log(`[AI Fix Assistant] Loading bug information for issue ${issueId}...`);
    const issue = await db.get('issues', { id: issueId });
    if (!issue) {
      console.error(`[AI Fix Assistant] Validation Error: Bug ID ${issueId} does not exist.`);
      return res.status(404).json({ error: `Bug ID ${issueId} does not exist.` });
    }
    
    console.log(`[AI Fix Assistant] Loading scan information for scan ${issue.scan_id}...`);
    const scan = await db.get('scans', { id: issue.scan_id });
    if (!scan) {
      console.error(`[AI Fix Assistant] Validation Error: Required scan data was not found.`);
      return res.status(400).json({ error: 'Required scan data was not collected.' });
    }
    
    console.log(`[AI Fix Assistant] Loading repository data...`);
    let packageJson = '';
    let readme = '';
    try {
      packageJson = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8');
    } catch(e) { 
      console.error('[AI Fix Assistant] Validation Error: Repository could not be analyzed (package.json missing).'); 
      return res.status(400).json({ error: 'Repository could not be analyzed.' });
    }
    try {
      readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf-8');
      console.log('[AI Fix Assistant] README parsed successfully.');
    } catch(e) { 
      console.warn('[AI Fix Assistant] Validation Warning: README.md not found. Proceeding without it.');
    }
    
    console.log(`[AI Fix Assistant] Generating prompt...`);
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
  "developer_prompt": "Generate ONE complete engineering prompt that is ready to paste into an AI coding assistant (e.g. Cursor, Claude Code, Codex, Antigravity, GitHub Copilot, Windsurf).",
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

    console.log(`[AI Fix Assistant] Outgoing ${mode === 'local' ? 'Ollama' : 'OpenRouter'} request...`);
    let aiData;
    
    if (mode === 'local') {
      try {
        const ollamaRes = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model || 'llama3',
            prompt: prompt,
            format: 'json',
            stream: false
          })
        });
        if (!ollamaRes.ok) {
          const errText = await ollamaRes.text();
          console.error(`[AI Fix Assistant] Ollama API Error (${ollamaRes.status}):`, errText);
          throw new Error(`Ollama API Error: ${ollamaRes.status}. Make sure Ollama is running locally.`);
        }
        const rawData = await ollamaRes.json();
        aiData = { choices: [{ message: { content: rawData.response } }] };
      } catch (e) {
        console.error(`[AI Fix Assistant] Ollama fetch failed:`, e.message);
        throw new Error('Local AI is unavailable because Ollama is not running.');
      }
    } else if (mode === 'cloud-free') {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(401).json({ error: 'Server missing GEMINI_API_KEY for free tier.' });
      }
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          }
        });
        aiData = { choices: [{ message: { content: response.text } }] };
      } catch (e) {
        console.error(`[AI Fix Assistant] Gemini API Error:`, e);
        throw new Error('Cloud Free AI fetch failed.');
      }
    } else {
      const finalApiKey = apiKey || process.env.OPENROUTER_API_KEY;
      if (!finalApiKey || finalApiKey.trim() === '') {
        console.error(`[AI Fix Assistant] Error: Invalid OpenRouter API key.`);
        return res.status(401).json({ error: 'Invalid OpenRouter API key.' });
      } else {
        console.log(`[AI Fix Assistant] Request URL: https://openrouter.ai/api/v1/chat/completions`);
        console.log(`[AI Fix Assistant] Selected Model: ${model || 'google/gemini-2.5-flash'}`);

        let openRouterRes;
        try {
          openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
        } catch (e) {
          console.error(`[AI Fix Assistant] OpenRouter fetch failed:`, e.message);
          throw new Error('Network timeout.');
        }

        console.log(`[AI Fix Assistant] HTTP Status: ${openRouterRes.status}`);

        if (!openRouterRes.ok) {
          const errText = await openRouterRes.text();
          console.error(`[AI Fix Assistant] OpenRouter Response Body:`, errText);
          let errorMsg = `OpenRouter returned an error (${openRouterRes.status}).`;
          if (openRouterRes.status === 401) errorMsg = 'Invalid OpenRouter API key.';
          else if (openRouterRes.status === 402) errorMsg = 'Insufficient OpenRouter credits.';
          else if (openRouterRes.status === 403) errorMsg = 'Permission Denied.';
          else if (openRouterRes.status === 429) errorMsg = 'Rate limit exceeded.';
          else if (openRouterRes.status === 404) errorMsg = 'Model unavailable.';
          else if (openRouterRes.status === 408 || openRouterRes.status === 504) errorMsg = 'Network timeout.';
          else if (openRouterRes.status >= 500) errorMsg = 'Internal Server Error.';
          return res.status(openRouterRes.status).json({ error: errorMsg });
        }
        
        aiData = await openRouterRes.json();
        console.log(`[AI Fix Assistant] Complete OpenRouter Response:\n`, JSON.stringify(aiData, null, 2));
      }
    }

    console.log(`[AI Fix Assistant] AI response received successfully.`);
    let parsedResponse = {};
    try {
      parsedResponse = JSON.parse(aiData.choices[0].message.content);
    } catch (e) {
      console.error(`[AI Fix Assistant] Error parsing OpenRouter JSON response.`);
      return res.status(500).json({ error: 'Prompt generation failed. AI returned malformed JSON.' });
    }

    const fixId = `FIX-${randomUUID().split('-')[0].toUpperCase()}`;
    await db.insert('ai_fix_plans', { 
      id: fixId, 
      issue_id: issueId, 
      problem_analysis: JSON.stringify(parsedResponse.problem_analysis), 
      engineering_solution: JSON.stringify(parsedResponse.engineering_solution), 
      developer_prompt: parsedResponse.developer_prompt, 
      ide_usage_guide: parsedResponse.ide_usage_guide, 
      model: model || (mode === 'local' ? 'ollama/llama3' : 'google/gemini-2.5-flash')
    });

    console.log(`[AI Fix Assistant] Final JSON output generated & saved to database.`);
    res.json(parsedResponse);
  } catch (error) {
    console.error("[AI Fix Assistant] Exception:", error.message);
    res.status(500).json({ error: error.message || 'Unable to generate AI analysis. Please try again.' });
  }
});

app.get('/api/ai/fix/recent', asyncHandler(async (req, res) => {
  const db = getDb();
  const fixes = await db.all('ai_fix_plans', {}, { orderBy: 'created_at', order: 'desc', limit: 5 });
  res.json(fixes);
}));

// Ensure any unknown /api route returns JSON, preventing HTML fallback
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.use(express.static(__dirname));
app.use((req, res) => res.sendFile(path.join(__dirname, 'index.html')));

initDb().then(() => {
  if (!process.env.VERCEL) {
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`LaunchGuard AI backend running on http://localhost:${port}`));
  }
}).catch(err => {
  console.error("Database initialization failed:", err);
});

export default app;
