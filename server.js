import express from 'express';
import fs from 'fs';
import cors from 'cors';
import { initDb, getDb } from './db.js';
import { runScan } from './scanner.js';
import { scanEmitter } from './emitter.js';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// Helper to get latest scan ID
const getLatestScanId = async (db) => {
  const scan = await db.get(`SELECT id FROM scans ORDER BY created_at DESC LIMIT 1`);
  return scan ? scan.id : null;
};

// API Routes
app.post('/api/login', async (req, res) => {
  const { name, email } = req.body;
  const db = getDb();
  let user = await db.get(`SELECT * FROM users WHERE email = ?`, [email]);
  if (!user) {
    const result = await db.run(`INSERT INTO users (name, email) VALUES (?, ?)`, [name, email]);
    user = { id: result.lastID, name, email };
  }
  res.json({ user });
});

app.get('/api/dashboard', async (req, res) => {
  const db = getDb();
  const latestScan = await db.get(`SELECT * FROM scans ORDER BY created_at DESC LIMIT 1`);
  if (!latestScan) return res.json({ hasScan: false });
  
  const issues = await db.all(`SELECT severity FROM issues WHERE scan_id = ?`, [latestScan.id]);
  
  res.json({
    hasScan: true,
    score: latestScan.score,
    brokenFlows: latestScan.broken_flows,
    apiFailures: latestScan.api_failures,
    performance: latestScan.performance || 98,
    a11y: 0, security: 0, fixes: issues.length, consoleErrs: latestScan.api_failures, networkErrs: latestScan.api_failures,
    latestScanName: latestScan.name,
    latestScanStatus: latestScan.status
  });
});

app.post('/api/scans', async (req, res) => {
  const { name, repoUrl, deployUrl } = req.body;
  const id = `scan-${randomUUID().split('-')[0]}`;
  const db = getDb();
  await db.run(
    `INSERT INTO scans (id, name, repo_url, deploy_url, status) VALUES (?, ?, ?, ?, ?)`,
    [id, name, repoUrl, deployUrl, 'running']
  );
  runScan(id, repoUrl, deployUrl);
  res.status(201).json({ id, name, status: 'running' });
});

app.get('/api/scans', async (req, res) => {
  const db = getDb();
  const scans = await db.all(`SELECT * FROM scans ORDER BY created_at DESC LIMIT 10`);
  res.json(scans);
});

app.get('/api/scans/:id/stream', async (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const db = getDb();
  const scan = await db.get(`SELECT status FROM scans WHERE id = ?`, [id]);
  
  if (!scan || scan.status !== 'running') {
    res.write(`data: ${JSON.stringify({ log: 'Scan already completed or failed.', p: 100, isWarn: scan?.status === 'failed' })}\n\n`);
    return res.end();
  }

  const listener = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.p === 100) { res.end(); scanEmitter.removeListener(`scan:${id}`, listener); }
  };
  scanEmitter.on(`scan:${id}`, listener);
  req.on('close', () => scanEmitter.removeListener(`scan:${id}`, listener));
});

app.get('/api/issues', async (req, res) => {
  const db = getDb();
  const sid = await getLatestScanId(db);
  const issues = await db.all(`SELECT * FROM issues WHERE scan_id = ? ORDER BY created_at DESC`, [sid]);
  res.json(issues);
});

app.get('/api/flows', async (req, res) => {
  const db = getDb();
  const sid = await getLatestScanId(db);
  const flows = await db.all(`SELECT * FROM flows WHERE scan_id = ?`, [sid]);
  res.json(flows);
});

app.get('/api/nodes', async (req, res) => {
  const db = getDb();
  const sid = await getLatestScanId(db);
  const nodes = await db.all(`SELECT * FROM nodes WHERE scan_id = ?`, [sid]);
  res.json(nodes);
});

