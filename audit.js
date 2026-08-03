import fetch from 'node-fetch';

async function audit() {
  const base = 'http://localhost:4005';
  console.log("=========================================");
  console.log("      RUNTIME AUDIT REPORT");
  console.log("=========================================\n");

  const endpoints = [
    { method: 'GET', url: '/api/health' }
  ];

  for (const ep of endpoints) {
    console.log(`--- [ ${ep.method} ${ep.url} ] ---`);
    try {
      const opts = { method: ep.method, headers: {} };
      if (ep.body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(ep.body);
      }
      const res = await fetch(base + ep.url, opts);
      const text = await res.text();
      
      console.log(`HTTP Status: ${res.status}`);
      let parsed = null;
      try { parsed = JSON.parse(text); } catch(e) {}
      
      if (parsed) {
        console.log(`Response Body (JSON):`);
        console.log(JSON.stringify(parsed, null, 2));
        if (parsed.error) console.log(`\nExact Exception:\n${parsed.error}`);
        if (parsed.stack) console.log(`\nStack Trace:\n${parsed.stack}`);
      } else {
        console.log(`Response Body (Text):`);
        console.log(text);
      }
    } catch (e) {
      console.log(`Fetch Error: ${e.message}`);
    }
    console.log("\n");
  }
}

// Start server then run audit
import('./server.js').then(async ({ default: app }) => {
  const server = app.listen(4005, async () => {
    await audit();
    server.close();
    process.exit(0);
  });
});
