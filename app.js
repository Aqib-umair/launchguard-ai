// Utilities & Storage
const store = {
  get: k => localStorage.getItem(k),
  set: (k, v) => localStorage.setItem(k, v),
  del: k => localStorage.removeItem(k),
  getJSON: k => JSON.parse(localStorage.getItem(k) || 'null'),
  setJSON: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

let currentUser = store.getJSON('user');

const api = {
  get: async (path) => (await fetch(path)).json(),
  post: async (path, body) => (await fetch(path, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) })).json()
};

const app = document.querySelector('#app');

const navItems = [
  ['report','▦','Overview'],
  ['setup','＋','New scan'],
  ['progress','◉','Live scans'],
  ['replay','↝','Broken flows'],
  ['shader','✦','Shader'],
  ['eval','⌁','Eval builder'],
  ['issue','!','Issues'],
  ['fix','⌁','AI fix plans'],
  ['share','↗','Public share']
];

const wfOrder = ['report', 'replay', 'shader', 'eval', 'issue', 'fix', 'share'];

// Components
const components = {
  btn: (label, key, kind='', type='button') => `<button type="${type}" class="btn ${kind}" data-go="${key}">${label}</button>`,
  card: (content, extraClass='', extraAttrs='') => `<div class="card ${extraClass}" ${extraAttrs}>${content}</div>`,
  head: (ey, h, p, action='') => `<div class="page-head"><div><div class="eyebrow">${ey}</div><h1>${h}</h1><p class="sub">${p}</p></div>${action}</div>`,
  wfNav: (currentKey) => {
    const idx = wfOrder.indexOf(currentKey);
    if(idx < 0) return '';
    const prev = idx > 0 ? wfOrder[idx-1] : null;
    const next = idx < wfOrder.length - 1 ? wfOrder[idx+1] : null;
    return `<div class="workflow-nav" style="margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--line); display:flex; justify-content:space-between;">
      ${prev ? components.btn('← Previous', prev, 'ghost') : '<div></div>'}
      ${next ? components.btn('Next →', next, 'primary') : '<div></div>'}
    </div>`;
  },
  shell: (title, active, body) => {
    const name = currentUser ? currentUser.name : 'Developer';
    const initial = name.charAt(0).toUpperCase();
    return `<div class="app">
      <aside class="sidebar">
        <div class="brand"><div class="mark">L</div><span>launchguard<small>AI RELIABILITY</small></span></div>
        <div class="nav-label">Workspace</div>
        <div class="nav">
          ${navItems.slice(0,3).map(x => `<button class="${active===x[0]?'active':''}" data-go="${x[0]}"><span class="icon">${x[1]}</span><span>${x[2]}</span></button>`).join('')}
        </div>
        <div class="nav-label">Analysis</div>
        <div class="nav">
          ${navItems.slice(3,6).map(x => `<button class="${active===x[0]?'active':''}" data-go="${x[0]}"><span class="icon">${x[1]}</span><span>${x[2]}</span></button>`).join('')}
        </div>
        <div class="nav-label">Reports</div>
        <div class="nav">
          ${navItems.slice(6).map(x => `<button class="${active===x[0]?'active':''}" data-go="${x[0]}"><span class="icon">${x[1]}</span><span>${x[2]}</span></button>`).join('')}
        </div>
        <div class="side-foot">
          <span class="dot"></span> All systems operational
          <div class="avatar-menu">
            <div class="avatar"><i>${initial}</i> ${name}</div>
            <button class="logout-btn" onclick="actions.logout()">Logout</button>
          </div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="crumb">WORKSPACE / <b>${title.toUpperCase()}</b></div>
          <div class="top-actions">
            <span><span class="dot"></span>Live</span>
            <span>⌘ K</span>
            <span>•••</span>
          </div>
        </header>
        <section class="page transition-fade-in">${body}</section>
      </main>
    </div>`;
  },
  shareShell: (title, body) => {
    return `<div class="app share-mode">
      <main class="main" style="border-left: 0;">
        <header class="topbar" style="padding: 0 60px;">
          <div class="brand"><div class="mark">L</div><span>launchguard<small>PUBLIC REPORT</small></span></div>
          <div class="top-actions">
            <span style="font-family:'DM Mono'; font-size:11px;">Powered by LaunchGuard AI</span>
          </div>
        </header>
        <section class="page transition-fade-in" style="max-width:900px;">${body}</section>
      </main>
    </div>`;
  }
};

