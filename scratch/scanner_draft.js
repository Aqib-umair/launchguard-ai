import { supabase } from '../lib/supabase.js';
import { randomUUID } from 'crypto';
import { exec, spawn } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { GoogleGenAI } from '@google/genai';

const execAsync = util.promisify(exec);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy' });

async function startLocalServer(dir) {
    // Try to start the app locally if possible
    let portMatch = null;
    let localProcess = null;
    
    // Check if package.json exists
    if (!await fs.pathExists(path.join(dir, 'package.json'))) {
        return null; // Not a Node project, can't easily start
    }
    
    // Install deps
    console.log("Installing dependencies...");
    try {
        await execAsync('npm install --legacy-peer-deps', { cwd: dir, timeout: 60000 });
    } catch(e) { console.error("npm install failed", e); }
    
    return new Promise((resolve) => {
        localProcess = spawn('npm', ['start'], { cwd: dir, shell: true });
        
        const checkOutput = (data) => {
            const str = data.toString();
            console.log("[LOCAL SERVER]:", str);
            const match = str.match(/(http:\/\/localhost:\d+|http:\/\/127\.0\.0\.1:\d+)/);
            if (match && !portMatch) {
                portMatch = match[1];
                resolve({ url: portMatch, process: localProcess });
            }
        };
        
        localProcess.stdout.on('data', checkOutput);
        localProcess.stderr.on('data', checkOutput);
        
        // Timeout after 15 seconds
        setTimeout(() => {
            if (!portMatch) {
                console.log("Local server didn't emit a URL, trying fallback port 3000");
                resolve({ url: 'http://localhost:3000', process: localProcess });
            }
        }, 15000);
    });
}

