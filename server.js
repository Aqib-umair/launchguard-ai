import express from 'express';
import cors from 'cors';
import { initDb, getDb } from './db.js';
import { runScan } from './scanner.js';
import { scanEmitter } from './emitter.js';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

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
  if (!latestScan) {
    return res.json({ hasScan: false });
  }
  res.json({
    hasScan: true,
    score: latestScan.score,
    brokenFlows: latestScan.broken_flows,
    apiFailures: latestScan.api_failures,
    performance: latestScan.performance,
    a11y: 4, security: 1, fixes: 2, consoleErrs: 5, networkErrs: 2,
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
  
  // Kick off background scan
  runScan(id, repoUrl, deployUrl);
  
  res.status(201).json({ id, name, status: 'running' });
});

app.get('/api/scans', async (req, res) => {
  const db = getDb();
  const scans = await db.all(`SELECT * FROM scans ORDER BY created_at DESC LIMIT 10`);
  res.json(scans);
});

// SSE endpoint for scan progress
app.get('/api/scans/:id/stream', (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const listener = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.p === 100) {
      res.end();
      scanEmitter.removeListener(`scan:${id}`, listener);
    }
  };
  
  scanEmitter.on(`scan:${id}`, listener);
  
  req.on('close', () => {
    scanEmitter.removeListener(`scan:${id}`, listener);
  });
});

app.get('/api/issues', async (req, res) => {
  const db = getDb();
  const issues = await db.all(`SELECT * FROM issues ORDER BY created_at DESC`);
  res.json(issues);
});

app.get('/api/flows', async (req, res) => {
  const db = getDb();
  const flows = await db.all(`SELECT * FROM flows`);
  res.json(flows);
});

// Serve frontend static files
app.use(express.static(__dirname));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Init DB and Start
initDb().then(() => {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`LaunchGuard AI backend running on http://localhost:${port}`);
  });
}).catch(console.error);
