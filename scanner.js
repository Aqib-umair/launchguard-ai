import { chromium } from 'playwright';
import { scanEmitter } from './emitter.js';
import { getDb } from './db.js';
import { analyzeScanData } from './ai.js';
import { randomUUID } from 'crypto';

export async function runScan(scanId, repoUrl, deployUrl) {
  const db = getDb();
  
  const emit = (msg, p, isWarn = false) => {
    scanEmitter.emit(`scan:${scanId}`, { log: msg, p, isWarn });
  };
  
  try {
    emit("→ Booting Playwright Chromium engine...", 5);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, userAgent: 'LaunchGuard-AI-Agent/1.0' });
    const page = await context.newPage();
    
    const consoleLogs = [];
    const networkRequests = [];
    
    page.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') emit(`! Browser Console Error: ${msg.text().substring(0, 50)}...`, 50, true);
    });
    
    page.on('response', response => {
      const status = response.status();
      const url = response.url();
      networkRequests.push({ url, status });
      if (status >= 400 && status < 600) emit(`! Network Error: ${status} on ${url.substring(0, 40)}`, 50, true);
    });
    
    emit(`→ Navigating to root deployment: ${deployUrl}`, 10);
    
    const nodes = [];
    const visited = new Set();
    
    // Function to capture node state
    const captureNode = async (currentUrl, pathName) => {
      emit(`→ Analyzing path: ${pathName}`, 20 + (nodes.length * 10));
      await page.waitForTimeout(1000);
      const buffer = await page.screenshot({ type: 'jpeg', quality: 50 });
      const b64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      
      const nodeErrors = consoleLogs.filter(l => l.type === 'error').length + networkRequests.filter(r => r.status >= 400).length;
      
      nodes.push({
        id: `NODE-${randomUUID().split('-')[0]}`,
        scan_id: scanId,
        path: pathName,
        status: nodeErrors > 0 ? 'red' : 'green',
        screenshot: b64,
        errors: nodeErrors
      });
    };

    // 1. Visit Home
    try {
      await page.goto(deployUrl, { waitUntil: 'networkidle', timeout: 15000 });
      visited.add(deployUrl);
      await captureNode(deployUrl, '/');
    } catch(e) {
      emit(`! Root navigation timeout`, 25, true);
    }
    
    // 2. Extract Links
    emit("→ Extracting interaction surface...", 40);
    let hrefs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(h => h.startsWith(window.location.origin) && !h.includes('#'));
    });
    
    hrefs = [...new Set(hrefs)].filter(h => !visited.has(h)).slice(0, 2); // Visit max 2 internal links
    
    // 3. Visit internal links
    for (const link of hrefs) {
      try {
        emit(`→ Navigating to internal route: ${link}`, 50);
        await page.goto(link, { waitUntil: 'networkidle', timeout: 10000 });
        visited.add(link);
        const pathName = new URL(link).pathname || link;
        await captureNode(link, pathName);
      } catch(e) {
        emit(`! Failed to reach internal route`, 60, true);
      }
    }
    
    emit("→ Finalizing Application Shader mapping...", 75);
    
    // Save nodes to DB
    for (const node of nodes) {
      await db.run(
        `INSERT INTO nodes (id, scan_id, path, status, screenshot, errors) VALUES (?, ?, ?, ?, ?, ?)`,
        [node.id, node.scan_id, node.path, node.status, node.screenshot, node.errors]
      );
    }

    // Capture final DOM for AI
    const finalDom = await page.content();
    const finalScreenshot = nodes.length > 0 ? nodes[0].screenshot : ''; // Use root screenshot
    
    emit("→ Pumping data into AI analysis agent...", 85);
    
    // Let AI generate Issues, Flows, and Evals from this deep context
    const aiData = await analyzeScanData(scanId, deployUrl, consoleLogs, networkRequests, nodes, finalDom);
    
    // Insert AI results
    if (aiData && aiData.issues) {
      for (const iss of aiData.issues) {
        await db.run(
          `INSERT INTO issues (id, scan_id, title, status, severity, area, root_cause, patch, affected_url, affected_component, before_code, after_code, screenshot, console_error, network_error, stack_trace, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [iss.id, scanId, iss.title, iss.status, iss.severity, iss.area, iss.root_cause, iss.patch, iss.affected_url, iss.affected_component, iss.before_code, iss.after_code, finalScreenshot, iss.console_error, iss.network_error, iss.stack_trace, iss.confidence]
        );
      }
    }
    
    if (aiData && aiData.flows) {
      for (const flow of aiData.flows) {
        await db.run(
          `INSERT INTO flows (id, scan_id, name, score, fail_step, duration, screenshot, console_error, network_error, dom_snapshot, severity, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [flow.id, scanId, flow.name, flow.score, flow.fail_step, flow.duration, finalScreenshot, flow.console_error, flow.network_error, flow.dom_snapshot, flow.severity, flow.confidence]
        );
      }
    }
    
    if (aiData && aiData.evals) {
      for (const ev of aiData.evals) {
        await db.run(
          `INSERT INTO evals (id, scan_id, name, target_url, prompt, status, reasoning) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ev.id, scanId, ev.name, ev.target_url, ev.prompt, ev.status, ev.reasoning]
        );
      }
    }
    
    await browser.close();
    
    const finalScore = aiData?.issues?.length > 0 ? 68 : 94;
    const brokenFlows = aiData?.flows?.length || 0;
    const apiFails = networkRequests.filter(r => r.status >= 400).length;
    
    await db.run(
      `UPDATE scans SET status = 'completed', score = ?, broken_flows = ?, api_failures = ? WHERE id = ?`,
      [finalScore, brokenFlows, apiFails, scanId]
    );
    
    emit("✓ AI Analysis complete. Report generated.", 100);
    
  } catch (error) {
    console.error("Scan Error:", error);
    emit(`! Critical Agent Error: ${error.message}`, 100, true);
    await db.run(`UPDATE scans SET status = 'failed' WHERE id = ?`, [scanId]);
  }
}
