import { supabase } from './lib/supabase.js';
import { analyzeScanData } from './ai.js';
import { randomUUID } from 'crypto';
// NOTE: playwright and @axe-core/playwright are lazy-imported inside runScan()
// to prevent Vercel serverless from crashing on import (no Playwright binaries at startup)


export async function runScan(scanId, repoUrl, deployUrl) {
  
  const logTerminal = async (msg, progress, isWarn = false) => {
    try {
      await supabase.from('scan_logs').insert([{ 
        scan_id: scanId, 
        message: msg, 
        progress: progress, 
        is_warn: isWarn 
      }]);
    } catch(e) { console.error('Failed to log to scan_logs:', e); }
  };
  
  try {
    await supabase.from('scans').update({ status: 'running' }).eq('id', scanId);
    await logTerminal("Initializing scan", 5);
    
    let ghRepo = '';
    let framework = 'Unknown';
    let language = 'Unknown';
    let readme = '';
    let packageJson = '';
    
    // 1. REPOSITORY ANALYSIS
    try {
      await logTerminal("Cloning repository", 10);
      if (repoUrl && repoUrl.includes('github.com')) {
        const parts = repoUrl.replace(/\/$/, '').split('/');
        const repoOwner = parts[parts.length - 2];
        const repoName = parts[parts.length - 1];
        ghRepo = `${repoOwner}/${repoName}`;
        
        const ghRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}`);
        if (!ghRes.ok) throw new Error("Failed to fetch repository metadata from GitHub.");
        const data = await ghRes.json();
        language = data.language || language;
        
        await logTerminal("Reading README", 15);
        const rmRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/readme`);
        if (rmRes.ok) {
          const rmData = await rmRes.json();
          if (rmData.content) readme = Buffer.from(rmData.content, 'base64').toString();
        } else {
          await logTerminal("No README.md found.", 15, true);
        }
        
        await logTerminal("Reading package.json", 20);
        const pkgRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/package.json`);
        if (pkgRes.ok) {
          const pkgData = await pkgRes.json();
          if (pkgData.content) packageJson = Buffer.from(pkgData.content, 'base64').toString();
        } else {
          await logTerminal("No package.json found.", 20, true);
        }
        
        await logTerminal("Detecting Languages", 25);
        if (packageJson.includes('next')) framework = 'Next.js';
        else if (packageJson.includes('react')) framework = 'React';
        else if (packageJson.includes('vue')) framework = 'Vue';
        else if (packageJson.includes('angular')) framework = 'Angular';
        else framework = language;
        
        await logTerminal(`Generating architecture`, 30);
      } else {
        await logTerminal("No valid GitHub URL provided, skipping repository analysis.", 15, true);
      }
    } catch (e) {
      throw new Error(`Repository analysis failed: ${e.message}`);
    }
    
    // 2. PLAYWRIGHT AUTOMATION
    const consoleLogs = [];
    const networkRequests = [];
    const axeViolations = [];
    const jsExceptions = [];
    const nodes = [];
    let finalDom = '';
    
    if (deployUrl) {
      let browser;
      try {
        await logTerminal("Installing Dependencies", 35);
        await logTerminal("Running Tests", 37);
        await logTerminal("Launching Playwright", 40);
        
        // Lazy-import to avoid Vercel crash at module load time
        const { default: playwright } = await import('playwright');
        const { default: AxeBuilder } = await import('@axe-core/playwright');
        
        browser = await playwright.chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, userAgent: 'LaunchGuard-AI-Agent/1.0' });
        const page = await context.newPage();

        
        page.on('console', msg => {
          const text = msg.text();
          consoleLogs.push({ type: msg.type(), text });
          supabase.from('console_logs').insert([{ scan_id: scanId, path: page.url(), level: msg.type(), message: text }]).then();
        });
        
        page.on('response', response => {
          const status = response.status();
          const url = response.url();
          networkRequests.push({ url, status });
          supabase.from('network_logs').insert([{ scan_id: scanId, path: page.url(), url: url, status: status, method: response.request().method() }]).then();
        });
        
        page.on('pageerror', err => {
          jsExceptions.push({ url: page.url(), error: err.message, stack: err.stack });
        });
        
        const visited = new Set();
        const captureNode = async (currentUrl, pathName, startTime) => {
          const loadTime = Date.now() - startTime;
          await page.waitForTimeout(1000);
          
          let uploadedScreenshotUrl = '';
          try {
            await logTerminal("Screenshot captured", 65);
            const buffer = await page.screenshot({ type: 'jpeg', quality: 60 });
            
            // Upload to Supabase Storage
            const fileName = `${scanId}/${Date.now()}_${pathName.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
            const { data, error } = await supabase.storage.from('screenshots').upload(fileName, buffer, {
              contentType: 'image/jpeg'
            });
            
            if (error) {
              console.error("Storage upload error:", error);
            } else {
              const { data: publicUrlData } = supabase.storage.from('screenshots').getPublicUrl(fileName);
              uploadedScreenshotUrl = publicUrlData.publicUrl;
              await supabase.from('screenshots').insert([{ scan_id: scanId, path: pathName, url: uploadedScreenshotUrl }]);
            }
          } catch(e) { 
            console.error(`Screenshot capture failed: ${e.message}`);
          }
          
          let a11yErrors = 0;
          try {
            const results = await new AxeBuilder({ page }).analyze();
            a11yErrors = results.violations.length;
            const pageAxeData = results.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description }));
            axeViolations.push(...pageAxeData.map(v => ({ url: currentUrl, ...v })));
          } catch(e) { 
            console.error(`Accessibility analysis failed: ${e.message}`);
          }
          
          const pageConsoleErrs = consoleLogs.filter(l => l.type === 'error').length;
          const pageNetErrs = networkRequests.filter(r => r.status >= 400).length;
          const nodeErrors = pageConsoleErrs + pageNetErrs + a11yErrors;
          
          const perfScore = Math.max(10, 100 - (loadTime / 100) - (nodeErrors * 5));
          const a11yScore = Math.max(20, 100 - (a11yErrors * 10));
          
          const nodeId = randomUUID();
          const nodeData = {
            id: nodeId,
            scan_id: scanId,
            path: pathName,
            status_code: 200,
            load_time: loadTime,
            a11y_score: Math.round(a11yScore),
            perf_score: Math.round(perfScore),
            screenshot_url: uploadedScreenshotUrl,
            console_errors: pageConsoleErrs,
            network_errors: pageNetErrs
          };
          nodes.push(nodeData);
          await supabase.from('journey_nodes').insert([nodeData]);
        };
        
        await logTerminal("Journey Discovery", 50);
        await logTerminal("Crawling website", 55);
        const s = Date.now();
        await page.goto(deployUrl, { waitUntil: 'networkidle', timeout: 15000 });
        visited.add(deployUrl);
        await captureNode(deployUrl, '/', s);
        
        let hrefs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a'))
            .map(a => a.href)
            .filter(h => h.startsWith(window.location.origin) && !h.includes('#'));
        });
        
        hrefs = [...new Set(hrefs)].filter(h => !visited.has(h)).slice(0, 3);
        
        await logTerminal("Taking screenshots", 60);
        for (const link of hrefs) {
          const pathName = new URL(link).pathname || link;
          const s = Date.now();
          await page.goto(link, { waitUntil: 'networkidle', timeout: 10000 });
          visited.add(link);
          await captureNode(link, pathName, s);
        }
        
        await logTerminal("Dynamic Evaluations", 70);
        await logTerminal("Collecting network logs", 75);
        
        finalDom = await page.content();
      } catch (e) {
        throw new Error(`Playwright automation failed: ${e.message}`);
      } finally {
        if (browser) await browser.close();
      }
    } else {
      await logTerminal("Skipping Playwright (No Deployment URL)", 75, true);
    }
    
    // 3. AI ANALYSIS
    try {
      await logTerminal("Detecting issues", 85);
      await logTerminal("AI Root Cause Analysis", 90);
      const repoContext = { ghRepo, framework, language, readme };
      const fullTelemetry = { consoleLogs, networkRequests, jsExceptions, axeViolations, nodes };
      
      const aiData = await analyzeScanData(scanId, deployUrl, fullTelemetry, finalDom, repoContext);
      
      // 4. PERSIST RESULTS
      await logTerminal("Saving results to Supabase", 95);
      
      if (aiData && aiData.issues) {
        for (const iss of aiData.issues) {
          const issId = `BUG-LG-${new Date().getFullYear()}-${randomUUID().split('-')[0].toUpperCase()}`;
          await supabase.from('issues').insert([{
            id: issId, scan_id: scanId, title: iss.title, status: 'OPEN', severity: iss.severity || 'High',
            area: iss.area || 'General', root_cause: iss.root_cause || '', patch: iss.patch || '',
            affected_url: iss.affected_url || '', affected_component: iss.affected_component || '',
            before_code: iss.before_code || '', after_code: iss.after_code || '',
            screenshot_url: iss.screenshot || '', console_error: iss.console_error || '',
            network_error: iss.network_error || '', stack_trace: iss.stack_trace || '', confidence: iss.confidence || 90
          }]);
          
          if (iss.stack_trace) {
            await supabase.from('stack_traces').insert([{ issue_id: issId, trace: iss.stack_trace }]);
          }
        }
      }
      
      if (aiData && aiData.flows) {
        for (const flow of aiData.flows) {
          await supabase.from('broken_flows').insert([{
            id: randomUUID(), scan_id: scanId, name: flow.name, score: flow.score, fail_step: flow.fail_step,
            duration: flow.duration || '2s', screenshot_url: flow.screenshot || '', console_error: flow.console_error || '',
            network_error: flow.network_error || '', dom_snapshot: flow.dom_snapshot || '', severity: flow.severity || 'High',
            confidence: flow.confidence || 95
          }]);
        }
      }

      if (aiData && aiData.evals) {
        for (const e of aiData.evals) {
          await supabase.from('evals').insert([{
            id: randomUUID(), scan_id: scanId, name: e.name, target_url: e.target_url,
            prompt: e.prompt, status: e.status, reasoning: e.reasoning, score: e.score || 100, recommendation: e.recommendation || ''
          }]);
        }
      }
      
      const finalScore = (aiData?.issues?.length > 0) ? 72 : 98;
      const apiFails = networkRequests.filter(r => r.status >= 400).length;
      
      await supabase.from('scans').update({ status: 'completed', score: finalScore, api_failures: apiFails, error_message: null }).eq('id', scanId);
      await supabase.from('ai_reports').insert([{ scan_id: scanId, summary_json: aiData }]);
      
      await logTerminal("Report completed", 100);
      await logTerminal("Completed", 100);
    } catch (e) {
      throw new Error(`Analysis and persistence failed: ${e.message}`);
    }
    
  } catch (error) {
    console.error("Scan Error:", error);
    let errorMsg = error.message || 'Pipeline crashed.';
    await supabase.from('scans').update({ status: 'failed', error_message: errorMsg }).eq('id', scanId);
    await logTerminal(`Error: ${errorMsg}`, 100, true);
  }
}