app.get('/api/evals', async (req, res) => {
  const db = getDb();
  const sid = await getLatestScanId(db);
  const evals = await db.all(`SELECT * FROM evals WHERE scan_id = ?`, [sid]);
  res.json(evals);
});

app.post('/api/ai/fix', async (req, res) => {
  const { issueId, mode, model } = req.body;
  console.log(`\n[AI Fix Assistant] Incoming request - Issue: ${issueId}, Mode: ${mode}, Model: ${model}`);
  
  const db = getDb();
  
  try {
    console.log(`[AI Fix Assistant] Database lookup for issue ${issueId}...`);
    const issue = await db.get(`SELECT * FROM issues WHERE id = ?`, [issueId]);
    if (!issue) {
      console.log(`[AI Fix Assistant] Error: Issue not found.`);
      return res.status(404).json({ error: 'Issue not found.' });
    }
    
    console.log(`[AI Fix Assistant] Database lookup for scan ${issue.scan_id}...`);
    const scan = await db.get(`SELECT * FROM scans WHERE id = ?`, [issue.scan_id]);
    
    let packageJson = '';
    let readme = '';
    try {
      packageJson = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8');
    } catch(e) { console.log('[AI Fix Assistant] package.json not found'); }
    try {
      readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf-8');
    } catch(e) { console.log('[AI Fix Assistant] README.md not found'); }
    
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
    "root_cause": "Detailed root cause"
  },
  "engineering_solution": {
    "step_by_step": ["Step 1 explanation", "Step 2 explanation"],
    "before_code": "Raw code before changes",
    "after_code": "Raw code after changes",
    "suggested_changes": "Explanation of changes made",
    "regression_tests": ["Test 1", "Test 2"],
    "confidence_score": 96
  },
  "developer_prompt": "Generate ONE complete engineering prompt that is ready to paste into an AI coding assistant (e.g. Cursor, Claude Code, Codex, Antigravity, GitHub Copilot, Windsurf)."
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
    } else {
      const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
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
        console.error(`[AI Fix Assistant] OpenRouter API Error (${openRouterRes.status}):`, errText);
        throw new Error(`OpenRouter API Error: ${openRouterRes.status}`);
      }
      aiData = await openRouterRes.json();
    }

    console.log(`[AI Fix Assistant] AI response received successfully.`);
    let parsedResponse = {};
    try {
      parsedResponse = JSON.parse(aiData.choices[0].message.content);
    } catch (e) {
      console.error(`[AI Fix Assistant] Error parsing OpenRouter JSON response.`);
      parsedResponse = { error: "Failed to parse AI response as JSON.", raw: aiData.choices[0].message.content };
    }

    const fixId = `FIX-${randomUUID().split('-')[0].toUpperCase()}`;
    await db.run(
      `INSERT INTO ai_fix_requests (id, issue_id, scan_id, model, response_json, execution_time) VALUES (?, ?, ?, ?, ?, ?)`,
      [fixId, issueId, scan?.id, model || (mode === 'local' ? 'ollama/llama3' : 'google/gemini-2.5-flash'), JSON.stringify(parsedResponse), 1200]
    );

    console.log(`[AI Fix Assistant] Final JSON response generated & saved to database.`);
    res.json(parsedResponse);
  } catch (error) {
    console.error("[AI Fix Assistant] Exception:", error);
    res.status(500).json({ error: 'Unable to generate AI analysis. Please try again.' });
  }
});

app.get('/api/ai/fix/recent', async (req, res) => {
  const db = getDb();
  const fixes = await db.all(`SELECT * FROM ai_fix_requests ORDER BY created_at DESC LIMIT 5`);
  res.json(fixes);
});

// Ensure any unknown /api route returns JSON, preventing HTML fallback
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.use(express.static(__dirname));
app.use((req, res) => res.sendFile(path.join(__dirname, 'index.html')));

initDb().then(() => {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`LaunchGuard AI backend running on http://localhost:${port}`));
}).catch(console.error);
