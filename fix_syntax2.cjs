const fs = require('fs');
let content = fs.readFileSync('public/app.js', 'utf8');

// Fix the timeline block (around line 820)
content = content.replace(
  `      timeline = \\\`<div class="timeline">
        <div class="t-node ok"><i>✓</i><div class="t-content"><b>Crawler Initiated</b><small>Playwright context created</small></div></div>
        <div class="t-node err active"><i>!</i>
          <div class="t-content">
            <b style="color:var(--red)">Runtime Failure</b><small style="color:var(--red)">AI caught an issue at \\\${active.fail_step}</small>
            <div style="margin-top: 8px; color: var(--muted); font-size: 12px;">Confidence: \\\${active.confidence}% | Severity: \\\${active.severity} | Affected URL: \\\${active.name || 'Unknown'}</div>
            \\\${active.screenshot_url ? \\\`<div class="screenshot" style="margin-top:16px;"><img src="\\\${active.screenshot_url}" style="width:100%; border-radius:4px; border:1px solid var(--red);"></div>\\\` : ''}
            \\\${active.console_error ? \\\`<div style="margin-top:12px; background:#1a0505; color:#ff8e8e; padding:10px; font-family:'DM Mono'; font-size:11px; border-radius:4px;">Console Error: \\\${active.console_error}</div>\\\` : ''}
            \\\${active.network_error ? \\\`<div style="margin-top:12px; background:#1a0505; color:#ff8e8e; padding:10px; font-family:'DM Mono'; font-size:11px; border-radius:4px;">Network Error: \\\${active.network_error}</div>\\\` : ''}
          </div>
        </div>
      </div>\\\`;`,
  `      timeline = \`<div class="timeline">
        <div class="t-node ok"><i>✓</i><div class="t-content"><b>Crawler Initiated</b><small>Playwright context created</small></div></div>
        <div class="t-node err active"><i>!</i>
          <div class="t-content">
            <b style="color:var(--red)">Runtime Failure</b><small style="color:var(--red)">AI caught an issue at \${active.fail_step}</small>
            <div style="margin-top: 8px; color: var(--muted); font-size: 12px;">Confidence: \${active.confidence}% | Severity: \${active.severity} | Affected URL: \${active.name || 'Unknown'}</div>
            \${active.screenshot_url ? \`<div class="screenshot" style="margin-top:16px;"><img src="\${active.screenshot_url}" style="width:100%; border-radius:4px; border:1px solid var(--red);"></div>\` : ''}
            \${active.console_error ? \`<div style="margin-top:12px; background:#1a0505; color:#ff8e8e; padding:10px; font-family:'DM Mono'; font-size:11px; border-radius:4px;">Console Error: \${active.console_error}</div>\` : ''}
            \${active.network_error ? \`<div style="margin-top:12px; background:#1a0505; color:#ff8e8e; padding:10px; font-family:'DM Mono'; font-size:11px; border-radius:4px;">Network Error: \${active.network_error}</div>\` : ''}
          </div>
        </div>
      </div>\`;`
);

