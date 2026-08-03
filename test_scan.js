import fetch from 'node-fetch';

async function safeJson(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return await res.json();
  const text = await res.text();
  return {};
}

async function testScan() {
  const repoUrl = 'https://github.com/expressjs/express';
  console.log('1. Starting scan on', repoUrl);
  
  let res = await fetch('http://localhost:3000/api/scans/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Express Test', repoUrl, deployUrl: '' })
  });
  const scanData = await safeJson(res);
  console.log('Scan created:', scanData);
  
  if (!scanData.id) {
    console.error("Failed to start scan");
    return;
  }
  
  let status = 'queued';
  while(status === 'queued' || status === 'running') {
     console.log(`Polling status for ${scanData.id}...`);
     await new Promise(r => setTimeout(r, 2000));
     
     const sRes = await fetch(`http://localhost:3000/api/scans/${scanData.id}`);
     const sData = await safeJson(sRes);
     if (sData.status) {
         status = sData.status;
         console.log(`Current Status: ${status}`);
     } else {
         console.log('No status from server (possibly missing db), assuming running.');
     }
     
     // Also fetch logs to show what's happening
     const lRes = await fetch(`http://localhost:3000/api/scan_logs?scanId=${scanData.id}`);
     const logs = await safeJson(lRes);
     if (Array.isArray(logs) && logs.length > 0) {
         console.log(`-- Log count: ${logs.length}. Latest: ${logs[logs.length-1].message}`);
     }
  }
  
  console.log('Scan finished with status:', status);
}

testScan().catch(console.error);
