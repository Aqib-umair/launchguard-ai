const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// The `router` end replacement
appJs = appJs.replace(
  /else await views\.report\(\);\r?\n\};/,
  'else await views.report();\n  } catch(e) { console.error("Router crashed", e); location.hash = ""; }\n};'
);

appJs = appJs.replace(
  'const router = async () => {',
  'const router = async () => {\n  console.log("router initialization");\n  try {'
);

appJs = appJs.replace(
  'landing: () => {',
  'landing: () => { console.log("renderLandingPage()");'
);

appJs = appJs.replace(
  'report: async () => {',
  'report: async () => { console.log("renderDashboard()");'
);

appJs = appJs.replace(
  'report: () => {',
  'report: () => { console.log("renderDashboard()");'
);

appJs = appJs.replace(
  "get: async (path) => (await fetch(path)).json(),",
  "get: async (path) => { try { return await (await fetch(path)).json(); } catch(e) { console.error('fetch failed', e); return {}; } },"
);
appJs = appJs.replace(
  "post: async (path, body) => (await fetch(path, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) })).json()",
  "post: async (path, body) => { try { return await (await fetch(path, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) })).json(); } catch(e) { console.error('fetch failed', e); return {}; } }"
);

appJs = appJs.replace(
  "const app = document.querySelector('#app');",
  "let app = document.querySelector('#app');\nif (!app) {\n  app = document.createElement('div');\n  app.id = 'app';\n  if(document.body) document.body.appendChild(app);\n}"
);

const prefix = [
  "window.onerror = function(msg, url, line, col, err) {",
  "  console.error('Global window error:', msg, err);",
  "  if(document.body) document.body.innerHTML += '<div style=\"padding:40px;font-family:sans-serif;background:rgba(255,0,0,0.9);color:white;position:fixed;top:0;left:0;z-index:9999;width:100%;height:100%;\"><h1>Frontend Crash (onerror)</h1><pre>' + (err ? err.stack : msg) + '</pre></div>';",
  "};",
  "window.onunhandledrejection = function(e) {",
  "  console.error('Unhandled promise rejection:', e.reason);",
  "  if(document.body) document.body.innerHTML += '<div style=\"padding:40px;font-family:sans-serif;background:rgba(255,0,0,0.9);color:white;position:fixed;top:0;left:0;z-index:9999;width:100%;height:100%;\"><h1>Frontend Crash (onunhandledrejection)</h1><pre>' + (e.reason ? e.reason.stack : e.reason) + '</pre></div>';",
  "};",
  "",
  "console.log('app.js loaded');",
  "document.addEventListener('DOMContentLoaded', () => { console.log('DOMContentLoaded'); });",
  "",
  "try {"
].join('\n');

const suffix = [
  "} catch (err) {",
  "  console.error(err);",
  "  if(document.body) document.body.innerHTML = '<div style=\"padding:40px;font-family:sans-serif;background:rgba(255,0,0,0.9);color:white;position:fixed;top:0;left:0;z-index:9999;width:100%;height:100%;\"><h1>Frontend Crash (top level)</h1><pre>' + err.stack + '</pre></div>';",
  "}"
].join('\n');

fs.writeFileSync('app_instrumented.js', prefix + '\n' + appJs + '\n' + suffix);
console.log("Wrote app_instrumented.js");