// Fix the issuesContent block
content = content.replace(
  `    if (issues.length > 0) {
      issuesContent = \`<div style="display:grid; gap:24px;">\` + issues.map(i => \`
        <div class="card" style="border-left: 3px solid var(--red);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div style="font-family:'DM Mono', monospace; color:var(--muted); font-size:12px;">\\\${i.id}</div>
            <div class="tag danger">\\\${i.severity}</div>
          </div>
          <h3 style="margin-bottom:8px; color:#fff;">\\\${i.title}</h3>
          
          <div style="margin-bottom:16px; border:1px solid var(--line); border-radius:6px; padding:12px; font-family:'DM Mono'; font-size:11px; color:var(--muted); line-height: 1.6;">
             <div><b>Root Cause:</b> <span style="color:#fff;">\\\${i.root_cause || 'N/A'}</span></div>
             <div style="margin-top:6px;"><b>Affected File:</b> <span style="color:#fff;">\\\${i.affected_file || 'N/A'}</span></div>
             <div style="margin-top:6px;"><b>Affected URL:</b> <span style="color:#fff;">\\\${i.affected_url || 'N/A'}</span></div>
             <div style="margin-top:6px;"><b>Recommendation:</b> <span style="color:var(--lime);">\\\${i.recommendation || 'N/A'}</span></div>
          </div>
          
          \\\${i.console_error || i.stack_trace ? \\\`
            <div style="background:rgba(255,109,117,0.05); border:1px solid rgba(255,109,117,0.2); border-radius:6px; padding:12px; font-family:'DM Mono'; font-size:11px; color:var(--red); margin-bottom:16px; overflow-x:auto;">
               \\\${i.console_error ? \\\`<div><b>Console Error:</b> \\\${i.console_error}</div>\\\` : ''}
               \\\${i.stack_trace ? \\\`<div style="margin-top:8px; white-space:pre-wrap;"><b>Stack Trace:</b>\\\\n\\\${i.stack_trace}</div>\\\` : ''}
            </div>
          \\\` : ''}
          
          <div style="display:flex; align-items:center; gap:12px; border-top:1px solid var(--line); padding-top:16px;">
            <button class="btn ghost" onclick="location.hash='fix?id=\\\${i.id}'">View Details</button>
            <button class="btn ghost" data-go="replay">Replay Journey</button>
            <button class="btn primary" style="margin-left:auto;" onclick="location.hash='aifix?id=\\\${i.id}'">Generate AI Fix ✨</button>
          </div>
        </div>
      \`).join('') + \`</div>\`;
    }`,
  `    if (issues.length > 0) {
      issuesContent = \`<div style="display:grid; gap:24px;">\` + issues.map(i => \`
        <div class="card" style="border-left: 3px solid var(--red);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div style="font-family:'DM Mono', monospace; color:var(--muted); font-size:12px;">\${i.id}</div>
            <div class="tag danger">\${i.severity}</div>
          </div>
          <h3 style="margin-bottom:8px; color:#fff;">\${i.title}</h3>
          
          <div style="margin-bottom:16px; border:1px solid var(--line); border-radius:6px; padding:12px; font-family:'DM Mono'; font-size:11px; color:var(--muted); line-height: 1.6;">
             <div><b>Root Cause:</b> <span style="color:#fff;">\${i.root_cause || 'N/A'}</span></div>
             <div style="margin-top:6px;"><b>Affected File:</b> <span style="color:#fff;">\${i.affected_file || 'N/A'}</span></div>
             <div style="margin-top:6px;"><b>Affected URL:</b> <span style="color:#fff;">\${i.affected_url || 'N/A'}</span></div>
             <div style="margin-top:6px;"><b>Recommendation:</b> <span style="color:var(--lime);">\${i.recommendation || 'N/A'}</span></div>
          </div>
          
          \${i.console_error || i.stack_trace ? \`
            <div style="background:rgba(255,109,117,0.05); border:1px solid rgba(255,109,117,0.2); border-radius:6px; padding:12px; font-family:'DM Mono'; font-size:11px; color:var(--red); margin-bottom:16px; overflow-x:auto;">
               \${i.console_error ? \`<div><b>Console Error:</b> \${i.console_error}</div>\` : ''}
               \${i.stack_trace ? \`<div style="margin-top:8px; white-space:pre-wrap;"><b>Stack Trace:</b>\\n\${i.stack_trace}</div>\` : ''}
            </div>
          \` : ''}
          
          <div style="display:flex; align-items:center; gap:12px; border-top:1px solid var(--line); padding-top:16px;">
            <button class="btn ghost" onclick="location.hash='fix?id=\${i.id}'">View Details</button>
            <button class="btn ghost" data-go="replay">Replay Journey</button>
            <button class="btn primary" style="margin-left:auto;" onclick="location.hash='aifix?id=\${i.id}'">Generate AI Fix ✨</button>
          </div>
        </div>
      \`).join('') + \`</div>\`;
    }`
);

fs.writeFileSync('public/app.js', content, 'utf8');
console.log('Fixed specific blocks');