export async function runScan(scanId, repoUrl, deployUrl) {
  let targetUrl = deployUrl;
  let localServer = null;
  const tmpDir = path.join(os.tmpdir(), `lg-scan-${randomUUID().split('-')[0]}`);

  const logTerminal = async (msg, progress, isWarn = false) => {
    try {
      await supabase.from('scan_logs').insert([{ scan_id: scanId, message: msg, progress, is_warn: isWarn }]);
    } catch(e) { console.error(e); }
  };

  try {
    await supabase.from('scans').update({ status: 'running' }).eq('id', scanId);
    
    // 1. Repository Init
    await logTerminal(`Cloning Repository from ${repoUrl}...`, 5);
    await execAsync(`git clone --depth 1 ${repoUrl} ${tmpDir}`);
    
    const packageJsonPath = path.join(tmpDir, 'package.json');
    let framework = 'Unknown', lang = 'Unknown';
    if (await fs.pathExists(packageJsonPath)) {
        const pkg = await fs.readJson(packageJsonPath);
        lang = 'JavaScript/TypeScript';
        const deps = { ...(pkg.dependencies||{}), ...(pkg.devDependencies||{}) };
        if (deps['next']) framework = 'Next.js';
        else if (deps['react']) framework = 'React';
        else if (deps['express']) framework = 'Express';
    } else if (await fs.pathExists(path.join(tmpDir, 'requirements.txt'))) {
        lang = 'Python';
    }
    
    await logTerminal(`Detected ${lang} / ${framework}`, 10);
    
    // 2. Start Application
    if (!targetUrl) {
        await logTerminal(`No deploy URL provided. Attempting to start locally...`, 15);
        localServer = await startLocalServer(tmpDir);
        if (localServer) {
            targetUrl = localServer.url;
            await logTerminal(`App running at ${targetUrl}`, 25);
        } else {
            throw new Error("Could not start local server. Please provide a Deploy URL.");
        }
    } else {
        await logTerminal(`Using provided Deploy URL: ${targetUrl}`, 25);
    }
    
    // 3. Playwright Crawler
    await logTerminal(`Launching Playwright Crawler...`, 30);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    
    const visited = new Set();
    const queue = [targetUrl];
    const maxPages = 5;
    
    const consoleLogs = [];
    const networkLogs = [];
    const screenshots = [];
    const issues = [];
    const mockNodes = [];
    const mockEdges = [];
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleLogs.push({ scan_id: scanId, path: page.url(), level: 'error', message: msg.text() });
        }
    });
    
    page.on('response', resp => {
        if (resp.status() >= 400) {
            networkLogs.push({ scan_id: scanId, path: page.url(), url: resp.url(), status: resp.status(), method: resp.request().method(), duration: 100 });
        }
    });
    
    let progress = 30;
    while (queue.length > 0 && visited.size < maxPages) {
        const url = queue.shift();
        if (visited.has(url)) continue;
        visited.add(url);
        
        await logTerminal(`Crawling ${url}...`, progress += 5);
        
        let status = 200;
        let loadTime = 0;
        const start = Date.now();
        try {
            const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
            status = resp ? resp.status() : 500;
            loadTime = Date.now() - start;
        } catch(e) {
            status = 500;
            loadTime = Date.now() - start;
            issues.push({
                id: `BUG-LG-${randomUUID().split('-')[0].toUpperCase()}`, scan_id: scanId, title: `Page Load Failed`, status: 'OPEN', severity: 'Critical', area: 'Performance', root_cause: e.message, affected_file: url, affected_url: url, console_error: e.message, stack_trace: e.stack, confidence: 90
            });
        }
        
        // Eval Builder (Axe)
        let a11yScore = 100;
        try {
            const results = await new AxeBuilder({ page }).analyze();
            a11yScore = Math.max(0, 100 - (results.violations.length * 5));
        } catch(e) {}
        
        // Screenshot
        const snapPath = path.join(tmpDir, `snap-${visited.size}.png`);
        await page.screenshot({ path: snapPath, fullPage: true });
        // For real usage we'd upload to Supabase Storage, here we use a placeholder or base64
        screenshots.push({ scan_id: scanId, path: url, url: `https://via.placeholder.com/800x600?text=${encodeURIComponent(new URL(url).pathname)}` });
        
        const perfScore = status >= 400 ? 0 : Math.max(0, 100 - (loadTime / 100));
        let nodeStatus = 'green';
        if (status >= 400 || a11yScore < 70) nodeStatus = 'red';
        else if (perfScore < 80 || a11yScore < 90) nodeStatus = 'yellow';
        
        mockNodes.push({ scan_id: scanId, path: new URL(url).pathname, status_code: status, load_time: loadTime, perf_score: Math.round(perfScore), a11y_score: Math.round(a11yScore), status: nodeStatus });
        
        // Find links
        if (status === 200) {
            const hrefs = await page.$$eval('a', links => links.map(a => a.href));
            for (const h of hrefs) {
                if (h.startsWith(targetUrl) && !visited.has(h)) {
                    queue.push(h);
                    mockEdges.push({ scan_id: scanId, source_path: new URL(url).pathname, target_path: new URL(h).pathname });
                }
            }
        }
    }
    
    await browser.close();
    
    // Add logic for console and network issues
    for (const c of consoleLogs) {
        issues.push({ id: `BUG-LG-${randomUUID().split('-')[0].toUpperCase()}`, scan_id: scanId, title: 'Console Error Detected', status: 'OPEN', severity: 'Medium', area: 'Frontend', root_cause: c.message, affected_file: c.path, affected_url: c.path, console_error: c.message, stack_trace: '', recommendation: 'Investigate client-side exception.', patch: '', confidence: 80 });
    }
    for (const n of networkLogs) {
        issues.push({ id: `BUG-LG-${randomUUID().split('-')[0].toUpperCase()}`, scan_id: scanId, title: `API Failure ${n.status}`, status: 'OPEN', severity: 'High', area: 'API', root_cause: `Endpoint ${n.url} returned ${n.status}`, affected_file: n.url, affected_url: n.url, console_error: `HTTP ${n.status}`, stack_trace: '', recommendation: 'Check backend logs for the crashing endpoint.', patch: '', confidence: 95 });
    }

    // AI Fix Plans
    await logTerminal(`Generating AI RCA and Fix Plans...`, 80);
    const aiFixPlans = [];
    if (issues.length > 0) {
        // We simulate the Gemini AI call if we don't have a real key, otherwise call it
        for (const issue of issues) {
            let rca = "Generated RCA";
            let patch = "Generated Patch";
            if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'dummy') {
                try {
                    const res = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: `Analyze this web error and provide a 1-sentence root cause and a 1-sentence code fix: ${issue.title} - ${issue.root_cause}`
                    });
                    rca = res.text;
                } catch(e) { console.error("Gemini failed", e); }
            }
            
            aiFixPlans.push({
                id: `FIX-${randomUUID().split('-')[0].toUpperCase()}`,
                vulnerability_id: issue.id,
                problem_analysis: JSON.stringify({ bug_id: issue.id, severity: issue.severity, why_happened: rca, production_impact: "High", affected_files: [issue.affected_file], affected_component: issue.area, root_cause: rca, bug_explanation: issue.title }),
                engineering_solution: JSON.stringify({ step_by_step: [patch], before_code: "// Vulnerable code", after_code: "// Fixed code", suggested_changes: rca, regression_tests: ["Verify the issue is resolved."], confidence_score: issue.confidence }),
                developer_prompt: `Fix the following issue: ${issue.title}`,
                ide_usage_guide: "Apply the patch directly.",
                model: "Gemini-2.5-Flash"
            });
        }
    }
    
    // 29. Saving Everything to Supabase
    await logTerminal(`Saving Everything to Supabase...`, 90);
    
    const journeyMapId = randomUUID();
    await supabase.from('journey_maps').insert([{ id: journeyMapId, scan_id: scanId, name: 'Primary Discovery Flow' }]);
    if (mockNodes.length > 0) await supabase.from('journey_nodes').insert(mockNodes);
    if (mockEdges.length > 0) await supabase.from('journey_edges').insert(mockEdges);
    
    if (consoleLogs.length > 0) await supabase.from('console_logs').insert(consoleLogs);
    if (networkLogs.length > 0) await supabase.from('network_logs').insert(networkLogs);
    if (screenshots.length > 0) await supabase.from('screenshots').insert(screenshots);
    if (issues.length > 0) await supabase.from('vulnerabilities').insert(issues);
    if (aiFixPlans.length > 0) await supabase.from('ai_fix_plans').insert(aiFixPlans);
    
    const riskScore = Math.max(0, 100 - (issues.length * 15));
    
    await supabase.from('reports').insert([{ scan_id: scanId, report_data: { summary: "Complete Analysis Generated", score: riskScore } }]);
    await supabase.from('dashboard_history').insert([{ snapshot_data: { date: new Date(), score: riskScore } }]);
    
    await supabase.from('scans').update({ 
      status: 'completed', 
      score: riskScore, 
      api_failures: issues.length, 
      error_message: null 
    }).eq('id', scanId);
    
    await logTerminal(`Scan Complete`, 100);

  } catch (error) {
    console.error("Scan Error:", error);
    await supabase.from('scans').update({ status: 'failed', error_message: error.message }).eq('id', scanId);
    await logTerminal(`Error: ${error.message}`, 100, true);
  } finally {
     if (localServer && localServer.process) localServer.process.kill();
     try { await fs.remove(tmpDir); } catch(e) {}
  }
}
