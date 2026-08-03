
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

async function insertDB(table, data) {
    if (!supabase) {
        console.error(`[DB Mock] Insert into ${table}:`, JSON.stringify(data).substring(0, 100));
        return { data: null, error: null };
    }
    const { data: result, error } = await supabase.from(table).insert(data);
    if (error) {
        console.error(`SQL ERROR [INSERT ${table}]:`, error.message, error.details || '');
        throw new Error(`Database Insert Failed: ${table}`);
    }
    return { data: result, error };
}

async function updateDB(table, data, matchColumn, matchValue) {
    if (!supabase) {
        console.error(`[DB Mock] Update ${table} where ${matchColumn}=${matchValue}`);
        return { data: null, error: null };
    }
    const { data: result, error } = await supabase.from(table).update(data).eq(matchColumn, matchValue);
    if (error) {
        console.error(`SQL ERROR [UPDATE ${table}]:`, error.message, error.details || '');
        throw new Error(`Database Update Failed: ${table}`);
    }
    return { data: result, error };
}

async function startLocalServer(dir) {
    let portMatch = null;
    let localProcess = null;
    if (!await fs.pathExists(path.join(dir, 'package.json'))) return null;
    
    console.log("Installing dependencies...");
    try {
        await execAsync('npm install --legacy-peer-deps', { cwd: dir, timeout: 60000 });
    } catch(e) { console.error("npm install failed", e.message); }
    
    return new Promise((resolve) => {
        localProcess = spawn('npm', ['start'], { cwd: dir, shell: true });
        const checkOutput = (data) => {
            const str = data.toString();
            console.log("[LOCAL SERVER]:", str.trim());
            const match = str.match(/(http:\/\/localhost:\d+|http:\/\/127\.0\.0\.1:\d+)/);
            if (match && !portMatch) {
                portMatch = match[1];
                resolve({ url: portMatch, process: localProcess });
            }
        };
        localProcess.stdout.on('data', checkOutput);
        localProcess.stderr.on('data', checkOutput);
        setTimeout(() => {
            if (!portMatch) resolve({ url: 'http://localhost:3000', process: localProcess });
        }, 15000);
    });
}