// Actions
const actions = {
  login: async (e, isRegister) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    
    if (!name || !email) return alert("Required fields missing.");
    const res = await api.post('/api/login', { name, email });
    currentUser = res.user;
    store.setJSON('user', currentUser);
    location.hash = 'report';
  },
  logout: () => {
    currentUser = null;
    store.del('user');
    location.hash = 'landing';
  },
  startScan: async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerText = "Initializing Engine...";
    submitBtn.disabled = true;
    
    const name = form.scanName.value.trim();
    const repoUrl = form.repoUrl.value.trim();
    const deployUrl = form.deployUrl.value.trim();
    
    const res = await api.post('/api/scans', { name, repoUrl, deployUrl });
    store.set('activeScanId', res.id);
    location.hash = 'progress';
  },
  applyPatch: (issueId, patchContent) => {
    const blob = new Blob([patchContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${issueId}.patch`;
    a.click();
    URL.revokeObjectURL(url);
    alert(`Patch downloaded!`);
  }
};
window.actions = actions;

// Views
const views = {
  landing: () => {
    app.innerHTML = `<div class="app"><main class="main">
      <header class="topbar" style="padding: 0 60px;">
        <div class="brand"><div class="mark">L</div><span>launchguard<small>AI RELIABILITY</small></span></div>
        <div class="top-actions">
          <span>Docs</span><span>Changelog</span>
          ${components.btn('Open dashboard','login','ghost')} 
          ${components.btn('Get started','login','primary')}
        </div>
      </header>
      <section class="hero transition-fade-in">
        <div class="hero-copy">
          <div class="eyebrow">Autonomous quality infrastructure</div>
          <h1>Ship with <em>confidence.</em><br>Learn from every flow.</h1>
          <p>LaunchGuard watches your product like a real user, catches the moments that break, and turns them into fixes your team can ship.</p>
          <div class="hero-actions">
            ${components.btn('Run your first scan →','login','primary')} 
          </div>
        </div>
        <div class="infographic">
          <div class="info-card solution">
            <div class="info-label">LaunchGuard Engine</div>
            <h2 class="info-title">AI Automation</h2>
            <div class="info-visual">
              <div>✓ Playwright crawler active</div>
              <div>✓ Navigating to deployment...</div>
              <div>✓ Extracting internal links</div>
              <div class="success">✓ AI generating patch files</div>
            </div>
          </div>
        </div>
      </section>
    </main></div>`;
  },
  
  auth: (isRegister) => {
    app.innerHTML = `<div class="app" style="justify-content:center; align-items:flex-start;">
      <div class="auth-wrap transition-fade-in">
        <div class="brand" style="justify-content:center; margin-bottom: 32px;">
          <div class="mark" style="width:36px; height:36px; border-radius:10px; font-size:18px;">L</div>
          <span style="font-size:24px; letter-spacing:-1px;">launchguard</span>
        </div>
        <div class="auth-card">
          <h1 style="text-align:center; font-size:24px; margin-bottom:8px;">${isRegister ? 'Create an account' : 'Welcome back'}</h1>
          <p style="text-align:center; color:var(--muted); margin-bottom:32px; font-size:14px;">Sign in to your workspace</p>
          <form class="auth-form" onsubmit="actions.login(event, ${isRegister})">
            <div class="field" style="margin-bottom:20px">
              <label>Full Name</label>
              <input name="name" type="text" placeholder="Jane Doe" required>
            </div>
            <div class="field" style="margin-bottom:32px">
              <label>Email Address</label>
              <input type="email" name="email" placeholder="jane@company.com" required>
            </div>
            <button type="submit" class="btn primary" style="width:100%; padding:14px;">
              ${isRegister ? 'Create Account' : 'Login'}
            </button>
          </form>
          <div style="text-align:center; margin-top: 24px; font-size: 13px;">
            ${isRegister 
              ? `<a href="#login" style="color:var(--text);">Log in</a>` 
              : `<a href="#register" style="color:var(--text);">Create one</a>`}
          </div>
        </div>
      </div>
    </div>`;
  },
  
  report: async () => {
    const data = await api.get('/api/dashboard');
    const greeting = `Hi, ${currentUser ? currentUser.name : 'Developer'} 👋`;
    
    let body = components.head('Workspace overview', greeting, 'Welcome back to LaunchGuard AI.', components.btn('+ New scan', 'setup', 'primary'));
    
    if (!data.hasScan) {
      body += `<div class="empty-state anim-slide-in">
        <div class="empty-icon">!</div><h2>No scans yet</h2>
        <p>Connect your GitHub repository and deployed application to generate your first reliability report.</p>
        <div style="display:flex; justify-content:center; margin-top:24px;">${components.btn('New Scan', 'setup', 'primary')}</div>
      </div>`;
    } else {
      const stats = [
        ['Reliability Score', data.score, 'tag lime', 'GOOD'],
        ['Broken Flows', data.brokenFlows, 'tag danger', 'NEEDS ATTENTION'],
        ['API Failures', data.apiFailures, 'tag warn', 'WARNING'],
        ['Performance Score', data.performance || 98, 'tag lime', 'FAST']
      ];
      body += `<div class="grid cols4" style="margin-bottom:32px;">
        ${stats.map(x => components.card(`<div class="split"><div class="stat-label">${x[0]}</div><span class="${x[2]}">${x[3]}</span></div><div class="stat-value">${x[1]}</div>`, 'lift')).join('')}
      </div>`;
      
      const rows = [[data.latestScanName || 'System Scan', data.score, data.latestScanStatus || 'Completed']];
      body += `<div class="anim-slide-in">
        ${components.card('<h2>Recent scan runs</h2><table class="table"><thead><tr><th>Scan</th><th>Score</th><th>Status</th></tr></thead><tbody>'+rows.map(r=>`<tr><td>${r[0]}</td><td style="color:var(--lime)">${r[1]}</td><td><span class="tag lime">${r[2]}</span></td></tr>`).join('')+'</tbody></table>')}
      </div>`;
    }
    
    body += components.wfNav('report');
    app.innerHTML = components.shell('Overview', 'report', body);
    bindEvents();
  },
  
  setup: () => {
    let body = components.head('Create a scan', 'New scan setup', 'Give your agent a starting point. Playwright will crawl the root deployment URL.');
    body += `<div class="grid cols2">
      ${components.card(`<form class="form" onsubmit="actions.startScan(event)">
        <div class="field"><label>Scan name</label><input name="scanName" required value="Playwright End-to-End Scan"></div>
        <div class="field"><label>GitHub Repository URL</label><input name="repoUrl" required value="https://github.com/launchguard/example"></div>
        <div class="field"><label>Deployment URL</label><input name="deployUrl" required type="url" value="https://example.com"></div>
        <button type="submit" class="btn primary" style="margin-top: 24px; padding: 14px 24px;">Start Scan →</button>
      </form>`)}
      ${components.card('<div class="eyebrow">AI Agent Logic</div><h2>Critical path discovery</h2><p class="sub">The agent dynamically crawls pages, takes screenshots, and analyzes DOM errors in real time.</p>')}
    </div>`;
    app.innerHTML = components.shell('New Scan Setup', 'setup', body);
    bindEvents();
  },
  
  progress: async () => {
    const scanId = store.get('activeScanId');
    if (!scanId) return location.hash = 'setup';
    
    let body = components.head('Live execution', 'Scan Command Center', 'Watch autonomous agents navigate and test your application in real-time.', '<span class="tag lime pulse-anim">● AGENT ACTIVE</span>');
    body += `
    <div class="grid" style="grid-template-columns: 320px 1fr; gap: 24px; align-items: flex-start;">
      <div class="queue-list">
        <h3>Active Jobs</h3>
        ${components.card(`<div class="job-item active">
          <div class="job-head"><span class="tag lime">RUNNING</span> <small id="prog-perc">0%</small></div>
          <b>${scanId}</b><small>Executing via Playwright</small>
          <div class="bar" style="margin-top:12px; background:#111820;"><i id="prog-bar" style="width:0%; transition: width 0.5s;"></i></div>
        </div>`, 'lift')}
      </div>
      <div>
        <h3>Live terminal stream</h3>
        <div class="terminal" id="prog-term" style="height: 400px; overflow-y: auto;"></div>
      </div>
    </div>`;
    
    app.innerHTML = components.shell('Live scans', 'progress', body);
    
    const source = new EventSource(`/api/scans/${scanId}/stream`);
    source.onmessage = (event) => {
      if (!document.getElementById('prog-bar')) return source.close();
      const st = JSON.parse(event.data);
      document.getElementById('prog-bar').style.width = st.p + '%';
      document.getElementById('prog-perc').innerText = st.p + '%';
      
      const termEl = document.createElement('div');
      termEl.className = st.isWarn ? 'warn' : (st.log.includes('✓') ? 'ok' : 'cyan');
      termEl.className += ' anim-slide-in';
      termEl.innerText = st.log;
      const tw = document.getElementById('prog-term');
      tw.appendChild(termEl);
      tw.scrollTop = tw.scrollHeight;
      
      if (st.p >= 100) {
        source.close();
        setTimeout(() => { location.hash = 'report'; }, 3000);
      }
    };
  },

  replay: async () => {
    const flows = await api.get('/api/flows');
    let flowList = flows.map(f => components.card(`
          <div class="split"><b>${f.name}</b> <span class="tag danger">${f.score}% Score</span></div>
          <div style="color:var(--muted); font-size:12px; margin-top:8px;">Failed at: <code>${f.fail_step}</code></div>
          <div style="font-size:11px; margin-top:8px; color:var(--cyan)">Severity: ${f.severity}</div>
        `, 'lift', `style="margin-bottom:12px;"`)).join('');
        
    if(!flows.length) flowList = `<div class="card" style="text-align:center; padding:30px;">No broken flows detected in latest scan.</div>`;

    const active = flows[0];
    let timeline = `<div style="text-align:center; color:var(--muted); padding:30px;">No data</div>`;
    
    if(active) {
      timeline = `<div class="timeline">
        <div class="t-node ok"><i>✓</i><div class="t-content"><b>Crawler Initiated</b><small>Playwright context created</small></div></div>
        <div class="t-node err active"><i>!</i>
          <div class="t-content">
            <b style="color:var(--red)">Runtime Failure</b><small style="color:var(--red)">AI caught an issue at ${active.fail_step}</small>
            ${active.screenshot ? `<div class="screenshot" style="margin-top:16px;"><img src="${active.screenshot}" style="width:100%; border-radius:4px; border:1px solid var(--red);"></div>` : ''}
            ${active.console_error ? `<div style="margin-top:12px; background:#1a0505; color:#ff8e8e; padding:10px; font-family:'DM Mono'; font-size:11px; border-radius:4px;">Console: ${active.console_error}</div>` : ''}
          </div>
        </div>
      </div>`;
    }

    let body = components.head('Broken flows', 'Journey Map Explorer', 'Review synthetic user sessions that ended in failure.');
    body += `<div class="grid" style="grid-template-columns: 350px 1fr; gap: 24px; align-items:flex-start;">
      <div class="flow-list">${flowList}</div>
      <div class="flow-timeline">${components.card(`<div class="eyebrow">Session Timeline</div><h2 style="margin-bottom:24px;">Automated Crawl Path</h2>${timeline}`)}</div>
    </div>`;
    body += components.wfNav('replay');
    app.innerHTML = components.shell('Broken flows', 'replay', body);
    bindEvents();
  },

  shader: async () => {
    const nodes = await api.get('/api/nodes');
    let body = components.head('Flow intelligence', 'Application Shader', 'Interactive visual map of crawled routes, node health, and page-level telemetry.');
    
    // Inject Custom CSS for this view
    body += `
      <style>
        .shader-container { position: relative; height: 550px; background: radial-gradient(circle at center, #111820 0, #07090c 100%); border-radius: 8px; overflow: hidden; border: 1px solid var(--line); }
        .node-obj { position: absolute; padding: 10px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 10; animation: popIn 0.6s ease forwards; transform: scale(0); border: 1px solid rgba(255,255,255,0.1); }
        .node-obj:hover { transform: scale(1.05) !important; z-index: 20; box-shadow: 0 0 20px currentColor; }
        .node-obj.green { background: #0a1f11; color: var(--lime); border-color: var(--lime); }
        .node-obj.yellow { background: #1f1a0a; color: var(--orange); border-color: var(--orange); }
        .node-obj.red { background: #1f0a0a; color: var(--red); border-color: var(--red); }
        @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        
        /* Side Panel */
        .side-panel { position: absolute; right: -450px; top: 0; width: 400px; height: 100%; background: #0c1015; border-left: 1px solid var(--line); z-index: 100; transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; overflow-y: auto; padding: 24px; box-shadow: -10px 0 30px rgba(0,0,0,0.6); }
        .side-panel.open { right: 0; }
        .panel-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 20px; position: absolute; top: 20px; right: 20px; }
        .panel-close:hover { color: #fff; }
        
        .metric-dial { width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; border: 4px solid var(--line); margin-bottom: 8px; }
        .dial-wrap { display: flex; flex-direction: column; align-items: center; font-size: 11px; color: var(--muted); font-family: 'DM Mono'; }
        
        .error-log { font-family: 'DM Mono'; font-size: 11px; background: rgba(255,109,117,0.1); color: var(--red); padding: 8px 12px; border-radius: 4px; margin-bottom: 8px; border-left: 2px solid var(--red); word-break: break-all; }
      </style>
    `;

    if (!nodes.length) {
      body += components.card(`<div style="text-align:center; padding: 40px; color:var(--muted);">No pages mapped. Run a scan.</div>`);
    } else {
      // 1. Calculate Summary Metrics
      const total = nodes.length;
      const healthy = nodes.filter(n => n.status === 'green').length;
      const broken = nodes.filter(n => n.status === 'red').length;
      
      body += `<div class="grid cols4" style="margin-bottom: 24px;">
        ${components.card(`<div class="split"><div class="stat-label">Routes Discovered</div><span class="tag cyan">CRAWLED</span></div><div class="stat-value">${total}</div>`, 'lift')}
        ${components.card(`<div class="split"><div class="stat-label">Healthy Nodes</div><span class="tag lime">PASSING</span></div><div class="stat-value" style="color:var(--lime)">${healthy}</div>`, 'lift')}
        ${components.card(`<div class="split"><div class="stat-label">Broken Nodes</div><span class="tag danger">FAILING</span></div><div class="stat-value" style="color:var(--red)">${broken}</div>`, 'lift')}
        ${components.card(`<div class="split"><div class="stat-label">Test Coverage</div><span class="tag cyan">AI EST.</span></div><div class="stat-value">${Math.min(100, total * 30)}%</div>`, 'lift')}
      </div>`;

      // 2. Build Interactive Canvas
      let svgs = '';
      let divs = '';
      
      // We will attach node data to the DOM elements as data attributes so we can populate the side panel on click
      window.shaderNodesData = {};
      
      nodes.forEach((n, i) => {
        window.shaderNodesData[n.id] = n; // store globally for click handler
        
        const x = 10 + (i * 35); // Spread across X axis
        const y = 40 + ((i % 2 === 0 ? -1 : 1) * 20); // Zig-zag Y axis
        
        // Delay animation slightly for each node
        const animDelay = (i * 0.2) + 's';
        
        if (i < nodes.length - 1) {
          const nx = 10 + ((i + 1) * 35);
          const ny = 40 + (((i + 1) % 2 === 0 ? -1 : 1) * 20);
          svgs += `<path d="M ${x}% ${y}% Q ${(x+nx)/2}% ${(y+ny)/2 - 10}% ${nx}% ${ny}%" fill="none" stroke="var(--line)" stroke-width="2" stroke-dasharray="5,5" style="animation: popIn 0.8s ease forwards; animation-delay: ${animDelay}; opacity: 0;"/>`;
          // Draw an arrowhead
          svgs += `<polygon points="${nx-1}%,${ny-2}% ${nx-1}%,${ny+2}% ${nx+1}%,${ny}%" fill="var(--line)" style="animation: popIn 0.8s ease forwards; animation-delay: ${animDelay}; opacity: 0;" />`;
        }
        
        divs += `
          <div class="node-obj ${n.status}" style="left: ${x}%; top: ${y}%; animation-delay: ${animDelay};" onclick="window.openSidePanel('${n.id}')">
            ${n.path}
            ${n.errors > 0 ? `<div style="font-size:10px; margin-top:4px; opacity:0.8;">${n.errors} ERRORS DETECTED</div>` : ''}
          </div>`;
      });

      body += `
        <div class="shader-container" id="shader-map">
           <svg style="position:absolute; width:100%; height:100%; pointer-events:none;">${svgs}</svg>
           ${divs}
           
           <div style="position:absolute; bottom:20px; left:20px; font-family:'DM Mono'; font-size:10px; background:rgba(0,0,0,0.6); padding:12px; border-radius:6px; border:1px solid var(--line); z-index:5;">
             <div style="margin-bottom:6px;"><span style="color:var(--lime); display:inline-block; width:10px;">●</span> Healthy Route</div>
             <div style="margin-bottom:6px;"><span style="color:var(--orange); display:inline-block; width:10px;">●</span> Warnings Detected</div>
             <div><span style="color:var(--red); display:inline-block; width:10px;">●</span> Broken / Exceptions</div>
           </div>
           
           <!-- Slide Out Panel -->
           <div id="node-panel" class="side-panel">
             <button class="panel-close" onclick="document.getElementById('node-panel').classList.remove('open')">✕</button>
             
             <div class="eyebrow">NODE TELEMETRY</div>
             <h2 id="np-path" style="margin-bottom: 8px; font-size: 20px; word-break: break-all;">/path</h2>
             <div id="np-status-tag" style="margin-bottom: 24px;"></div>
             
             <div style="border: 1px solid var(--line); border-radius: 6px; overflow: hidden; margin-bottom: 24px;">
               <div style="background: #111820; padding: 6px 12px; font-family:'DM Mono'; font-size:10px; color:var(--muted); border-bottom: 1px solid var(--line);">DOM Snapshot</div>
               <img id="np-img" src="" style="width: 100%; display: block;" alt="Screenshot">
             </div>
             
             <div class="grid cols3" style="gap: 12px; margin-bottom: 24px;">
               <div class="dial-wrap"><div class="metric-dial" id="np-load" style="color:var(--cyan); border-color:var(--cyan)">--</div>LOAD</div>
               <div class="dial-wrap"><div class="metric-dial" id="np-perf">--</div>PERF</div>
               <div class="dial-wrap"><div class="metric-dial" id="np-a11y">--</div>A11Y</div>
             </div>
             
             <div id="np-errors-container"></div>
             
             <div style="margin-top: auto; padding-top: 24px;">
               <button class="btn ghost" style="width:100%; margin-bottom:12px;" data-go="issue">View Related Issues →</button>
               <button class="btn primary" style="width:100%;" data-go="fix">Generate AI Fix</button>
             </div>
           </div>
        </div>
      `;
      
      // Inject global script for panel toggling
      if(!window.openSidePanelScriptInjected) {
        window.openSidePanelScriptInjected = true;
        const script = document.createElement('script');
        script.innerHTML = `
          window.openSidePanel = function(nodeId) {
            const data = window.shaderNodesData[nodeId];
            if(!data) return;
            
            document.getElementById('np-path').innerText = data.path;
            
            const tag = document.getElementById('np-status-tag');
            if(data.status === 'green') tag.innerHTML = '<span class="tag lime">PASSING</span>';
            else if(data.status === 'yellow') tag.innerHTML = '<span class="tag warn">WARNINGS</span>';
            else tag.innerHTML = '<span class="tag danger">FAILING</span>';
            
            document.getElementById('np-img').src = data.screenshot;
            
            document.getElementById('np-load').innerText = data.load_time ? data.load_time + 'ms' : 'N/A';
            
            const perf = document.getElementById('np-perf');
            perf.innerText = data.perf_score || '--';
            perf.style.color = data.perf_score > 80 ? 'var(--lime)' : (data.perf_score > 50 ? 'var(--orange)' : 'var(--red)');
            perf.style.borderColor = perf.style.color;
            
            const a11y = document.getElementById('np-a11y');
            a11y.innerText = data.a11y_score || '--';
            a11y.style.color = data.a11y_score > 80 ? 'var(--lime)' : (data.a11y_score > 50 ? 'var(--orange)' : 'var(--red)');
            a11y.style.borderColor = a11y.style.color;
            
            const errsContainer = document.getElementById('np-errors-container');
            let errHtml = '';
            
            const cErrs = JSON.parse(data.console_errors || '[]');
            const nErrs = JSON.parse(data.network_errors || '[]');
            
            if(cErrs.length > 0 || nErrs.length > 0) {
              errHtml += '<div class="eyebrow" style="margin-bottom:12px;">RUNTIME EXCEPTIONS</div>';
              cErrs.forEach(e => errHtml += '<div class="error-log">[CONSOLE] ' + e + '</div>');
              nErrs.forEach(e => errHtml += '<div class="error-log" style="border-color:var(--orange); color:var(--orange); background:rgba(255,160,0,0.1)">[NETWORK] ' + e + '</div>');
            } else {
              errHtml += '<div style="color:var(--muted); font-size:13px; font-style:italic;">No exceptions thrown during traversal.</div>';
            }
            
            errsContainer.innerHTML = errHtml;
            
            // Re-bind routing buttons inside panel
            document.querySelectorAll('#node-panel [data-go]').forEach(b => {
              b.onclick = (e) => {
                e.preventDefault();
                location.hash = b.dataset.go;
              };
            });
            
            document.getElementById('node-panel').classList.add('open');
          };
        `;
        document.body.appendChild(script);
      }
    }
    body += components.wfNav('shader');
    app.innerHTML = components.shell('Shader', 'shader', body);
    bindEvents();
  },

  eval: async () => {
    const evals = await api.get('/api/evals');
    let body = components.head('Evaluation suite', 'Dynamic Evals', 'AI-generated assertions testing critical DOM state.');
    
    let table = `<tr><td colspan="4" style="text-align:center; padding: 40px;">No evals generated.</td></tr>`;
    if (evals.length > 0) {
      table = evals.map(e => `
        <tr>
          <td><b>${e.name}</b><br><small style="color:var(--muted)">${e.target_url}</small></td>
          <td><span class="tag ${e.status === 'PASSED' ? 'lime' : 'danger'}">${e.status}</span></td>
          <td style="color:var(--muted); font-size:12px;">${e.reasoning}</td>
          <td>${components.btn('Run', '', 'ghost')}</td>
        </tr>`).join('');
    }
    
    body += components.card(`
      <h3>Auto-Generated Assertions</h3>
      <table class="table" style="margin-top:16px;">
        <thead><tr><th>Eval Name & Target</th><th>Result</th><th>AI Reasoning</th><th>Action</th></tr></thead>
        <tbody>${table}</tbody>
      </table>
    `);
    body += components.wfNav('eval');
    app.innerHTML = components.shell('Eval builder', 'eval', body);
    bindEvents();
  },

  issue: async () => {
    const issues = await api.get('/api/issues');
    let body = components.head('Bug tracker', 'Issues & Alerts', 'AI-detected regressions from Playwright DOM logs.');
    
    let table = `<tr><td colspan="6" style="text-align:center; padding: 40px;">No issues detected.</td></tr>`;
    if (issues.length > 0) {
      table = issues.map(i => `
        <tr>
          <td style="color:var(--muted)">${i.id.split('-')[1]}</td>
          <td><b>${i.title}</b></td>
          <td><span class="tag danger">${i.status}</span></td>
          <td>${i.severity}</td>
          <td style="color:var(--muted)"><code>${i.affected_component}</code></td>
          <td><button class="btn ghost" data-go="fix">Open Fix</button></td>
        </tr>
      `).join('');
    }
    
    body += components.card(`<table class="table">
      <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Severity</th><th>Component</th><th>Actions</th></tr></thead>
      <tbody>${table}</tbody>
    </table>`);
    body += components.wfNav('issue');
    app.innerHTML = components.shell('Issues', 'issue', body);
    bindEvents();
  },

  fix: async () => {
    const issues = await api.get('/api/issues');
    const targetIssue = issues[0];
    
    let body = components.head('AI Remediation', `Fix Plan: ${targetIssue ? targetIssue.id : 'None'}`, 'Root cause analysis and generated code patch.');
    
    if(!targetIssue) {
      body += components.card(`<div style="text-align:center; padding: 40px;">No fix plans available.</div>`);
    } else {
      const patchContent = encodeURIComponent(`Issue: ${targetIssue.title}\n\n${targetIssue.patch}`);
      body += `
      <div class="grid" style="grid-template-columns: 1fr 1.2fr; gap: 24px; align-items:flex-start;">
        <div>
          ${components.card(`
            <div class="eyebrow">Root Cause Analysis</div>
            <h2>${targetIssue.title}</h2>
            <p style="color:var(--muted); line-height:1.7; font-size:14px; margin-top:16px;">${targetIssue.root_cause}</p>
            <div style="margin-top:24px; padding:16px; background:#080b0e; border:1px solid var(--line); border-radius:6px; font-family:'DM Mono'; font-size:11px;">
              <div><b>Affected URL:</b> ${targetIssue.affected_url}</div>
              ${targetIssue.stack_trace ? `<div style="margin-top:12px; color:var(--red)">${targetIssue.stack_trace.replace(/\n/g, '<br>')}</div>` : ''}
            </div>
            <div style="margin-top:24px;">
              <button class="btn primary" onclick="actions.applyPatch('${targetIssue.id}', decodeURIComponent('${patchContent}'))">Download Patch</button>
            </div>
          `)}
        </div>
        <div>
          ${components.card(`
            <div class="eyebrow">Proposed Code Patch</div>
            <h2>Remediation</h2>
            <div class="diff" style="margin-top:16px; background:#080b0e; padding:20px; border-radius:6px; font-family:'DM Mono'; font-size:12px; line-height:1.7; overflow-x:auto; white-space:pre-wrap;">${targetIssue.patch.split('\n').map(line => {
                if (line.startsWith('+')) return `<div style="color:var(--lime); background:rgba(196,245,45,0.1)">${line}</div>`;
                if (line.startsWith('-')) return `<div style="color:var(--red); background:rgba(255,109,117,0.1)">${line}</div>`;
                return `<div style="color:var(--text)">${line}</div>`;
              }).join('')}</div>
          `)}
        </div>
      </div>`;
    }
    body += components.wfNav('fix');
    app.innerHTML = components.shell('AI fix plans', 'fix', body);
    bindEvents();
  },

  share: async () => {
    const data = await api.get('/api/dashboard');
    let body = `
      <div style="margin: 60px auto; text-align:center;">
        <h1 style="font-size:42px; margin-bottom: 16px;">Reliability Audit Report</h1>
        <p style="color:var(--muted); font-size:16px;">Generated dynamically from latest scan</p>
        <div class="card" style="margin-top: 48px; padding: 48px; border: 1px solid var(--lime);">
           <div style="font-size:14px; font-family:'DM Mono'; color:var(--lime);">OVERALL SCORE</div>
           <div style="font-size:96px; font-weight:700; color:var(--lime); line-height:1;">${data.score || 0}<span style="font-size:32px;">/100</span></div>
        </div>
        <div class="grid cols3" style="margin-top: 32px; gap: 24px;">
           ${components.card(`<div class="stat-label">Broken Flows</div><div class="stat-value" style="color:var(--red)">${data.brokenFlows || 0}</div>`, 'lift')}
           ${components.card(`<div class="stat-label">API Failures</div><div class="stat-value" style="color:var(--orange)">${data.apiFailures || 0}</div>`, 'lift')}
           ${components.card(`<div class="stat-label">Performance</div><div class="stat-value" style="color:var(--lime)">${data.performance || 0}</div>`, 'lift')}
        </div>
      </div>
    `;
    body += components.wfNav('share');
    app.innerHTML = components.shareShell('Public Report', body);
    bindEvents();
  }
};

// Router
const router = async () => {
  let hash = location.hash.slice(1) || '';
  
  if (!currentUser && !['landing', 'login', 'register'].includes(hash)) {
    location.hash = 'landing';
    return;
  }
  if (currentUser && ['landing', 'login', 'register', ''].includes(hash)) {
    location.hash = 'report';
    return;
  }
  
  if (hash === '') hash = 'landing';

  if (hash === 'login') views.auth(false);
  else if (hash === 'register') views.auth(true);
  else if (views[hash]) await views[hash]();
  else await views.report();
};

const bindEvents = () => {
  document.querySelectorAll('[data-go]').forEach(b => {
    b.onclick = (e) => {
      e.preventDefault();
      location.hash = b.dataset.go;
    };
  });
};

window.onhashchange = router;
router();
