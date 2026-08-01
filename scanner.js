import { scanEmitter } from './emitter.js';
import { getDb } from './db.js';
import { analyzeScanData } from './ai.js';
import { randomUUID } from 'crypto';
import playwright from 'playwright';
import AxeBuilder from '@axe-core/playwright';

export async function runScan(scanId, repoUrl, deployUrl) {
  const db = getDb();
  await db.update('scans', { status: 'running' }, { id: scanId });
  
  const emit = (msg, p, isWarn = false) => {
    scanEmitter.emit(`scan:${scanId}`, { log: msg, p, isWarn });
  };
  
  try {
    emit("Initializing Real Analysis Pipeline...", 5);
    
    let ghRepo = '';
    let framework = 'Unknown';
    let language = 'Unknown';
    let readme = '';
    
    // 1. REPOSITORY ANALYSIS
    emit("Analyzing Repository...", 10);
    if (repoUrl && repoUrl.includes('github.com')) {
      const parts = repoUrl.replace(/\/$/, '').split('/');
      const repoOwner = parts[parts.length - 2];
      const repoName = parts[parts.length - 1];
      ghRepo = `${repoOwner}/${repoName}`;
      
      const ghRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`);
      if (ghRes.ok) {
        const data = await ghRes.json();
        language = data.language || language;
      }
      
      const rmRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/readme`);
      if (rmRes.ok) {
        const rmData = await rmRes.json();
        if (rmData.content) readme = Buffer.from(rmData.content, 'base64').toString();
      }
    }
    
    // 2. PLAYWRIGHT AUTOMATION
    const consoleLogs = [];
    const networkRequests = [];
    const axeViolations = [];
    const jsExceptions = [];
    const nodes = [];
    let finalDom = '';
    
    if (deployUrl) {
      emit("Launching Playwright Browser...", 20);
      const browser = await playwright.chromium.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, userAgent: 'LaunchGuard-AI-Agent/1.0' });
      const page = await context.newPage();
      
      page.on('console', msg => {
        const text = msg.text();
        consoleLogs.push({ type: msg.type(), text });
        db.insert('console_logs', { scan_id: scanId, path: page.url(), level: msg.type(), message: text }).catch(()=>{});
      });
      
      page.on('response', response => {
        const status = response.status();
        const url = response.url();
        networkRequests.push({ url, status });
        db.insert('network_logs', { scan_id: scanId, path: page.url(), url: url, status: status, method: response.request().method() }).catch(()=>{});
      });
      
      page.on('pageerror', err => {
        jsExceptions.push({ url: page.url(), error: err.message, stack: err.stack });
      });
      
      const visited = new Set();
      const captureNode = async (currentUrl, pathName, startTime) => {
        const loadTime = Date.now() - startTime;
        await page.waitForTimeout(1000);
        
        let b64 = '';
        try {
          const buffer = await page.screenshot({ type: 'jpeg', quality: 60 });
          b64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
          db.insert('screenshots', { scan_id: scanId, path: pathName, url: b64 }).catch(()=>{});
        } catch(e) { console.error("Screenshot error", e); }
        
        let a11yErrors = 0;
        try {
          const results = await new AxeBuilder({ page }).analyze();
          a11yErrors = results.violations.length;
          const pageAxeData = results.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description }));
          axeViolations.push(...pageAxeData.map(v => ({ url: currentUrl, ...v })));
        } catch(e) { console.error("Axe Error:", e); }
        
        const pageConsoleErrs = consoleLogs.filter(l => l.type === 'error').length;
        const pageNetErrs = networkRequests.filter(r => r.status >= 400).length;
        const nodeErrors = pageConsoleErrs + pageNetErrs + a11yErrors;
        
        const perfScore = Math.max(10, 100 - (loadTime / 100) - (nodeErrors * 5));
        const a11yScore = Math.max(20, 100 - (a11yErrors * 10));
        
        const nodeId = randomUUID();
        nodes.push({
          id: nodeId,
          scan_id: scanId,
          path: pathName,
          status_code: 200,
          load_time: loadTime,
          a11y_score: Math.round(a11yScore),
          perf_score: Math.round(perfScore),
          screenshot_url: b64,
          console_errors: pageConsoleErrs,
          network_errors: pageNetErrs
        });
        
        await db.insert('journey_nodes', nodes[nodes.length - 1]);
      };
      
      try {
        const s = Date.now();
        emit("Crawling Homepage...", 30);
        await page.goto(deployUrl, { waitUntil: 'networkidle', timeout: 15000 });
        visited.add(deployUrl);
        await captureNode(deployUrl, '/', s);
      } catch(e) {}
      
      let hrefs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => a.href)
          .filter(h => h.startsWith(window.location.origin) && !h.includes('#'));
      });
      
      hrefs = [...new Set(hrefs)].filter(h => !visited.has(h)).slice(0, 3);
      
      for (const link of hrefs) {
        try {
          const s = Date.now();
          const pathName = new URL(link).pathname || link;
          emit(`Crawling ${pathName}...`, 45);
          await page.goto(link, { waitUntil: 'networkidle', timeout: 10000 });
          visited.add(link);
          await captureNode(link, pathName, s);
        } catch(e) {}
      }
      
      finalDom = await page.content();
      await browser.close();
      emit("Playwright Crawler Finished", 60);
    } else {
      emit("Skipping Playwright (No Deployment URL)", 60, true);
    }
    
    // 3. AI ANALYSIS (Pass all real data to AI)
    emit("Synthesizing Telemetry...", 70);
    const repoContext = { ghRepo, framework, language, readme };
    const fullTelemetry = { consoleLogs, networkRequests, jsExceptions, axeViolations, nodes };
    
    emit("Generating Bug IDs and Evals via AI...", 80);
    const aiData = await analyzeScanData(scanId, deployUrl, fullTelemetry, finalDom, repoContext);
    
    // 4. PERSIST RESULTS TO SUPABASE
    emit("Persisting Analysis to Supabase...", 90);
    
    if (aiData && aiData.issues) {
      for (const iss of aiData.issues) {
        const issId = `BUG-LG-${new Date().getFullYear()}-${randomUUID().split('-')[0].toUpperCase()}`;
        await db.insert('issues', {
          id: issId, scan_id: scanId, title: iss.title, status: 'OPEN', severity: iss.severity || 'High',
          area: iss.area || 'General', root_cause: iss.root_cause || '', patch: iss.patch || '',
          affected_url: iss.affected_url || '', affected_component: iss.affected_component || '',
          before_code: iss.before_code || '', after_code: iss.after_code || '',
          screenshot_url: iss.screenshot || '', console_error: iss.console_error || '',
          network_error: iss.network_error || '', stack_trace: iss.stack_trace || '', confidence: iss.confidence || 90
        });
        if (iss.stack_trace) {
          await db.insert('stack_traces', { issue_id: issId, trace: iss.stack_trace });
        }
      }
    }
    
    if (aiData && aiData.flows) {
      for (const flow of aiData.flows) {
        await db.insert('broken_flows', {
          id: randomUUID(), scan_id: scanId, name: flow.name, score: flow.score, fail_step: flow.fail_step,
          duration: flow.duration || '2s', screenshot_url: flow.screenshot || '', console_error: flow.console_error || '',
          network_error: flow.network_error || '', dom_snapshot: flow.dom_snapshot || '', severity: flow.severity || 'High',
          confidence: flow.confidence || 95
        });
      }
    }

    if (aiData && aiData.evals) {
      for (const e of aiData.evals) {
        await db.insert('evals', {
          id: randomUUID(), scan_id: scanId, name: e.name, target_url: e.target_url,
          prompt: e.prompt, status: e.status, reasoning: e.reasoning, score: e.score || 100, recommendation: e.recommendation || ''
        });
      }
    }
    
    const finalScore = (aiData?.issues?.length > 0) ? 72 : 98;
    const apiFails = networkRequests.filter(r => r.status >= 400).length;
    
    await db.update('scans', { status: 'completed', score: finalScore, api_failures: apiFails, error_message: null }, { id: scanId });
    
    // Save master report
    await db.insert('ai_reports', { scan_id: scanId, summary_json: aiData });
    
    emit("Scan Completed Successfully.", 100);
    
  } catch (error) {
    console.error("Scan Error:", error);
    let errorMsg = error.message || 'Pipeline crashed.';
    await db.update('scans', { status: 'failed', error_message: errorMsg }, { id: scanId });
    emit(`Error: ${errorMsg}`, 100, true);
  }
}
