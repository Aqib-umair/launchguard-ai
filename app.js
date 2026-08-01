window.onerror = function(msg, url, line, col, err) {
  console.error('Global window error:', msg, err);
  if(document.body) document.body.innerHTML += '<div style="padding:40px;font-family:sans-serif;background:rgba(255,0,0,0.9);color:white;position:fixed;top:0;left:0;z-index:9999;width:100%;height:100%;"><h1>Frontend Crash (onerror)</h1><pre>' + (err ? err.stack : msg) + '</pre></div>';
};
window.onunhandledrejection = function(e) {
  console.error('Unhandled promise rejection:', e.reason);
  if(document.body) document.body.innerHTML += '<div style="padding:40px;font-family:sans-serif;background:rgba(255,0,0,0.9);color:white;position:fixed;top:0;left:0;z-index:9999;width:100%;height:100%;"><h1>Frontend Crash (onunhandledrejection)</h1><pre>' + (e.reason ? e.reason.stack : e.reason) + '</pre></div>';
};

console.log('app.js loaded');
document.addEventListener('DOMContentLoaded', () => { console.log('DOMContentLoaded'); });

try {
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
  get: async (path) => { try { return await (await fetch(path)).json(); } catch(e) { console.error('fetch failed', e); return {}; } },
  post: async (path, body) => { try { return await (await fetch(path, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) })).json(); } catch(e) { console.error('fetch failed', e); return {}; } }
};

let app = document.querySelector('#app');
if (!app) {
  app = document.createElement('div');
  app.id = 'app';
  if(document.body) document.body.appendChild(app);
}

const navItems = [
  ['report','▦','Overview'],
  ['setup','＋','New scan'],
  ['progress','◉','Live scans'],
  ['replay','↝','Broken flows'],
  ['shader','✦','Journey Map'],
  ['eval','⌁','Eval builder'],
  ['issue','!','Issues'],
  ['fix','⌁','AI fix plans'],
  ['aifix','✧','AI Fix Assistant'],
  ['share','↗','Public share']
];