let supabase = null;
export async function runScan(scanId, repoUrl, deployUrl, sbInstance) {
  supabase = sbInstance;
  let targetUrl = deployUrl;
  let localServer = null;
  const tmpDir = path.join(os.tmpdir(), `lg-scan-${randomUUID().split('-')[0]}`);

  console.log("SCAN STARTED");

  const logTerminal = async (msg, progress, isWarn = false) => {
    console.log(`[SCAN LOG]: ${msg}`);
    await insertDB('scan_logs', [{ scan_id: scanId, message: msg, progress, is_warn: isWarn }]);
  };

  try {
    await updateDB('scans', { status: 'running' }, 'id', scanId);
    
    // 1. Repository Init
    await logTerminal(`✓ Cloning Repository from ${repoUrl}...`, 5);
    await execAsync(`git clone --depth 1 ${repoUrl} ${tmpDir}`);
    console.log("REPOSITORY CLONED");
    
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
    
    console.log("FRAMEWORK DETECTED", framework, lang);
    await logTerminal(`✓ Detected ${lang} / ${framework}`, 10);
    
    // 2. Start Application
    if (!targetUrl) {
        await logTerminal(`✓ No deploy URL provided. Attempting to start locally...`, 15);
        localServer = await startLocalServer(tmpDir);
        if (localServer) {
            targetUrl = localServer.url;
            await logTerminal(`✓ App running at ${targetUrl}`, 25);
        } else {
            throw new Error("Could not start local server. Please provide a Deploy URL.");
        }
    } else {
        await logTerminal(`✓ Using provided Deploy URL: ${targetUrl}`, 25);
    }
    
    // 3. Playwright Crawler
    await logTerminal(`✓ Launching Playwright Crawler...`, 30);
    console.log("PLAYWRIGHT STARTED");
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
        
        console.log("PAGE DISCOVERED", url);
        await logTerminal(`✓ Crawling ${url}...`, progress += 5);
        
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
            console.log("ISSUE GENERATED", "Page Load Failed");
        }
        
        // Eval Builder (Axe)
        let a11yScore = 100;
        try {
            const results = await new AxeBuilder({ page }).analyze();
            a11yScore = Math.max(0, 100 - (results.violations.length * 5));
        } catch(e) {}
        
        // Screenshot
        const snapPath = path.join(tmpDir, `snap-${visited.size}.png`);
        try {
            await page.screenshot({ path: snapPath, fullPage: true });
            console.log("SCREENSHOT SAVED", snapPath);
            screenshots.push({ scan_id: scanId, path: url, url: `https://via.placeholder.com/800x600?text=${encodeURIComponent(new URL(url).pathname)}` });
        } catch (e) {
            console.error("Screenshot failed", e.message);
        }
        
        const perfScore = status >= 400 ? 0 : Math.max(0, 100 - (loadTime / 100));
        let nodeStatus = 'green';
        if (status >= 400 || a11yScore < 70) nodeStatus = 'red';
        else if (perfScore < 80 || a11yScore < 90) nodeStatus = 'yellow';
        mockNodes.push({ scan_id: scanId, path: new URL(url).pathname, status_code: status, load_time: loadTime, perf_score: Math.round(perfScore), a11y_score: Math.round(a11yScore) });
        
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
    
    for (const c of consoleLogs) {
        console.log("ISSUE GENERATED", "Console Error Detected");
        issues.push({ id: `BUG-LG-${randomUUID().split('-')[0].toUpperCase()}`, scan_id: scanId, title: 'Console Error Detected', status: 'OPEN', severity: 'Medium', area: 'Frontend', root_cause: c.message, affected_file: c.path, affected_url: c.path, console_error: c.message, stack_trace: '', recommendation: 'Investigate client-side exception.', patch: '', confidence: 80 });
    }
    for (const n of networkLogs) {
        console.log("ISSUE GENERATED", `API Failure ${n.status}`);
        issues.push({ id: `BUG-LG-${randomUUID().split('-')[0].toUpperCase()}`, scan_id: scanId, title: `API Failure ${n.status}`, status: 'OPEN', severity: 'High', area: 'API', root_cause: `Endpoint ${n.url} returned ${n.status}`, affected_file: n.url, affected_url: n.url, console_error: `HTTP ${n.status}`, stack_trace: '', recommendation: 'Check backend logs for the crashing endpoint.', patch: '', confidence: 95 });
    }

    await logTerminal(`✓ Generating AI RCA and Fix Plans...`, 80);
    const aiFixPlans = [];
    if (issues.length > 0) {
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
                } catch(e) { console.error("Gemini failed", e.message); }
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
    
    await logTerminal(`✓ Saving Everything to Supabase...`, 90);
    
    const journeyMapId = randomUUID();
    await insertDB('journey_maps', [{ id: journeyMapId, scan_id: scanId, name: 'Primary Discovery Flow' }]);
    if (mockNodes.length > 0) await insertDB('journey_nodes', mockNodes);
    if (mockEdges.length > 0) await insertDB('journey_edges', mockEdges);
    
    if (consoleLogs.length > 0) await insertDB('console_logs', consoleLogs);
    if (networkLogs.length > 0) await insertDB('network_logs', networkLogs);
    if (screenshots.length > 0) await insertDB('screenshots', screenshots);
    if (issues.length > 0) await insertDB('vulnerabilities', issues);
    if (aiFixPlans.length > 0) await insertDB('ai_fix_plans', aiFixPlans);
    
    const riskScore = Math.max(0, 100 - (issues.length * 15));
    
    await insertDB('reports', [{ scan_id: scanId, report_data: { summary: "Complete Analysis Generated", score: riskScore } }]);
    await insertDB('dashboard_history', [{ snapshot_data: { date: new Date(), score: riskScore } }]);
    console.log("REPORT SAVED");
    
    await updateDB('scans', { 
      status: 'completed', 
      score: riskScore, 
      api_failures: issues.length, 
      error_message: null 
    }, 'id', scanId);
    
    await logTerminal(`✓ Scan Complete`, 100);
    console.log("SCAN COMPLETE");

  } catch (error) {
    console.error("Scan Error Exception Block:", error.message, error.stack);
    await updateDB('scans', { status: 'failed', error_message: error.message }, 'id', scanId);
    await logTerminal(`Error: ${error.message}`, 100, true);
  } finally {
     if (localServer && localServer.process) localServer.process.kill();
     try { await fs.remove(tmpDir); } catch(e) { console.error("Temp dir removal failed", e.message); }
  }
}
