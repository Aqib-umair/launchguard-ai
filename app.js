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

// Components
const components = {
  btn: (label, key, kind='', type='button') => `<button type="${type}" class="btn ${kind}" data-go="${key}">${label}</button>`,
  card: (content, extraClass='', extraAttrs='') => `<div class="card ${extraClass}" ${extraAttrs}>${content}</div>`,
  head: (ey, h, p, action='') => `<div class="page-head"><div><div class="eyebrow">${ey}</div><h1>${h}</h1><p class="sub">${p}</p></div>${action}</div>`,
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
    location.hash = 'login';
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
            ${components.btn('Explore live demo','login','ghost')}
          </div>
        </div>
        <div class="infographic">
          <div class="info-card problem">
            <div class="info-label">User Problem</div>
            <h2 class="info-title">Broken Flows</h2>
            <p class="info-desc">Users hit invisible errors in production, leading to drop-offs and lost revenue before you even know about it.</p>
            <div class="info-visual">
              <div>→ POST /api/checkout</div>
              <div class="err">! 500 Internal Server Error</div>
              <div>→ waiting for confirmation...</div>
              <div class="err">! timeout (30s)</div>
            </div>
          </div>
          <div class="info-card solution">
            <div class="info-label">LaunchGuard Solution</div>
            <h2 class="info-title">AI Automation</h2>
            <p class="info-desc">Our agents autonomously explore your app, catching edge cases and generating exact fix plans for your team.</p>
            <div class="info-visual">
              <div>✓ agent discovered checkout flow</div>
              <div>✓ simulating network drop...</div>
              <div class="success">✓ graceful error state confirmed</div>
              <div>✓ test passed automatically</div>
            </div>
          </div>
        </div>
      </section>
      <section class="page" style="padding-top:0">
        <div class="grid cols3">
          ${[['01','Catch regressions early','AI agents explore critical paths before your users do.'],
             ['02','See the real failure','Replay broken flows with every click, request, and console event.'],
             ['03','Fix with context','Get a clear fix plan mapped to the exact code and user impact.']]
            .map(x => components.card(`<div class="feature"><div class="num">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></div>`)).join('')}
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
          <p style="text-align:center; color:var(--muted); margin-bottom:32px; font-size:14px;">${isRegister ? 'Enter your details to get started' : 'Sign in to your workspace'}</p>
          <form class="auth-form" onsubmit="actions.login(event, ${isRegister})">
            <div class="field" style="margin-bottom:20px">
              <label>Full Name</label>
              <input name="name" type="text" placeholder="Jane Doe" required>
            </div>
            <div class="field" style="margin-bottom:32px">
              <label>Email Address</label>
              <input type="email" name="email" placeholder="jane@company.com" required>
            </div>
            <button type="submit" class="btn primary" style="width:100%; padding:14px; font-size:14px; font-weight:600;">
              ${isRegister ? 'Create Account' : 'Login'}
            </button>
          </form>
          <div style="text-align:center; margin-top: 24px; font-size: 13px; color: var(--muted);">
            ${isRegister 
              ? `Already have an account? <a href="#login" style="color:var(--text); text-decoration:none; font-weight:500;">Log in</a>` 
              : `Don't have an account? <a href="#register" style="color:var(--text); text-decoration:none; font-weight:500;">Create one</a>`}
          </div>
        </div>
      </div>
    </div>`;
  },
  
  report: async () => {
    const data = await api.get('/api/dashboard');
    const name = currentUser ? currentUser.name : 'Developer';
    const greeting = name.toLowerCase().endsWith('s') ? `Hi, ${name} 👋` : `Hi, ${name} 👋`;
    
    let body = components.head('Workspace overview', 
      greeting, 
      'Welcome back to LaunchGuard AI.', 
      components.btn('+ New scan', 'setup', 'primary')
    );
    
    if (!data.hasScan) {
      const stats = [
        ['Reliability Score', '0', 'tag', '-'],
        ['Broken Flows', '0', 'tag', '-'],
        ['API Failures', '0', 'tag', '-'],
        ['Performance Score', '0', 'tag', '-']
      ];
      
      const extraStats = [
        ['Accessibility Issues', '0'], ['Security Findings', '0'], ['AI Fixes', '0'],
        ['Console Errors', '0'], ['Network Errors', '0'], ['Recent Scans', '0']
      ];
      
      body += `<div class="grid cols4" style="margin-bottom:16px;">
        ${stats.map(x => components.card(`
          <div class="split"><div class="stat-label">${x[0]}</div><span class="${x[2]}">${x[3]}</span></div>
          <div class="stat-value">${x[1]}</div>
        `, 'lift')).join('')}
      </div>`;
      
      body += `<div class="grid cols6" style="margin-bottom: 32px;">
        ${extraStats.map(x => components.card(`
          <div class="stat-label" style="font-size:10px;">${x[0]}</div>
          <div class="stat-value" style="font-size:24px; margin-top:8px;">${x[1]}</div>
        `, 'lift')).join('')}
      </div>`;
      
      body += `<div class="empty-state anim-slide-in">
        <div class="empty-icon">!</div>
        <h2>No scans yet</h2>
        <p>Connect your GitHub repository and deployed application to generate your first reliability report.</p>
        <div style="display:flex; gap:12px; justify-content:center; margin-top:24px;">
          ${components.btn('New Scan', 'setup', 'primary')}
        </div>
      </div>`;
    } else {
      const stats = [
        ['Reliability Score', data.score, 'tag lime', 'GOOD'],
        ['Broken Flows', data.brokenFlows, 'tag danger', 'NEEDS ATTENTION'],
        ['API Failures', data.apiFailures, 'tag warn', 'WARNING'],
        ['Performance Score', data.performance || 95, 'tag lime', 'FAST']
      ];
      
      const extraStats = [
        ['Accessibility Issues', data.a11y], ['Security Findings', data.security], ['AI Fixes', data.fixes],
        ['Console Errors', data.consoleErrs], ['Network Errors', data.networkErrs], ['Recent Scans', '1']
      ];
      
      body += `<div class="grid cols4" style="margin-bottom:16px;">
        ${stats.map(x => components.card(`
          <div class="split"><div class="stat-label">${x[0]}</div><span class="${x[2]}">${x[3]}</span></div>
          <div class="stat-value">${x[1]}</div>
        `, 'lift')).join('')}
      </div>`;
      
      body += `<div class="grid cols6" style="margin-bottom: 32px;">
        ${extraStats.map(x => components.card(`
          <div class="stat-label" style="font-size:10px;">${x[0]}</div>
          <div class="stat-value" style="font-size:24px; margin-top:8px;">${x[1]}</div>
        `, 'lift')).join('')}
      </div>`;
      
      const rows = [[data.latestScanName || 'System Scan', 'LaunchGuard', data.score, data.latestScanStatus || 'Completed']];
      body += `<div class="grid cols2 anim-slide-in">
        ${components.card('<div class="split"><div><h2>Reliability trend</h2><p class="sub">Your score across recent scan runs</p></div><span class="tag lime">30 DAYS</span></div><div class="chart">'+[45,52,49,58,55,65,61,72,67,79,83,data.score].map(h=>`<i style="height:${h}%; animation: growUp 0.8s ease-out backwards;"></i>`).join('')+'</div>')} 
        ${components.card('<h2>Needs attention</h2><p class="sub">Prioritized by user impact</p><div class="issue"><i class="sev"></i><div><b>Checkout confirmation times out</b><small>High · checkout / payment · 2 hours ago</small></div></div><div class="issue"><i class="sev m"></i><div><b>Invite flow loses workspace context</b><small>Medium · onboarding · yesterday</small></div></div>')}
      </div>
      <div style="margin-top:16px" class="anim-slide-in">
        ${components.card('<h2>Recent scan runs</h2><table class="table"><thead><tr><th>Scan</th><th>Project</th><th>Score</th><th>Status</th></tr></thead><tbody>'+rows.map(r=>`<tr><td>${r[0]}</td><td style="color:var(--muted)">${r[1]}</td><td style="color:var(--lime)">${r[2]}</td><td><span class="tag lime">${r[3]}</span></td></tr>`).join('')+'</tbody></table>')}
      </div>`;
    }
    
    app.innerHTML = components.shell('Overview', 'report', body);
    bindEvents();
  },
  
  setup: () => {
    let body = components.head('Create a scan', 'New scan setup', 'Give your agent a starting point. The backend Playwright worker will automatically discover routes.');
    body += `<div class="grid cols2">
      ${components.card(`<form class="form" onsubmit="actions.startScan(event)">
        <div class="field"><label>Scan name</label><input name="scanName" required placeholder="e.g. Production Checkout Flow" value="Playwright End-to-End Scan"></div>
        <div class="field"><label>GitHub Repository URL</label><input name="repoUrl" required placeholder="https://github.com/org/repo" value="https://github.com/launchguard/example-app"></div>
        <div class="field"><label>Deployment URL</label><input name="deployUrl" required type="url" placeholder="https://example.com" value="https://example.com"></div>
        <div class="field"><label>Branch</label><input required value="main"></div>
        <div class="checklist" style="margin-top:20px;">
          <label class="check"><input type="checkbox" checked> Browser Testing (Playwright)</label>
          <label class="check"><input type="checkbox" checked> API Testing (Network Intercept)</label>
          <label class="check"><input type="checkbox" checked> Accessibility</label>
        </div>
        <button type="submit" class="btn primary" style="margin-top: 24px; padding: 14px 24px;">Start Scan →</button>
      </form>`)}
      ${components.card('<div class="eyebrow">Scan recipe</div><h2>Critical path discovery</h2><p class="sub">The agent discovers important paths, then stress tests them with realistic user behavior.</p><div class="steps" style="margin-top: 24px;">'+['Map key interactions','Record every event','Try edge cases','Prioritize impact'].map((x,i)=>`<div class="step done"><i>${i+1}</i>${x}</div>`).join('')+'</div>')}
    </div>`;
    app.innerHTML = components.shell('New Scan Setup', 'setup', body);
    bindEvents();
  },
  
  progress: async () => {
    const scanId = store.get('activeScanId');
    if (!scanId) {
      location.hash = 'setup';
      return;
    }
    
    let body = components.head('Live execution', 'Scan Command Center', 'Watch autonomous agents navigate and test your application in real-time.', '<span class="tag lime pulse-anim">● 1 AGENT ACTIVE</span>');
    body += `
    <div class="grid" style="grid-template-columns: 320px 1fr; gap: 24px; align-items: flex-start;">
      <div class="queue-list">
        <h3>Active Jobs</h3>
        ${components.card(`<div class="job-item active">
          <div class="job-head"><span class="tag lime">RUNNING</span> <small id="prog-perc">0%</small></div>
          <b>${scanId}</b>
          <small>Executing via Playwright</small>
          <div class="bar" style="margin-top:12px; background:#111820;"><i id="prog-bar" style="width:0%; transition: width 0.5s;"></i></div>
        </div>`, 'lift')}
      </div>
      <div>
        <h3>Live terminal stream</h3>
        <div class="terminal" id="prog-term" style="height: 400px; overflow-y: auto;"></div>
      </div>
    </div>`;
    
    app.innerHTML = components.shell('Live scans', 'progress', body);
    bindEvents();
    
    // Connect to SSE Server Event Stream
    const source = new EventSource(`/api/scans/${scanId}/stream`);
    
    source.onmessage = (event) => {
      if (!document.getElementById('prog-bar')) {
        source.close();
        return;
      }
      const st = JSON.parse(event.data);
      document.getElementById('prog-bar').style.width = st.p + '%';
      document.getElementById('prog-perc').innerText = st.p + '%';
      
      const termEl = document.createElement('div');
      termEl.className = st.isWarn ? 'warn' : (st.log.includes('✓') ? 'ok' : 'cyan');
      termEl.className += ' anim-slide-in';
      termEl.innerText = st.log;
      const termWrapper = document.getElementById('prog-term');
      termWrapper.appendChild(termEl);
      termWrapper.scrollTop = termWrapper.scrollHeight;
      
      if (st.p >= 100) {
        source.close();
        setTimeout(() => {
          store.del('activeScanId');
          location.hash = 'report';
        }, 3000);
      }
    };
    
    source.onerror = (e) => {
      console.error("SSE Error:", e);
      source.close();
    };
  },

  replay: async () => {
    const flows = await api.get('/api/flows');
    let flowList = flows.map((f, i) => components.card(`
          <div class="split"><b>${f.name}</b> <span class="tag danger">${f.score}%</span></div>
          <div style="color:var(--muted); font-size:12px; margin-top:8px;">Failed at: <code>${f.fail_step}</code></div>
          <div style="font-size:11px; margin-top:8px; color:var(--cyan)">Duration: ${f.duration}</div>
        `, 'lift', `style="margin-bottom:12px; cursor:pointer;"`)).join('');
        
    if(flows.length === 0) flowList = `<div class="card" style="text-align:center; color:var(--muted); padding:30px;">No broken flows detected yet.</div>`;

    let body = components.head('Broken flows', 'Journey Map Explorer', 'Review synthetic user sessions that ended in failure or degradation.');
    body += `
    <div class="grid" style="grid-template-columns: 350px 1fr; gap: 24px; align-items:flex-start;">
      <div class="flow-list">${flowList}</div>
      <div class="flow-timeline">
        ${components.card(`
          <div class="eyebrow">Session Timeline</div>
          <h2>Automated Crawl Path</h2>
          <div class="timeline" style="margin-top: 24px;">
            <div class="t-node ok"><i>✓</i><div class="t-content"><b>Browser Initialization</b><small>Context created (Playwright)</small></div></div>
            <div class="t-node ok"><i>✓</i><div class="t-content"><b>Network Idle</b><small>DOMContentLoaded & Network Idle</small></div></div>
            <div class="t-node err active"><i>!</i>
              <div class="t-content">
                <b style="color:var(--red)">Runtime Evaluation Failed</b><small style="color:var(--red)">AI identified an uncaught regression.</small>
                <div class="screenshot" style="margin-top:16px; height:180px; background:#080b0e; border:1px solid rgba(255,109,117,0.3); border-radius:6px; display:flex; align-items:center; justify-content:center; flex-direction:column; color:var(--red);">
                   <i style="font-size:24px; font-style:normal; margin-bottom:8px;">⚠️</i>
                   <span style="font-family:'DM Mono'; font-size:11px;">Real-time interaction halted</span>
                </div>
              </div>
            </div>
          </div>
        `)}
      </div>
    </div>`;
    app.innerHTML = components.shell('Broken flows', 'replay', body);
    bindEvents();
  },

  shader: () => {
    let body = components.head('Flow intelligence', 'Application Shader', 'Visual representation of your application\'s discovered surface area and regression risks.');
    body += components.card(`
      <div class="shader-canvas" style="height: 550px; background: radial-gradient(circle at center, #111820 0, #07090c 100%); border-radius: 8px; position: relative; overflow: hidden;">
         <div class="s-node" style="left: 10%; top: 40%;">/</div>
         <svg style="position:absolute; width:100%; height:100%; pointer-events:none;">
            <line x1="15%" y1="40%" x2="40%" y2="20%" stroke="var(--line)" stroke-width="2"/>
            <line x1="15%" y1="40%" x2="40%" y2="60%" stroke="var(--red)" stroke-width="2" stroke-dasharray="4"/>
         </svg>
         <div class="s-node" style="left: 40%; top: 20%;">/about</div>
         <div class="s-node danger pulse-anim" style="left: 40%; top: 60%;">/app<br><small>Identified Risk</small></div>
         <div style="position:absolute; bottom:20px; left:20px; font-family:'DM Mono'; font-size:10px; color:var(--muted); background:#0a0e0d; padding:8px; border:1px solid var(--line); border-radius:4px;">
           <span style="display:inline-block; width:8px; height:8px; background:var(--line); margin-right:4px;"></span> Healthy Route<br>
           <span style="display:inline-block; width:8px; height:8px; background:var(--red); margin-right:4px; margin-top:6px;"></span> At Risk
         </div>
      </div>
    `);
    app.innerHTML = components.shell('Shader', 'shader', body);
    bindEvents();
  },

  eval: () => {
    let body = components.head('Evaluation suite', 'Eval Builder', 'Compose custom AI assertions to verify specific business logic during scans.', components.btn('Save Eval', 'eval', 'primary'));
    body += `
    <div class="grid cols2" style="align-items:stretch;">
      ${components.card(`
        <h3>Test Configuration</h3>
        <div class="form" style="margin-top: 24px;">
          <div class="field"><label>Eval Name</label><input value="Verify Layout Stability"></div>
          <div class="field"><label>Target URL Path</label><input value="/*"></div>
          <div class="field"><label>Trigger Condition</label><select><option>On Page Load</option><option>On DOM Mutation</option></select></div>
        </div>
      `, 'lift', 'style="height:100%;"')}
      ${components.card(`
        <h3>AI Assertion Prompt</h3>
        <p class="sub">Describe what the AI should verify when evaluating this page state.</p>
        <textarea style="width:100%; height:130px; background:#080b0e; border:1px solid var(--line); color:var(--text); padding:16px; border-radius:6px; font-family:'Space Grotesk'; margin-top:16px; resize:none;">Ensure that the main content is fully loaded and no error modals are blocking user interaction.</textarea>
        <div style="margin-top: 16px; display:flex; justify-content:space-between; align-items:center;">
           <span class="tag lime">Model: Gemini 2.5 Flash</span>
           ${components.btn('Test Assertion', 'eval', 'ghost')}
        </div>
      `, 'lift', 'style="height:100%;"')}
    </div>
    <div style="margin-top: 24px;">
      ${components.card(`
        <h3>Recent Executions</h3>
        <table class="table" style="margin-top:16px;">
          <thead><tr><th>Run Time</th><th>Result</th><th>AI Reasoning</th></tr></thead>
          <tbody>
            <tr><td style="color:var(--muted)">10 mins ago</td><td><span class="tag danger">FAILED</span></td><td style="color:var(--muted)">DOM analysis revealed an unhandled exception overlay blocking the viewport.</td></tr>
          </tbody>
        </table>
      `)}
    </div>
    `;
    app.innerHTML = components.shell('Eval builder', 'eval', body);
    bindEvents();
  },

  issue: async () => {
    const issues = await api.get('/api/issues');
    let body = components.head('Bug tracker', 'Issues & Alerts', 'All identified regressions sorted by severity and impact.');
    body += components.card(`
      <div style="display:flex; justify-content:space-between; margin-bottom: 24px;">
        <div style="display:flex; gap: 8px;">
          ${components.btn('All Issues', 'issue', 'ghost')}
          ${components.btn('Open', 'issue', 'ghost')}
        </div>
        <div><input placeholder="Search issues..." style="background:#080b0e; border:1px solid var(--line); color:var(--text); padding:10px 14px; border-radius:6px; font-size:12px; font-family:'DM Mono'; width:250px;"></div>
      </div>
      <table class="table">
        <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Severity</th><th>Area</th><th>Created</th></tr></thead>
        <tbody>
          ${issues.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding: 40px; color:var(--muted);">No issues detected yet. Run a scan.</td></tr>` : 
            issues.map(i => `
            <tr>
              <td style="color:var(--muted)">${i.id}</td>
              <td><b>${i.title}</b></td>
              <td><span class="tag ${i.status === 'Resolved' ? 'lime' : (i.status === 'Open' ? 'danger' : 'warn')}">${i.status}</span></td>
              <td><i class="sev ${i.severity === 'Medium' ? 'm' : ''}" style="display:inline-block; margin-right:6px; width:8px; height:8px; border-radius:50%; background:var(--${i.severity === 'High' ? 'red' : (i.severity === 'Medium' ? 'orange' : 'cyan')})"></i>${i.severity}</td>
              <td style="color:var(--muted)"><code style="background:#131b22; padding:3px 6px; border-radius:4px;">${i.area}</code></td>
              <td style="color:var(--muted)">${new Date(i.created_at).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `);
    app.innerHTML = components.shell('Issues', 'issue', body);
    bindEvents();
  },

  fix: async () => {
    const issues = await api.get('/api/issues');
    const targetIssue = issues[0];
    
    let body = components.head('AI Remediation', `Fix Plan: ${targetIssue ? targetIssue.id : 'None'}`, 'Root cause analysis and proposed patch generated directly from DOM inspection.', components.btn('Apply Patch', 'fix', 'primary'));
    
    if(!targetIssue) {
      body += components.card(`<div style="text-align:center; padding: 40px; color:var(--muted);">No fix plans available. Run a scan to generate one.</div>`);
    } else {
      body += `
      <div class="grid" style="grid-template-columns: 1fr 1.2fr; gap: 24px; align-items:flex-start;">
        <div>
          ${components.card(`
            <div class="eyebrow">Root Cause Analysis</div>
            <h2>${targetIssue.title}</h2>
            <p style="color:var(--muted); line-height:1.7; font-size:14px; margin-top:16px;">${targetIssue.root_cause}</p>
            <div style="margin-top:32px; padding:16px; background:#080b0e; border:1px solid #2f756c; border-radius:6px; color:var(--cyan); font-family:'DM Mono'; font-size:11px;">
              ✦ Confidence: High (Verified by AI model parsing Playwright logs)
            </div>
          `)}
        </div>
        <div>
          ${components.card(`
            <div class="eyebrow">Proposed Code Patch</div>
            <h2>Remediation</h2>
            <div class="diff" style="margin-top:16px; background:#080b0e; padding:20px; border-radius:6px; font-family:'DM Mono'; font-size:12px; line-height:1.7; overflow-x:auto;">
              ${targetIssue.patch.split('\n').map(line => {
                if (line.startsWith('+')) return `<div style="color:var(--lime); background:rgba(196,245,45,0.1)">${line}</div>`;
                if (line.startsWith('-')) return `<div style="color:var(--red); background:rgba(255,109,117,0.1)">${line}</div>`;
                return `<div style="color:var(--text)">${line}</div>`;
              }).join('')}
            </div>
          `)}
        </div>
      </div>`;
    }
    app.innerHTML = components.shell('AI fix plans', 'fix', body);
    bindEvents();
  },

  share: async () => {
    const data = await api.get('/api/dashboard');
    
    let body = `
      <div style="margin: 60px auto; text-align:center;">
        <h1 style="font-size:42px; margin-bottom: 16px; letter-spacing:-1px;">Reliability Audit Report</h1>
        <p style="color:var(--muted); font-size:16px;">Generated on ${new Date().toLocaleDateString()}</p>
        
        <div class="card" style="margin-top: 48px; padding: 48px; background: linear-gradient(150deg, rgba(17,24,31,.96), rgba(10,14,19,.96)); border: 1px solid var(--lime); box-shadow: 0 0 50px rgba(196,245,45,0.15);">
           <div style="font-size:14px; font-family:'DM Mono'; text-transform:uppercase; letter-spacing:2px; color:var(--lime); margin-bottom:12px;">Overall Score</div>
           <div style="font-size:96px; font-weight:700; letter-spacing:-4px; color:var(--lime); line-height:1;">${data.score || 0}<span style="font-size:32px; letter-spacing:0;">/100</span></div>
        </div>
        
        <div class="grid cols3" style="margin-top: 32px; gap: 24px;">
           ${components.card(`<div class="stat-label">Broken Flows</div><div class="stat-value" style="color:var(--red)">${data.brokenFlows || 0}</div>`, 'lift')}
           ${components.card(`<div class="stat-label">API Failures</div><div class="stat-value" style="color:var(--orange)">${data.apiFailures || 0}</div>`, 'lift')}
           ${components.card(`<div class="stat-label">Performance</div><div class="stat-value" style="color:var(--lime)">${data.performance || 0}</div>`, 'lift')}
        </div>
        
        <div style="margin-top:48px; text-align:left;">
          <h2 style="font-size:24px; margin-bottom: 24px;">Status Summary</h2>
          <div class="card">
            <p style="color:var(--muted);">The AI agent has audited the application architecture. Detailed metrics and code remediation steps are available securely in the workspace dashboard.</p>
          </div>
        </div>
      </div>
    `;
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