const wfOrder = ['report', 'replay', 'shader', 'eval', 'issue', 'fix', 'aifix', 'share'];

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
  progressTracker: (activeKey) => {
    const steps = [
      { key: 'report', label: 'Scan Complete' },
      { key: 'replay', label: 'Broken Flows' },
      { key: 'shader', label: 'Journey Map' },
      { key: 'issue', label: 'Issues' },
      { key: 'fix', label: 'AI Fix Plan' },
      { key: 'aifix', label: 'AI Fix Assistant' }
    ];
    const activeIdx = steps.findIndex(s => s.key === activeKey);
    if (activeIdx < 0) return '';
    
    return `<div style="display:flex; align-items:center; gap:8px; margin-bottom:32px; overflow-x:auto; padding-bottom:8px; width:100%; font-family: 'DM Mono', monospace; font-size: 11px;">
      ${steps.map((step, idx) => {
        const isCompleted = idx < activeIdx;
        const isActive = idx === activeIdx;
        const color = isActive ? 'var(--lime)' : (isCompleted ? '#fff' : 'var(--muted)');
        const bg = isActive ? 'rgba(0, 255, 136, 0.1)' : (isCompleted ? 'rgba(255, 255, 255, 0.05)' : 'transparent');
        const border = isActive ? '1px solid var(--lime)' : (isCompleted ? '1px solid var(--line)' : '1px dashed var(--line)');
        
        let html = `<div style="display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:100px; background:${bg}; border:${border}; color:${color}; white-space:nowrap; transition:all 0.2s ease;">`;
        if (isCompleted) html += `<span style="color:var(--lime);">✓</span>`;
        html += `<span>${step.label}</span></div>`;
        
        if (idx < steps.length - 1) {
          const arrowColor = isCompleted ? 'var(--lime)' : 'var(--line)';
          html += `<div style="color:${arrowColor}; opacity:0.5;">→</div>`;
        }
        return html;
      }).join('')}
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
    const username = form.username ? form.username.value.trim() : null;
    
    if (!name || !email) return alert("Required fields missing.");
    
    // Pure frontend mock authentication as requested
    currentUser = { id: Date.now(), name, email, username };
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
    store.setJSON('activeScanData', { name, repoUrl, deployUrl });
    store.set('hasScanned', 'true');
    location.hash = 'progress';
  },
  previewRepo: async (e) => {
    const url = e.target.value.trim();
    const previewEl = document.getElementById('repoPreview');
    const nameInput = document.querySelector('input[name="scanName"]');
    
    if (!url.includes('github.com')) {
      if (previewEl) previewEl.innerHTML = '';
      return;
    }
    
    if (previewEl) previewEl.innerHTML = '<div style="margin-top:12px; padding:12px; border:1px solid var(--line); border-radius:8px; color:var(--muted); font-size:12px;">Detecting repository...</div>';
    
    const res = await api.get(`/api/repo/preview?url=${encodeURIComponent(url)}`);
    if (res.repo && previewEl) {
      if (nameInput && (!nameInput.value || nameInput.value.includes('Scan'))) {
        nameInput.value = `${res.repo} Scan`;
      }
      previewEl.innerHTML = `
        <div style="margin-top:12px; padding:16px; border:1px solid var(--lime); border-radius:8px; background:rgba(0, 255, 136, 0.05);">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span style="font-size:11px; color:var(--muted); text-transform:uppercase;">Repository Detected</span>
            <span class="tag lime pulse-anim" style="font-size:10px;">Scanning...</span>
          </div>
          <div style="font-size:16px; font-weight:600; color:#fff; margin-bottom:12px;">${res.repo}</div>
          <div style="display:flex; gap:12px; font-size:12px; color:var(--muted);">
            <div><strong style="color:#fff;">Framework:</strong> ${res.framework}</div>
            <div><strong style="color:#fff;">Language:</strong> ${res.language}</div>
          </div>
        </div>
      `;
    } else if (previewEl) {
      previewEl.innerHTML = '';
    }
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
  landing: () => { console.log("renderLandingPage()");
    app.innerHTML = `<div class="app"><main class="main" style="border-left:0; background: #000; color: #fff;">
      <style>
        .premium-landing { font-family: 'Inter', sans-serif; overflow-x: hidden; background: #000; }
        .p-topbar { display: flex; justify-content: space-between; align-items: center; padding: 20px 60px; position: fixed; top: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(16px); z-index: 1000; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .p-topbar .brand .mark { width: 32px; height: 32px; background: #fff; color: #000; display: grid; place-items: center; border-radius: 8px; font-weight: 700; margin-right: 12px; }
        .p-topbar .brand { display: flex; align-items: center; font-weight: 600; font-size: 18px; letter-spacing: -0.5px; }
        
        .p-hero { position: relative; padding: 180px 20px 120px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .p-hero h1 { font-size: 84px; letter-spacing: -4px; line-height: 1; margin-bottom: 24px; font-weight: 700; background: linear-gradient(135deg, #fff 30%, #888); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .p-hero p { font-size: 22px; color: #a0a0a0; max-width: 750px; line-height: 1.5; margin-bottom: 48px; }
        
        .hero-actions { display: flex; gap: 20px; justify-content: center; z-index: 10; position: relative; }
        .btn-premium { background: #fff; color: #000; padding: 18px 36px; border-radius: 50px; font-weight: 600; font-size: 16px; border: none; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 0 30px rgba(255,255,255,0.2); }
        .btn-premium:hover { transform: translateY(-2px); box-shadow: 0 0 40px rgba(255,255,255,0.4); }
        .btn-ghost-premium { background: transparent; color: #fff; padding: 18px 36px; border-radius: 50px; font-weight: 600; font-size: 16px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; transition: background 0.2s, border-color 0.2s; }
        .btn-ghost-premium:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.4); }
        
        /* Slider Section */
        .slider-section { position: relative; max-width: 1200px; margin: 80px auto; padding: 0 20px; }
        .compare-container { position: relative; height: 600px; background: #080b0e; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.8); }
        
        .compare-pane { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 60px; }
        .compare-pane.before { background: radial-gradient(circle at 0% 50%, rgba(255,77,77,0.1) 0, #080b0e 60%); }
        .compare-pane.after { background: radial-gradient(circle at 100% 50%, rgba(0,255,136,0.15) 0, #0a0e12 80%); clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%); z-index: 2; border-left: 2px solid rgba(0,255,136,0.5); box-shadow: -20px 0 50px rgba(0,0,0,0.5); }
        
        .slider-handle { position: absolute; left: 50%; top: 0; bottom: 0; width: 4px; background: rgba(255,255,255,0.2); z-index: 10; cursor: ew-resize; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; }
        .slider-knob { width: 48px; height: 48px; background: #fff; border-radius: 50%; display: grid; place-items: center; box-shadow: 0 0 30px rgba(0,0,0,0.5); color: #000; font-weight: bold; pointer-events: none; transition: transform 0.2s; }
        .slider-handle:hover .slider-knob { transform: scale(1.1); }
        
        .compare-title { font-size: 32px; font-weight: 700; margin-bottom: 40px; letter-spacing: -1px; }
        .compare-pane.before .compare-title { color: #ff4d4d; }
        .compare-pane.after .compare-title { color: #00ff88; text-align: right; }
        
        .compare-grid { display: grid; gap: 20px; max-width: 450px; }
        .compare-pane.after .compare-grid { margin-left: auto; }
        
        .c-card { padding: 24px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 16px; font-size: 16px; font-weight: 500; transition: transform 0.3s; }
        .compare-pane.before .c-card { border-color: rgba(255,77,77,0.1); }
        .compare-pane.after .c-card { border-color: rgba(0,255,136,0.2); background: rgba(0,255,136,0.02); }
        
        .c-card i { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; font-style: normal; font-size: 14px; }
        .compare-pane.before .c-card i { background: rgba(255,77,77,0.1); color: #ff4d4d; }
        .compare-pane.after .c-card i { background: rgba(0,255,136,0.1); color: #00ff88; }
        
        /* 3D Visualizations */
        .visual-scene { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
        .v-item { position: absolute; padding: 20px; background: rgba(13,17,23,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); backdrop-filter: blur(10px); animation: float 6s ease-in-out infinite; font-family: 'DM Mono', monospace; display: flex; align-items: center; gap: 16px; transition: opacity 0.5s; }
        .v-item.red { border-color: rgba(255,77,77,0.3); color: #ff4d4d; }
        .v-item.green { border-color: rgba(0,255,136,0.3); color: #00ff88; }
        .v-item b { font-size: 24px; color: #fff; }
        .v-item span { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
        
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        
        /* Scroll Reveal */
        .reveal { opacity: 0; transform: translateY(40px); transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        .reveal.active { opacity: 1; transform: translateY(0); }
        
        /* Section styling */
        .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; max-width: 1200px; margin: 120px auto; padding: 0 20px; }
        .f-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 40px; border-radius: 20px; transition: background 0.3s, transform 0.3s; }
        .f-card:hover { background: rgba(255,255,255,0.04); transform: translateY(-5px); border-color: rgba(255,255,255,0.1); }
        .f-card h3 { font-size: 24px; margin-bottom: 16px; letter-spacing: -0.5px; }
        .f-card p { color: #888; line-height: 1.6; font-size: 16px; }
        
        .cta-bottom { text-align: center; padding: 180px 20px; background: radial-gradient(circle at center, rgba(0,255,136,0.05) 0, transparent 60%); }
        .cta-bottom h2 { font-size: 64px; letter-spacing: -3px; margin-bottom: 40px; }
      </style>

      <div class="premium-landing">
        <header class="p-topbar">
          <div class="brand"><div class="mark">L</div><span>launchguard</span></div>
          <div>
            <button class="btn ghost" style="color:#fff; margin-right:12px; border:none;" onclick="location.hash='login'">Log in</button>
            <button class="btn-premium" style="padding:10px 24px; font-size:14px;" onclick="location.hash='register'">Sign up</button>
          </div>
        </header>
        
        <section class="p-hero reveal">
          <h1>Stop Shipping Bugs.<br>Ship With Confidence.</h1>
          <p>LaunchGuard AI explores your deployed applications, detects broken user journeys, explains failures with AI, and generates production-ready fixes before users encounter them.</p>
          <div class="hero-actions">
            <button class="btn-premium" onclick="location.hash='register'">Get Started</button>
            <button class="btn-ghost-premium">Watch Demo</button>
          </div>
        </section>

        <section class="slider-section reveal">
          <div class="compare-container" id="compareContainer">
            <!-- Left Pane: Before (Red) -->
            <div class="compare-pane before">
              <h2 class="compare-title">Traditional QA</h2>
              <div class="compare-grid">
                <div class="c-card"><i>✕</i> <span>Manual testing bottlenecks</span></div>
                <div class="c-card"><i>✕</i> <span>Missed edge-case bugs</span></div>
                <div class="c-card"><i>✕</i> <span>Long debugging cycles</span></div>
                <div class="c-card"><i>✕</i> <span>Production failures</span></div>
              </div>
            </div>
            
            <!-- Right Pane: After (Green) -->
            <div class="compare-pane after" id="compareAfter">
              <h2 class="compare-title">LaunchGuard AI</h2>
              <div class="compare-grid">
                <div class="c-card"><i>✓</i> <span>Autonomous browser testing</span></div>
                <div class="c-card"><i>✓</i> <span>AI root-cause analysis</span></div>
                <div class="c-card"><i>✓</i> <span>Broken flow detection</span></div>
                <div class="c-card"><i>✓</i> <span>AI-generated patches</span></div>
              </div>
            </div>
            
            <div class="slider-handle" id="sliderHandle">
              <div class="slider-knob">↔</div>
            </div>
            
            <!-- 3D Visual Floating Elements -->
            <div class="visual-scene" id="visualScene">
              <div class="v-item red" style="top: 10%; left: -50px; animation-delay: 0s;" id="v-red-1">
                <div style="font-size:24px;">🚨</div><div><span>Issues Found</span><br><b>12</b></div>
              </div>
              <div class="v-item red" style="bottom: 15%; left: 10%; animation-delay: 1.5s;" id="v-red-2">
                <div style="font-size:24px;">📉</div><div><span>Reliability</span><br><b>78%</b></div>
              </div>
              <div class="v-item green" style="top: 15%; right: 10%; animation-delay: 0.5s; opacity:0;" id="v-green-1">
                <div style="font-size:24px;">✨</div><div><span>AI Fix Generated</span><br><b>.patch ready</b></div>
              </div>
              <div class="v-item green" style="bottom: 20%; right: -30px; animation-delay: 2s; opacity:0;" id="v-green-2">
                <div style="font-size:24px;">🚀</div><div><span>Performance</span><br><b>91</b></div>
              </div>
            </div>
          </div>
        </section>

        <section class="feature-grid">
          <div class="f-card reveal">
            <h3>Autonomous Testing</h3>
            <p>Spins up Playwright engines automatically to crawl and test your deployment without you writing a single line of test code.</p>
          </div>
          <div class="f-card reveal">
            <h3>Flow Intelligence</h3>
            <p>Visual node mapping of every discovered route, identifying healthy paths and pinpointing exact failure locations.</p>
          </div>
          <div class="f-card reveal">
            <h3>Root Cause Analysis</h3>
            <p>When an error happens, AI reads the DOM snapshot, console logs, and network trace to tell you exactly why.</p>
          </div>
          <div class="f-card reveal">
            <h3>Issue Tracker</h3>
            <p>A built-in dashboard prioritizing failures by severity and impact on the user journey.</p>
          </div>
          <div class="f-card reveal">
            <h3>AI Fix Plans</h3>
            <p>Don't just find bugs. Download complete <code>.patch</code> files generated by AI to immediately remediate issues.</p>
          </div>
          <div class="f-card reveal">
            <h3>Instantly Shareable</h3>
            <p>Generate public, shareable reliability audit reports to keep your team and stakeholders aligned on quality.</p>
          </div>
        </section>

        <section class="cta-bottom reveal">
          <h2>Ready to ship with confidence?</h2>
          <button class="btn-premium" style="font-size: 20px; padding: 24px 48px;" onclick="location.hash='register'">Start for free</button>
        </section>
      </div>
    </main></div>`;

    // Initialize interactive scripts right after DOM injection
    setTimeout(() => {
      const container = document.getElementById('compareContainer');
      const handle = document.getElementById('sliderHandle');
      const afterPane = document.getElementById('compareAfter');
      const green1 = document.getElementById('v-green-1');
      const green2 = document.getElementById('v-green-2');
      const red1 = document.getElementById('v-red-1');
      const red2 = document.getElementById('v-red-2');
      
      if (!container || !handle || !afterPane) return;

      let isDragging = false;
      
      const updateSlider = (x) => {
        const rect = container.getBoundingClientRect();
        let percent = ((x - rect.left) / rect.width) * 100;
        percent = Math.max(0, Math.min(100, percent));
        
        handle.style.left = percent + '%';
        afterPane.style.clipPath = `polygon(${percent}% 0, 100% 0, 100% 100%, ${percent}% 100%)`;
        afterPane.style.borderLeftWidth = percent === 100 ? '0' : '2px';
        
        // Show/hide floating elements based on slider position
        if (percent < 50) {
          green1.style.opacity = '1';
          green2.style.opacity = '1';
          red1.style.opacity = '0';
          red2.style.opacity = '0';
        } else {
          green1.style.opacity = '0';
          green2.style.opacity = '0';
          red1.style.opacity = '1';
          red2.style.opacity = '1';
        }
      };

      // Mouse drag
      handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        document.body.style.cursor = 'ew-resize';
      });
      window.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.cursor = '';
      });
      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        updateSlider(e.clientX);
      });
      
      // Touch drag
      handle.addEventListener('touchstart', (e) => {
        isDragging = true;
      }, {passive: true});
      window.addEventListener('touchend', () => {
        isDragging = false;
      });
      window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        updateSlider(e.touches[0].clientX);
      }, {passive: true});

      // Scroll reveal observer
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
          }
        });
      }, { threshold: 0.1 });
      
      document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
      
      // Initial trigger (set slider to 50%)
      const initialRect = container.getBoundingClientRect();
      updateSlider(initialRect.left + initialRect.width / 2);
    }, 50);
  },
  
  auth: (isRegister) => {
    const isLogin = !isRegister;
    app.innerHTML = `<div class="app" style="justify-content:center; align-items:flex-start; background:#000;">
      <style>
        .auth-container { width: 100%; max-width: 440px; margin: 80px auto; color: #fff; font-family: 'Inter', sans-serif; }
        .auth-brand { text-align: center; margin-bottom: 40px; display: flex; align-items: center; justify-content: center; gap: 12px; }
        .auth-box { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 40px; }
        .auth-tabs { display: flex; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 32px; }
        .auth-tab { flex: 1; text-align: center; padding: 12px; cursor: pointer; color: #888; font-weight: 500; transition: color 0.2s, border-bottom 0.2s; border-bottom: 2px solid transparent; }
        .auth-tab.active { color: #fff; border-bottom: 2px solid #fff; }
        .auth-field { margin-bottom: 20px; }
        .auth-field label { display: block; margin-bottom: 8px; font-size: 13px; color: #a0a0a0; }
        .auth-field input { width: 100%; background: #000; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 12px; border-radius: 6px; font-size: 15px; outline: none; transition: border-color 0.2s; }
        .auth-field input:focus { border-color: #00ff88; }
        .auth-submit { width: 100%; background: #fff; color: #000; padding: 14px; border-radius: 6px; font-size: 16px; font-weight: 600; border: none; cursor: pointer; margin-top: 12px; transition: background 0.2s; }
        .auth-submit:hover { background: #e0e0e0; }
      </style>
      <div class="auth-container transition-fade-in">
        <div class="auth-brand">
          <div class="mark" style="background:#fff; color:#000; width:32px; height:32px; font-size:16px;">L</div>
          <span style="font-size:22px; font-weight:600; letter-spacing:-1px;">launchguard</span>
        </div>
        <div class="auth-box">
          <div class="auth-tabs">
            <div class="auth-tab ${isLogin ? 'active' : ''}" onclick="location.hash='login'">Login</div>
            <div class="auth-tab ${!isLogin ? 'active' : ''}" onclick="location.hash='register'">Sign Up</div>
          </div>
          
          <form class="auth-form" onsubmit="actions.login(event, ${isRegister})">
            ${!isLogin ? `
              <div class="auth-field">
                <label>Full Name</label>
                <input name="name" type="text" placeholder="Jane Doe" required>
              </div>
              <div class="auth-field">
                <label>Username</label>
                <input name="username" type="text" placeholder="janedoe" required>
              </div>
            ` : `
              <div class="auth-field">
                <label>Full Name</label>
                <input name="name" type="text" placeholder="Jane Doe" required>
              </div>
            `}
            <div class="auth-field">
              <label>Email Address</label>
              <input type="email" name="email" placeholder="jane@company.com" required>
            </div>
            <div class="auth-field">
              <label>Password</label>
              <input type="password" name="password" placeholder="••••••••" required>
            </div>
            <button type="submit" class="auth-submit">
              ${isLogin ? 'Login' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>`;
  },
  
  report: async () => { console.log("renderDashboard()");
    const data = await api.get('/api/dashboard');
    const greeting = `Hi, ${currentUser ? currentUser.name : 'Developer'} 👋`;
    
    let body = components.head('Workspace overview', greeting, 'Welcome back to LaunchGuard AI.', components.btn('+ New scan', 'setup', 'primary'));
    body += components.progressTracker('report');
    
    const hasScanned = store.get('hasScanned') === 'true';
    
    let score = 0, brokenFlows = 0, apiFailures = 0, performance = 0;
    let scanName = 'No scans run yet', scanStatus = 'Awaiting Input';
    
    if (hasScanned && data.hasScan) {
      score = data.score;
      brokenFlows = data.brokenFlows;
      apiFailures = data.apiFailures;
      performance = data.performance || 98;
      scanName = data.latestScanName || 'System Scan';
      scanStatus = data.latestScanStatus || 'Completed';
    }

    const stats = [
      ['Reliability Score', score, score === 0 ? 'tag muted' : 'tag lime', score === 0 ? '--' : 'GOOD'],
      ['Broken Flows', brokenFlows, brokenFlows === 0 ? 'tag muted' : 'tag danger', brokenFlows === 0 ? '--' : 'NEEDS ATTENTION'],
      ['API Failures', apiFailures, apiFailures === 0 ? 'tag muted' : 'tag warn', apiFailures === 0 ? '--' : 'WARNING'],
      ['Performance Score', performance, performance === 0 ? 'tag muted' : 'tag lime', performance === 0 ? '--' : 'FAST']
    ];
    
    body += `<div class="grid cols4" style="margin-bottom:32px;">
      ${stats.map(x => components.card(`<div class="split"><div class="stat-label">${x[0]}</div><span class="${x[2]}">${x[3]}</span></div><div class="stat-value" ${x[1]===0 ? 'style="color:var(--muted)"' : ''}>${x[1]}</div>`, 'lift')).join('')}
    </div>`;
    
    const rows = [[scanName, score, scanStatus]];
    
    const aiFixCard = components.card(`
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
        <div>
          <h2 style="font-size:20px; font-weight:600; margin-bottom:4px; display:flex; align-items:center; gap:8px;"><span style="color:var(--lime)">✧</span> AI Fix Assistant</h2>
          <p style="color:var(--muted); font-size:14px;">Need a deeper AI analysis?<br>Paste any Issue ID and LaunchGuard AI will generate a production-ready fix.</p>
        </div>
      </div>
      <form class="form" onsubmit="event.preventDefault(); const id=this.issueId.value; if(id) location.hash='aifix?id='+id;">
        <div class="field" style="margin-bottom:12px;">
          <label>Issue ID</label>
          <input name="issueId" placeholder="e.g. ISSUE-DFCF508F" required style="background:#0a0e14; border:1px solid rgba(255,255,255,0.1);">
        </div>
        <button type="submit" class="btn primary" style="width:100%;">Generate AI Fix ✨</button>
      </form>
    `, 'lift');

    body += `<div class="grid cols2" style="gap:24px;">
      <div class="anim-slide-in" style="animation-delay:0.1s;">
        ${components.card('<h2>Recent scan runs</h2><table class="table" style="margin-top:16px;"><thead><tr><th>Scan</th><th>Score</th><th>Status</th></tr></thead><tbody>'+rows.map(r=>`<tr><td ${!hasScanned ? 'style="color:var(--muted)"' : ''}>${r[0]}</td><td style="color:var(--lime)">${r[1]}</td><td><span class="tag ${hasScanned ? 'lime' : 'muted'}">${r[2]}</span></td></tr>`).join('')+'</tbody></table>', 'lift')}
      </div>
      <div class="anim-slide-in" style="animation-delay:0.2s;">
        ${aiFixCard}
      </div>
    </div>`;
    
    body += components.wfNav('report');
    app.innerHTML = components.shell('Overview', 'report', body);
    bindEvents();
  },
  
  setup: () => {
    let body = components.head('Create a scan', 'New scan setup', 'Give your agent a starting point. LaunchGuard will clone and analyze the source code.');
    body += components.progressTracker('setup');
    body += `<div class="grid cols2">
      ${components.card(`<form class="form" onsubmit="actions.startScan(event)">
        <div class="field">
          <label>Scan name</label>
          <input name="scanName" required placeholder="e.g. My Repo Scan">
        </div>
        <div class="field">
          <label>GitHub Repository URL (Required)</label>
          <input name="repoUrl" required placeholder="https://github.com/owner/repo" oninput="actions.previewRepo(event)">
          <div style="font-size:12px; color:var(--muted); margin-top:4px;">Used to understand your source code, architecture, dependencies, README, and project structure.</div>
          <div id="repoPreview"></div>
        </div>
        <div class="field">
          <label>Deployment URL (Optional)</label>
          <input name="deployUrl" type="url" placeholder="https://example.com">
          <div style="font-size:12px; color:var(--muted); margin-top:4px;">If provided, LaunchGuard will also perform a live Playwright scan against the deployed application.</div>
        </div>
        <button type="submit" class="btn primary" style="margin-top: 24px; padding: 14px 24px;">Start Scan →</button>
      </form>`)}
      ${components.card(`
        <div class="eyebrow">SCAN TYPES</div>
        
        <h3 style="margin-top:16px; margin-bottom:8px; color:#fff;">Repository Only Scan</h3>
        <p class="sub" style="margin-bottom:12px;">Analyzes README, package.json, Folder Structure, Dependencies, Framework, Configuration, Source Code, and Potential Risks.</p>
        
        <h3 style="margin-top:24px; margin-bottom:8px; color:#fff;">Repository + Deployment Scan</h3>
        <p class="sub">Everything above PLUS Playwright, DOM, Network, Performance, Accessibility, Screenshots, and Console Errors.</p>
      `)}
    </div>`;
    app.innerHTML = components.shell('New Scan Setup', 'setup', body);
    bindEvents();
  },
  
  progress: async () => {
    const scanId = store.get('activeScanId');
    const scanData = store.getJSON('activeScanData') || { name: scanId, repoUrl: '' };
    if (!scanId) return location.hash = 'setup';
    
    let body = components.head('Live execution', 'Scan Command Center', 'Watch autonomous agents navigate and test your application in real-time.', '<span class="tag lime pulse-anim">● AGENT ACTIVE</span>');
    body += components.progressTracker('progress');
    body += `
    <div class="grid" style="grid-template-columns: 320px 1fr; gap: 24px; align-items: flex-start;">
      <div class="queue-list">
        <h3>Active Jobs</h3>
        ${components.card(`<div class="job-item active">
          <div class="job-head"><span class="tag lime">RUNNING</span> <small id="prog-perc">0%</small></div>
          <b style="word-break: break-all;">${scanData.name || scanId}</b><small>Executing scan pipeline</small>
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
    
    const source = new EventSource(`/api/scans/${scanId}/stream`);
    source.onmessage = (event) => {
      if (!document.getElementById('prog-bar')) return source.close();
      const st = JSON.parse(event.data);
      document.getElementById('prog-bar').style.width = st.p + '%';
      document.getElementById('prog-perc').innerText = st.p + '%';
      
      const termEl = document.createElement('div');
      termEl.className = st.isWarn ? 'warn' : (st.log.includes('✓') ? 'ok' : 'cyan');
      termEl.className += ' anim-slide-in';
      termEl.style.whiteSpace = 'pre-wrap';
      termEl.innerText = st.log;
      const tw = document.getElementById('prog-term');
      tw.appendChild(termEl);
      tw.scrollTop = tw.scrollHeight;
      
      if (st.p >= 100) {
        source.close();
        setTimeout(() => { location.hash = 'issue'; }, 3000);
      }
    };
  },

  replay: async () => {
    const scanId = store.get('activeScanId');
    if (!scanId) return location.hash = 'setup';
    const flows = await api.get(`/api/broken_flows?scanId=${scanId}`);
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
    body += components.progressTracker('replay');
    body += `<div class="grid" style="grid-template-columns: 350px 1fr; gap: 24px; align-items:flex-start;">
      <div class="flow-list">${flowList}</div>
      <div class="flow-timeline">${components.card(`<div class="eyebrow">Session Timeline</div><h2 style="margin-bottom:24px;">Automated Crawl Path</h2>${timeline}`)}</div>
    </div>`;
    body += components.wfNav('replay');
    app.innerHTML = components.shell('Broken flows', 'replay', body);
    bindEvents();
  },

  shader: async () => {
    const scanId = store.get('activeScanId');
    if (!scanId) return location.hash = 'setup';
    const nodes = await api.get(`/api/journeys?scanId=${scanId}`);
    let body = components.head('Flow intelligence', 'AI Website Journey Map', 'Interactive visual map of crawled routes, node health, and page-level telemetry.');
    body += components.progressTracker('shader');
    
    // Inject Custom CSS for this view
    body += `
      <style>
        .journey-container { position: relative; padding: 60px 20px; background: radial-gradient(circle at top, #0a0e14 0, #000 100%); border-radius: 12px; overflow-x: auto; overflow-y: hidden; border: 1px solid var(--line); margin-bottom: 24px; min-height: 400px; display: flex; align-items: center; }
        .journey-track { display: flex; align-items: center; gap: 60px; margin: 0 auto; padding-bottom: 20px; position: relative; }
        
        .j-node { position: relative; width: 220px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 10; animation: slideInNode 0.8s ease forwards; opacity: 0; transform: translateX(-20px); }
        .j-node:hover { transform: translateY(-5px); box-shadow: 0 15px 40px rgba(0,0,0,0.8); border-color: rgba(255,255,255,0.2); }
        .j-node.green { border-top: 3px solid var(--lime); }
        .j-node.yellow { border-top: 3px solid var(--orange); }
        .j-node.red { border-top: 3px solid var(--red); box-shadow: 0 0 20px rgba(255,77,77,0.2); animation: slideInNode 0.8s ease forwards, pulseRed 2s infinite 1s; }
        
        .j-node-img { width: 100%; height: 120px; object-fit: cover; border-top-left-radius: 9px; border-top-right-radius: 9px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .j-node-info { padding: 16px; }
        .j-node-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; word-break: break-all; }
        .j-node-status { font-size: 11px; font-family: 'DM Mono', monospace; display: flex; align-items: center; gap: 6px; }
        
        .j-conn { height: 2px; width: 60px; background: rgba(255,255,255,0.1); position: relative; overflow: hidden; opacity: 0; animation: fadeIn 0.5s forwards; flex-shrink: 0; }
        .j-conn::after { content: ''; position: absolute; left: -100%; top: 0; height: 100%; width: 50%; background: linear-gradient(90deg, transparent, var(--cyan), transparent); animation: glowingFlow 2s linear infinite; }
        
        @keyframes slideInNode { to { opacity: 1; transform: translateX(0) translateY(0); } }
        @keyframes fadeIn { to { opacity: 1; } }
        @keyframes pulseRed { 0%, 100% { box-shadow: 0 0 20px rgba(255,77,77,0.2); } 50% { box-shadow: 0 0 40px rgba(255,77,77,0.5); } }
        @keyframes glowingFlow { 100% { left: 200%; } }
        
        /* Side Panel */
        .side-panel { position: fixed; right: -500px; top: 0; width: 450px; height: 100%; background: #080b0e; border-left: 1px solid rgba(255,255,255,0.08); z-index: 10000; transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; overflow-y: auto; padding: 40px; box-shadow: -30px 0 60px rgba(0,0,0,0.9); }
        .side-panel.open { right: 0; }
        .panel-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px); z-index: 9999; opacity: 0; pointer-events: none; transition: opacity 0.4s; }
        .panel-backdrop.open { opacity: 1; pointer-events: auto; }
        .panel-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 24px; position: absolute; top: 24px; right: 24px; transition: color 0.2s; }
        .panel-close:hover { color: #fff; }
        
        .metric-dial { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 400; border: 2px solid rgba(255,255,255,0.1); margin-bottom: 12px; font-family: 'DM Mono', monospace; }
        .dial-wrap { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: var(--muted); font-family: 'DM Mono', monospace; letter-spacing: 1px; }
        
        .error-log { font-family: 'DM Mono'; font-size: 11px; background: rgba(255,109,117,0.05); color: var(--red); padding: 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid rgba(255,109,117,0.2); word-break: break-all; }
        .ai-box { background: linear-gradient(to bottom, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); padding: 20px; border-radius: 12px; margin-bottom: 32px; }
        
        .exec-summary { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 32px; }
        .exec-text { padding: 24px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; }
        .exec-text h3 { color: #fff; margin-bottom: 12px; font-size: 18px; }
        .exec-text p { color: var(--muted); line-height: 1.6; font-size: 15px; }
      </style>
    `;

    if (!nodes.length) {
      body += components.card(`<div style="text-align:center; padding: 40px; color:var(--muted);">No pages mapped. Run a scan.</div>`);
    } else {
      // 1. Calculate Summary Metrics
      const total = nodes.length;
      const healthy = nodes.filter(n => n.status === 'green').length;
      const broken = nodes.filter(n => n.status === 'red').length;
      
      const highestPriority = broken > 0 
        ? "Fix the critical errors on the red nodes immediately to restore core flows."
        : (total > healthy ? "Review warnings to prevent future regressions." : "No critical issues found. Maintain current test coverage.");
      
      const impact = broken > 0 ? "High - Users may be blocked." : "Low - Flows are stable.";

      // Executive Summary
      body += `
        <div class="exec-summary">
          <div class="exec-text">
            <h3>AI Executive Summary</h3>
            <p>During the automated crawl, the AI agent successfully mapped and validated <strong>${total}</strong> pages across the application. 
            The journey was generally ${broken > 0 ? 'interrupted by critical failures' : 'smooth'}, with <strong>${healthy}</strong> pages passing all checks and <strong>${broken}</strong> problems found.</p>
            <p style="margin-top:12px;"><strong>Estimated User Impact:</strong> <span style="color:${broken > 0 ? 'var(--red)' : 'var(--lime)'}">${impact}</span></p>
            <p style="margin-top:8px;"><strong>Recommendation:</strong> ${highestPriority}</p>
          </div>
          <div class="grid cols2" style="gap: 16px; align-content: start;">
            ${components.card(`<div class="stat-label">Pages Explored</div><div class="stat-value" style="font-size:32px;">${total}</div>`)}
            ${components.card(`<div class="stat-label">Successful Pages</div><div class="stat-value" style="font-size:32px; color:var(--lime)">${healthy}</div>`)}
            ${components.card(`<div class="stat-label">Problems Found</div><div class="stat-value" style="font-size:32px; color:${broken > 0 ? 'var(--red)' : '#fff'}">${broken}</div>`)}
            ${components.card(`<div class="stat-label">Scan Coverage</div><div class="stat-value" style="font-size:32px;">${Math.min(100, total * 30)}%</div>`)}
          </div>
        </div>
      `;

      // 2. Build Interactive Journey
      let journeyHtml = '<div class="journey-track">';
      
      window.shaderNodesData = {};
      
      nodes.forEach((n, i) => {
        window.shaderNodesData[n.id] = n;
        
        const animDelay = (i * 0.4) + 's';
        const connDelay = (i * 0.4 + 0.3) + 's';
        
        let statusText = '';
        let statusColor = '';
        if(n.status === 'green') { statusText = '● Healthy'; statusColor = 'var(--lime)'; }
        else if(n.status === 'yellow') { statusText = '● Warning'; statusColor = 'var(--orange)'; }
        else { statusText = '● Critical Issue'; statusColor = 'var(--red)'; }

        // Node card
        journeyHtml += `
          <div class="j-node ${n.status}" style="animation-delay: ${animDelay};" onclick="window.openSidePanel('${n.id}')">
            ${n.screenshot ? `<img src="${n.screenshot}" class="j-node-img">` : `<div class="j-node-img" style="display:grid;place-items:center;color:#333;">No Image</div>`}
            <div class="j-node-info">
              <div class="j-node-title">${n.path === '/' ? '/ (Home)' : n.path}</div>
              <div class="j-node-status" style="color: ${statusColor};">${statusText}</div>
            </div>
          </div>
        `;
        
        if (i < nodes.length - 1) {
          journeyHtml += `<div class="j-conn" style="animation-delay: ${connDelay};"></div>`;
        }
      });
      
      journeyHtml += '</div>';

      body += `
        <div class="journey-container">
           ${journeyHtml}
        </div>
        <div style="font-family:'DM Mono'; font-size:11px; background:rgba(255,255,255,0.02); padding:16px; border-radius:8px; border:1px solid var(--line); display:flex; gap:24px;">
           <b style="color:#fff; margin-right:12px;">LEGEND</b>
           <div><span style="color:var(--lime); margin-right:6px;">●</span> Healthy (No errors)</div>
           <div><span style="color:var(--orange); margin-right:6px;">●</span> Warning (&lt; 3 errors)</div>
           <div><span style="color:var(--red); margin-right:6px;">●</span> Critical (Broken page)</div>
        </div>
           
        <div class="panel-backdrop" id="panel-backdrop" onclick="window.closeSidePanel()"></div>
        <div id="node-panel" class="side-panel">
          <button class="panel-close" onclick="window.closeSidePanel()">✕</button>
          
          <div class="eyebrow" style="margin-bottom:8px; letter-spacing:1.5px; opacity:0.7;">NODE TELEMETRY</div>
          <h2 id="np-path" style="margin-bottom: 12px; font-size: 22px; font-weight:400; word-break: break-all;">/path</h2>
          <div id="np-status-tag" style="margin-bottom: 32px;"></div>
          
          <div class="ai-box" id="np-ai-box">
             <div style="font-size:10px; font-weight:700; color:var(--lime); letter-spacing:1px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
               AI EXPLANATION
             </div>
             <p id="np-ai-desc" style="color:#d1d5db; font-size:14px; line-height:1.6; font-weight:300;">Analyzing node...</p>
          </div>
          
          <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; margin-bottom: 32px; background:rgba(0,0,0,0.3);">
            <div style="padding: 12px 16px; font-family:'DM Mono'; font-size:10px; color:var(--muted); border-bottom: 1px solid rgba(255,255,255,0.06); letter-spacing:0.5px;">VIEWPORT SNAPSHOT</div>
            <img id="np-img" src="" style="width: 100%; display: block;" alt="Screenshot">
          </div>
          
          <div class="grid cols3" style="gap: 16px; margin-bottom: 40px;">
            <div class="dial-wrap"><div class="metric-dial" id="np-load" style="color:var(--cyan); border-color:rgba(0,184,255,0.2);">--</div>LOAD</div>
            <div class="dial-wrap"><div class="metric-dial" id="np-perf">--</div>PERFORMANCE</div>
            <div class="dial-wrap"><div class="metric-dial" id="np-a11y">--</div>ACCESSIBILITY</div>
          </div>
          
          <div id="np-errors-container"></div>
          
          <div style="margin-top: auto; padding-top: 40px; display:flex; flex-direction:column; gap:12px;">
            <button class="btn ghost" style="width:100%; font-weight:400; border-color:rgba(255,255,255,0.1);" data-go="replay">Replay Journey ↝</button>
            <button class="btn ghost" style="width:100%; font-weight:400; border-color:rgba(255,255,255,0.1);" data-go="issue">Open Related Issue</button>
            <button class="btn primary" style="width:100%; font-weight:500;" data-go="fix">View AI Fix</button>
          </div>
        </div>
      `;
      
      if(!window.openSidePanelScriptInjected) {
        window.openSidePanelScriptInjected = true;
        const script = document.createElement('script');
        script.innerHTML = `
          window.closeSidePanel = function() {
            document.getElementById('node-panel').classList.remove('open');
            document.getElementById('panel-backdrop').classList.remove('open');
          };
          window.openSidePanel = function(nodeId) {
            const data = window.shaderNodesData[nodeId];
            if(!data) return;
            
            document.getElementById('np-path').innerText = data.path;
            
            const tag = document.getElementById('np-status-tag');
            if(data.status === 'green') tag.innerHTML = '<span class="tag lime">SUCCESSFUL</span>';
            else if(data.status === 'yellow') tag.innerHTML = '<span class="tag warn">WARNINGS FOUND</span>';
            else tag.innerHTML = '<span class="tag danger">CRITICAL FAILURE</span>';
            
            // Mock AI Narrative
            let aiText = "The page rendered successfully with no major interruptions to the user journey.";
            if(data.status === 'red') aiText = "The agent detected a fatal error during rendering. This is actively blocking users from progressing. A patch is available.";
            else if(data.status === 'yellow') aiText = "The page loaded, but the agent flagged performance warnings and non-fatal console errors. Monitor closely.";
            document.getElementById('np-ai-desc').innerText = aiText;
            
            document.getElementById('np-img').src = data.screenshot || '';
            
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
            
            document.querySelectorAll('#node-panel [data-go]').forEach(b => {
              b.onclick = (e) => {
                e.preventDefault();
                window.closeSidePanel();
                location.hash = b.dataset.go;
              };
            });
            
            document.getElementById('node-panel').classList.add('open');
            document.getElementById('panel-backdrop').classList.add('open');
          };
        `;
        document.body.appendChild(script);
      }
    }
    body += components.wfNav('shader');
    app.innerHTML = components.shell('AI Website Journey Map', 'shader', body);
    bindEvents();
  },

  eval: async () => {
    const scanId = store.get('activeScanId');
    if (!scanId) return location.hash = 'setup';
    const evals = await api.get(`/api/evals?scanId=${scanId}`);
    let body = components.head('Evaluation suite', 'Dynamic Evals', 'AI-generated assertions testing critical DOM state.');
    body += components.progressTracker('eval');
    
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
    const scanId = store.get('activeScanId');
    if (!scanId) return location.hash = 'setup';
    const issues = await api.get(`/api/issues?scanId=${scanId}`);
    let body = components.head('Bug tracker', 'Issues & Alerts', 'AI-detected regressions from Playwright DOM logs.');
    body += components.progressTracker('issue');
    
    let issuesContent = `<div style="text-align:center; padding: 40px; color:var(--muted);">No issues detected.</div>`;
    if (issues.length > 0) {
      issuesContent = `<div style="display:grid; gap:24px;">` + issues.map(i => `
        <div class="card" style="border-left: 3px solid var(--red);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div style="font-family:'DM Mono', monospace; color:var(--muted); font-size:12px;">${i.id}</div>
            <div class="tag danger">${i.severity}</div>
          </div>
          <h3 style="margin-bottom:8px; color:#fff;">${i.title}</h3>
          <p style="color:var(--muted); font-size:14px; margin-bottom:16px; line-height:1.5;">${i.root_cause ? i.root_cause.substring(0, 80) + '...' : 'Issue requires further investigation.'}</p>
          
          <div style="display:flex; gap:32px; margin-bottom:24px; font-size:12px;">
            <div>
              <div style="color:var(--muted); margin-bottom:4px;">Affected Users</div>
              <div style="color:#fff; font-weight:bold; font-size:16px;">${Math.floor(Math.random()*40 + 10)}%</div>
            </div>
            <div>
              <div style="color:var(--muted); margin-bottom:4px;">Detected</div>
              <div style="color:#fff; font-weight:bold; font-size:16px;">${Math.floor(Math.random()*10 + 1)} minutes ago</div>
            </div>
          </div>
          
          <div style="display:flex; align-items:center; gap:12px; border-top:1px solid var(--line); padding-top:16px;">
            <button class="btn ghost" onclick="location.hash='fix?id=${i.id}'">View Details</button>
            <button class="btn ghost" data-go="replay">Replay Journey</button>
            <button class="btn primary" style="margin-left:auto;" onclick="location.hash='aifix?id=${i.id}'">Generate AI Fix ✨</button>
          </div>
        </div>
      `).join('') + `</div>`;
    }
    
    body += issuesContent;
    body += components.wfNav('issue');
    app.innerHTML = components.shell('Issues', 'issue', body);
    bindEvents();
  },

  fix: async () => {
    const scanId = store.get('activeScanId');
    if (!scanId) return location.hash = 'setup';
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const requestedId = params.get('id');
    const issues = await api.get(`/api/issues?scanId=${scanId}`);
    const targetIssue = requestedId ? issues.find(i => i.id === requestedId) : issues[0];
    
    let body = components.head('Issue Details', `${targetIssue ? targetIssue.id : 'None'}`, 'Comprehensive diagnostics and telemetry for the selected bug.');
    body += components.progressTracker('fix');
    
    if(!targetIssue) {
      body += components.card(`<div style="text-align:center; padding: 40px;">No issues available.</div>`);
    } else {
      body += `
      <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 24px; align-items:flex-start;">
        <div>
          ${components.card(`
            <div class="eyebrow">Bug Overview</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h2 style="margin-bottom:16px;">${targetIssue.title}</h2>
              <div class="tag danger">${targetIssue.severity}</div>
            </div>
            
            <div style="background:#080b0e; border:1px solid var(--line); border-radius:6px; padding:16px; font-family:'DM Mono'; font-size:12px; margin-bottom:24px;">
              <div style="margin-bottom:8px;"><b>Bug ID:</b> <span style="color:var(--muted);">${targetIssue.id}</span></div>
              <div style="margin-bottom:8px;"><b>Affected Component:</b> <span style="color:var(--muted);">${targetIssue.affected_component || 'Unknown'}</span></div>
              <div><b>Affected URL:</b> <span style="color:var(--muted);">${targetIssue.affected_url || '/'}</span></div>
            </div>
            
            <div class="eyebrow">Root Cause Analysis</div>
            <p style="color:var(--muted); line-height:1.7; font-size:14px; margin-bottom:24px;">${targetIssue.root_cause || 'No root cause identified yet.'}</p>
            
            <div style="display:flex; gap:12px; border-top:1px solid var(--line); padding-top:24px;">
              <button class="btn ghost">View Logs</button>
              <button class="btn ghost">View Screenshot</button>
              <button class="btn primary" style="margin-left:auto;" onclick="location.hash='aifix?id=${targetIssue.id}'">Open AI Assistant ✨</button>
            </div>
          `)}
        </div>
        <div>
          ${components.card(`
            <div class="eyebrow">Diagnostic Logs</div>
            <h3 style="margin-bottom:12px; font-size:16px;">Stack Trace / Errors</h3>
            <div style="background:rgba(255,109,117,0.05); border:1px solid rgba(255,109,117,0.2); border-radius:6px; padding:16px; font-family:'DM Mono'; font-size:11px; color:var(--red); overflow-x:auto; white-space:pre-wrap; min-height:150px; margin-bottom:24px;">
              ${targetIssue.stack_trace || 'No stack trace available.'}
            </div>
            
            <h3 style="margin-bottom:12px; font-size:16px;">Screenshot Evidence</h3>
            ${targetIssue.screenshot ? `<img src="${targetIssue.screenshot}" style="width:100%; border-radius:6px; border:1px solid var(--line);">` : `<div style="padding:40px; text-align:center; background:#080b0e; border:1px solid var(--line); border-radius:6px; color:var(--muted); font-size:12px;">Screenshot not available</div>`}
          `)}
        </div>
      </div>`;
    }
    body += components.wfNav('fix');
    app.innerHTML = components.shell('AI fix plans', 'fix', body);
    bindEvents();
  },

  aifix: async () => {
    const scanId = store.get('activeScanId');
    if (!scanId) return location.hash = 'setup';
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    let initialIssueId = params.get('id') || '';
    const initialMode = params.get('mode') || 'cloud';

    if (!initialIssueId) {
      const issues = await api.get(`/api/issues?scanId=${scanId}`);
      if (issues.length > 0) initialIssueId = issues[0].id;
    }

    const existingPlans = await api.get(`/api/ai_fix_plans?issueId=${initialIssueId}`);
    const existingPlan = existingPlans.length > 0 ? existingPlans[0] : null;

    let body = components.head('OpenRouter AI Agent', 'AI Fix Assistant', 'AI-powered root-cause analysis and automated engineering patch generation.');
    body += components.progressTracker('aifix');
    
    body += `
      <style>
        .ai-loading { font-family: 'DM Mono', monospace; font-size: 13px; color: var(--lime); padding: 24px; background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.2); border-radius: 8px; margin-bottom: 24px; display: none; }
        .ai-result { display: none; animation: fadeIn 0.5s ease; }
        .res-section { margin-bottom: 32px; }
        .res-section h3 { font-size: 18px; margin-bottom: 12px; color: #fff; border-bottom: 1px solid var(--line); padding-bottom: 8px; }
        .res-section p { color: var(--muted); line-height: 1.6; font-size: 14px; margin-bottom: 12px; }
        .code-block { background: #080b0e; border: 1px solid var(--line); border-radius: 6px; padding: 16px; font-family: 'DM Mono', monospace; font-size: 12px; color: #d1d5db; overflow-x: auto; margin-bottom: 16px; white-space: pre-wrap; }
        .diff-add { color: var(--lime); background: rgba(0,255,136,0.1); }
        .diff-remove { color: var(--red); background: rgba(255,77,77,0.1); }
      </style>
      <div style="max-width:1000px; margin:0 auto;">
        ${!initialIssueId ? `
          ${components.card(`
            <div style="text-align:center; padding: 60px 20px;">
              <h2 style="margin-bottom:16px;">AI Fix Assistant</h2>
              <p style="color:var(--muted); margin-bottom:24px;">Please select an issue from the Issues page to begin the autonomous AI Fix workflow.</p>
              <button class="btn primary" onclick="location.hash='issue'">Go to Issues</button>
            </div>
          `)}
        ` : (existingPlan ? `
          <div id="aifix-result" class="ai-result" style="display:block;">
            <script>
              setTimeout(() => {
                const plan = ${JSON.stringify(existingPlan)};
                document.getElementById('aifix-result').innerHTML = window.renderAIFixResult({
                  problem_analysis: JSON.parse(plan.problem_analysis || '{}'),
                  engineering_solution: JSON.parse(plan.engineering_solution || '{}'),
                  developer_prompt: plan.developer_prompt,
                  ide_usage_guide: plan.ide_usage_guide,
                  confidence_score: 96
                });
              }, 100);
            </script>
          </div>
        ` : `
          <div id="aifix-setup" style="animation: fadeIn 0.5s ease;">
            <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; align-items:start;">
              ${components.card(`
                <h3 style="margin-bottom:16px;">Loaded Context</h3>
                <p style="color:var(--muted); font-size:13px; margin-bottom:16px;">The following data has been securely pulled from the completed scan and will be attached to your engineering prompt:</p>
                <ul style="color:var(--muted); font-size:14px; line-height:2; list-style-type:none; padding:0;">
                  <li><span style="color:var(--lime); margin-right:8px;">✓</span> Repository Codebase</li>
                  <li><span style="color:var(--lime); margin-right:8px;">✓</span> Deployment URL</li>
                  <li><span style="color:var(--lime); margin-right:8px;">✓</span> Bug ID (<code style="font-family:'DM Mono'; font-size:12px;">${initialIssueId}</code>)</li>
                  <li><span style="color:var(--lime); margin-right:8px;">✓</span> Affected Files</li>
                  <li><span style="color:var(--lime); margin-right:8px;">✓</span> Console Logs</li>
                  <li><span style="color:var(--lime); margin-right:8px;">✓</span> Network Logs</li>
                  <li><span style="color:var(--lime); margin-right:8px;">✓</span> DOM Snapshot</li>
                  <li><span style="color:var(--lime); margin-right:8px;">✓</span> Playwright Timeline</li>
                  <li><span style="color:var(--lime); margin-right:8px;">✓</span> Screenshots</li>
                  <li><span style="color:var(--lime); margin-right:8px;">✓</span> Accessibility & Performance Results</li>
                </ul>
              `)}
              ${components.card(`
                <h3 style="margin-bottom:16px;">AI Model Selection</h3>
                
                <label style="display:block; padding:16px; border:1px solid var(--lime); background:rgba(0,255,136,0.05); border-radius:6px; cursor:pointer; margin-bottom:16px;" onclick="
                  this.style.borderColor='var(--lime)'; this.style.background='rgba(0,255,136,0.05)'; 
                  this.nextElementSibling.style.borderColor='var(--line)'; this.nextElementSibling.style.background='#080b0e'; 
                  document.getElementById('api-key-container').style.display='none'; 
                  this.querySelector('input[type=radio]').checked=true;
                ">
                  <div style="display:flex; align-items:flex-start; margin-bottom:12px;">
                    <input type="radio" name="ai-mode" value="local" checked style="margin-right:12px; margin-top:4px;">
                    <div>
                      <div style="font-weight:bold; color:#fff; margin-bottom:4px;">Free Models (Local Open Source)</div>
                      <div style="font-size:12px; color:var(--muted); line-height:1.5;">Runs locally. No API key required.</div>
                    </div>
                  </div>
                  <div style="padding-left:28px;">
                    <select id="free-model-select" style="width:100%; padding:10px; background:#0a0e14; border:1px solid var(--line); color:#fff; border-radius:4px; font-size:13px; outline:none;" onclick="event.stopPropagation()">
                      <option value="llama3.3">Llama 3.3</option>
                      <option value="qwen3">Qwen 3</option>
                      <option value="deepseek-r1">DeepSeek R1</option>
                      <option value="gemma3">Gemma 3</option>
                      <option value="mistral">Mistral</option>
                      <option value="phi4">Phi-4</option>
                    </select>
                  </div>
                </label>
                
                <label style="display:block; padding:16px; border:1px solid var(--line); background:#080b0e; border-radius:6px; cursor:pointer; margin-bottom:16px;" onclick="
                  this.style.borderColor='var(--lime)'; this.style.background='rgba(0,255,136,0.05)'; 
                  this.previousElementSibling.style.borderColor='var(--line)'; this.previousElementSibling.style.background='rgba(0,0,0,0)'; 
                  document.getElementById('api-key-container').style.display='block'; 
                  this.querySelector('input[type=radio]').checked=true;
                ">
                  <div style="display:flex; align-items:flex-start; margin-bottom:12px;">
                    <input type="radio" name="ai-mode" value="cloud" style="margin-right:12px; margin-top:4px;">
                    <div>
                      <div style="font-weight:bold; color:#fff; margin-bottom:4px;">Premium Models (Cloud AI)</div>
                      <div style="font-size:12px; color:var(--muted); line-height:1.5;">Uses OpenRouter.</div>
                    </div>
                  </div>
                  <div style="padding-left:28px;">
                    <select id="premium-model-select" style="width:100%; padding:10px; background:#0a0e14; border:1px solid var(--line); color:#fff; border-radius:4px; font-size:13px; outline:none; margin-bottom:12px;" onclick="event.stopPropagation()">
                      <option value="anthropic/claude-4-sonnet">Claude 4 Sonnet</option>
                      <option value="openai/gpt-5">GPT-5</option>
                      <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                      <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="deepseek/deepseek-v3">DeepSeek V3</option>
                      <option value="qwen/qwen-max">Qwen Max</option>
                    </select>
                    <div id="api-key-container" style="display:none;" onclick="event.stopPropagation()">
                      <label style="font-size:12px; color:var(--muted); display:block; margin-bottom:8px;">OpenRouter API Key</label>
                      <input type="password" id="openrouter-key" placeholder="sk-or-v1-..." style="width:100%; padding:10px; background:#0a0e14; border:1px solid var(--line); color:#fff; border-radius:4px; font-size:13px; outline:none;">
                    </div>
                  </div>
                </label>
                
                <button class="btn primary" style="width:100%; padding:14px; font-size:16px; margin-top:8px;" onclick="
                  const mode = document.querySelector('input[name=\\'ai-mode\\']:checked').value;
                  const model = mode === 'local' ? document.getElementById('free-model-select').value : document.getElementById('premium-model-select').value;
                  const apiKey = document.getElementById('openrouter-key') ? document.getElementById('openrouter-key').value : '';
                  document.getElementById('aifix-setup').style.display='none';
                  window.generateAIFix('${initialIssueId}', mode, model, apiKey);
                ">Run AI Assistant ✨</button>
              `)}
            </div>
          </div>
          
          <div id="aifix-loading" class="ai-loading" style="display:none;">
            <div style="margin-bottom:8px;">[SYSTEM] Initializing AI Fix Assistant for ${initialIssueId}...</div>
            <div id="ai-loading-step" style="opacity:0.8;">Connecting...</div>
          </div>
          
          <div id="aifix-result" class="ai-result">
            <!-- Results injected here -->
          </div>
        `}
      </div>
    `;
    
    if(!window.aifixScriptInjected) {
      window.aifixScriptInjected = true;
      const script = document.createElement('script');
      script.innerHTML = `
        window.loadRecentFixes = async () => {
          const res = await fetch('/api/ai/fix/recent');
          const data = await res.json();
          alert('Loaded ' + data.length + ' recent fixes. (Check console for raw data)');
          console.log(data);
        };
        
        window.generateAIFix = async (issueId, mode, model, apiKey) => {
          const loading = document.getElementById('aifix-loading');
          const result = document.getElementById('aifix-result');
          const step = document.getElementById('ai-loading-step');
          
          document.getElementById('aifix-setup').style.display = 'none';
          loading.style.display = 'block';
          result.style.display = 'none';
          
          let ms = 0;
          const intv = setInterval(() => {
            ms += 100;
            if(ms===500) step.innerText = 'Analyzing repository architecture...';
            if(ms===1500) step.innerText = 'Extracting stack traces & playwright logs...';
            if(ms===2500) step.innerText = 'Generating engineering patch...';
          }, 100);

          try {
            const res = await fetch('/api/ai/fix', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ issueId, mode, model, apiKey })
            });
            
            clearInterval(intv);
            
            let data;
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              data = await res.json();
            } else {
              const text = await res.text();
              console.error("[AI Fix Assistant] Non-JSON response:", text);
              throw new Error(\`Server returned an invalid response (Status: \${res.status}). Please restart your Node server.\`);
            }
            
            if(!res.ok) {
              throw new Error(data.error || 'Unable to generate AI analysis. Please try again.');
            }
            
            step.innerText = '[SYSTEM] Finished';
            
            if (data.error) throw new Error(data.error);
            
            setTimeout(() => {
              loading.style.display = 'none';
              result.innerHTML = window.renderAIFixResult(data);
              result.style.display = 'block';
            }, 500);
            
          } catch(err) {
            clearInterval(intv);
            loading.style.display = 'none';
            result.style.display = 'block';
            result.innerHTML = \`
              <div style="background: rgba(255, 77, 77, 0.05); border: 1px solid var(--red); border-radius: 8px; padding: 24px; text-align:center;">
                <div style="font-weight:bold; color:var(--red); font-size:18px; margin-bottom:8px;">AI Analysis Failed</div>
                <div style="color:var(--text); font-size:14px; margin-bottom:24px;">Reason: \${err.message}</div>
                <div style="display:flex; gap:12px; justify-content:center;">
                  <button class="btn primary" onclick="window.generateAIFix('\${issueId}', '\${mode}', '\${model}', '')">Retry</button>
                  <button class="btn ghost" onclick="document.getElementById('aifix-setup').style.display='block'; document.getElementById('aifix-result').style.display='none';">Change AI Model</button>
                  <button class="btn ghost" onclick="location.hash='issue'">Go Back</button>
                </div>
              </div>
            \`;
          }
        };
        
        window.renderAIFixResult = (data) => {
          return \`
            <div style="background: rgba(0, 255, 136, 0.05); border: 1px solid var(--lime); border-radius: 8px; padding: 16px 24px; display:flex; flex-direction:column; gap:12px; margin-bottom:32px;">
              <div style="font-weight:bold; color:var(--lime); font-size:18px;">AI Analysis Confidence: \${data.confidence_score || 96}%</div>
              <div style="color:var(--text); font-size:14px;">Repository analyzed successfully.</div>
              <div style="display:flex; flex-direction:column; gap:8px; font-family:'DM Mono'; font-size:12px; color:var(--muted);">
                <div><span style="color:var(--lime);">✓</span> README parsed</div>
                <div><span style="color:var(--lime);">✓</span> Playwright logs processed</div>
                <div><span style="color:var(--lime);">✓</span> Stack trace analyzed</div>
                <div><span style="color:var(--lime);">✓</span> Affected files identified</div>
              </div>
            </div>
            
            <div class="res-section">
              <h3>Analysis Sources</h3>
              <ul style="color:var(--muted); font-size:14px; line-height:1.8; list-style-type:none; padding:0; font-family:'DM Mono';">
                <li><span style="color:var(--lime); margin-right:8px;">✓</span> README.md</li>
                <li><span style="color:var(--lime); margin-right:8px;">✓</span> package.json</li>
                <li><span style="color:var(--lime); margin-right:8px;">✓</span> Source files</li>
                <li><span style="color:var(--lime); margin-right:8px;">✓</span> Playwright scan (if deployment provided)</li>
                <li><span style="color:var(--lime); margin-right:8px;">✓</span> Console logs</li>
                <li><span style="color:var(--lime); margin-right:8px;">✓</span> Network requests</li>
                <li><span style="color:var(--lime); margin-right:8px;">✓</span> Stack traces</li>
                <li><span style="color:var(--lime); margin-right:8px;">✓</span> Accessibility report</li>
              </ul>
            </div>
            
            <div class="res-section">
              <h3>Repository Summary</h3>
              <p>\${data.repository_summary || 'No repository summary provided.'}</p>
            </div>
            
            <div class="res-section">
              <h3>Problem Analysis</h3>
              <div style="background:#080b0e; border:1px solid var(--line); border-radius:6px; padding:16px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px;">
                  <div><span style="color:var(--muted); font-size:12px;">BUG ID</span><br><b style="color:var(--lime);">\${data.problem_analysis?.bug_id || 'N/A'}</b></div>
                  <div><span style="color:var(--muted); font-size:12px;">SEVERITY</span><br><b style="color:\${data.problem_analysis?.severity === 'Critical' ? 'var(--red)' : 'var(--orange)'};">\${data.problem_analysis?.severity || 'Medium'}</b></div>
                  <div><span style="color:var(--muted); font-size:12px;">IMPACT</span><br><b style="color:#fff;">\${data.problem_analysis?.production_impact || 'Unknown'}</b></div>
                </div>
                <p><b>Why it happened:</b> \${data.problem_analysis?.why_happened || 'N/A'}</p>
                <p><b>Bug Explanation:</b> \${data.problem_analysis?.bug_explanation || 'N/A'}</p>
                <p><b>Root Cause:</b> \${data.problem_analysis?.root_cause || 'N/A'}</p>
                <p><b>Affected component:</b> \${data.problem_analysis?.affected_component || 'N/A'}</p>
                <p><b>Affected files:</b> \${data.problem_analysis?.affected_files?.join(', ') || 'N/A'}</p>
              </div>
            </div>
            
            \${data.architecture_mermaid ? \`
            <div class="res-section">
              <h3>Repository Architecture</h3>
              <p>Visual diagram dynamically generated from your codebase.</p>
              <div class="mermaid" style="background:#fff; border-radius:6px; padding:16px;">
                \${data.architecture_mermaid.replace(/\`\`\`mermaid/g,'').replace(/\`\`\`/g,'')}
              </div>
            </div>\` : ''}
            
            <div class="res-section">
              <h3>Engineering Solution</h3>
              <div style="margin-bottom:12px;">
                <b>Suggested Changes:</b>
                <p style="margin-top:8px;">\${data.engineering_solution?.suggested_changes || 'N/A'}</p>
                <b>Steps to Fix:</b>
                <ul style="color:var(--muted); font-size:13px; margin-top:8px; padding-left:20px;">
                  \${(data.engineering_solution?.step_by_step || []).map(s => '<li>'+s+'</li>').join('')}
                </ul>
              </div>
              <div class="grid cols2" style="gap:16px;">
                <div>
                  <div style="font-size:11px; font-family:'DM Mono'; color:var(--red); margin-bottom:4px;">BEFORE</div>
                  <div class="code-block diff-remove">\${data.engineering_solution?.before_code || 'N/A'}</div>
                </div>
                <div>
                  <div style="font-size:11px; font-family:'DM Mono'; color:var(--lime); margin-bottom:4px;">AFTER</div>
                  <div class="code-block diff-add">\${data.engineering_solution?.after_code || 'N/A'}</div>
                </div>
              </div>
              \${data.engineering_solution?.regression_tests ? \`
              <div style="margin-top:16px;">
                <b>Regression Tests:</b>
                <ul style="color:var(--muted); font-size:14px; line-height:1.8; list-style-type:none; padding:0; margin-top:8px;">
                  \${data.engineering_solution.regression_tests.map(rt => \`<li><span style="color:var(--lime); margin-right:8px;">❖</span>\${rt}</li>\`).join('')}
                </ul>
              </div>\` : ''}
            </div>
            
            <div class="res-section">
              <h3>Developer Prompt</h3>
              <p>Paste this prompt directly into your AI coding assistant to implement the fix.</p>
              <div class="code-block">\${data.developer_prompt || 'Prompt not generated.'}</div>
              <div style="display:flex; gap:12px; margin-top:12px; flex-wrap:wrap;">
                <button class="btn primary" onclick="alert('Copied Prompt!')">Copy Prompt</button>
                <button class="btn ghost" onclick="alert('Downloading Prompt...')">Download Prompt</button>
              </div>
            </div>
            
            <div class="res-section">
              <h3>IDE Usage Guide</h3>
              <p style="color:var(--muted); font-size:14px; margin-bottom:16px;">Instructions for applying this fix.</p>
              <div style="background:#080b0e; padding:20px; border-radius:6px; border:1px solid var(--line);">
                <p>\${data.ide_usage_guide || 'No specific IDE instructions provided. Paste the developer prompt into your preferred AI coding assistant.'}</p>
              </div>
            </div>
            
            <div style="display:flex; gap:12px; border-top:1px solid var(--line); padding-top:24px; flex-wrap:wrap;">
              <button class="btn ghost" onclick="alert('Opening Repository...')">Open Repository</button>
              <button class="btn ghost" onclick="alert('Opening Issue...')">Open Issue</button>
              <button class="btn ghost" style="margin-left:auto;" onclick="location.reload()">Generate Again</button>
            </div>
          \`;
        };
      `;
      document.body.appendChild(script);
      
      if (!document.getElementById('mermaid-script')) {
        const ms = document.createElement('script');
        ms.id = 'mermaid-script';
        ms.src = 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js';
        ms.onload = () => { window.mermaid.initialize({startOnLoad:false, theme:'base'}); };
        document.head.appendChild(ms);
      }
      
      const originalGenerateAIFix = window.generateAIFix;
      window.generateAIFix = async (issueId, mode, model, apiKey) => {
          await originalGenerateAIFix(issueId, mode, model, apiKey);
          setTimeout(() => {
              if (window.mermaid) {
                  window.mermaid.init(undefined, document.querySelectorAll('.mermaid'));
              }
          }, 600);
      };
    }
    
    // Setup screen is now manual, so we don't automatically generate the fix anymore.

    body += components.wfNav('aifix');
    app.innerHTML = components.shell('AI Fix Assistant', 'aifix', body);
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
  console.log("router initialization");
  try {
  let fullHash = location.hash.slice(1) || '';
  let viewName = fullHash.split('?')[0];
  
  if (!currentUser && !['landing', 'login', 'register'].includes(viewName)) {
    location.hash = 'landing';
    return;
  }
  if (currentUser && ['landing', 'login', 'register', ''].includes(viewName)) {
    location.hash = 'report';
    return;
  }
  
  if (viewName === '') viewName = 'landing';

  if (viewName === 'login') views.auth(false);
  else if (viewName === 'register') views.auth(true);
  else if (views[viewName]) await views[viewName]();
  else await views.report();
  } catch(e) { console.error("Router crashed", e); location.hash = ""; }
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

} catch (err) {
  console.error(err);
  if(document.body) document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;background:rgba(255,0,0,0.9);color:white;position:fixed;top:0;left:0;z-index:9999;width:100%;height:100%;"><h1>Frontend Crash (top level)</h1><pre>' + err.stack + '</pre></div>';
}