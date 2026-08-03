import fetch from 'node-fetch'; // Might need to use global fetch if Node 18+

async function safeJson(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await res.json();
  }
  const text = await res.text();
  console.error(`Expected JSON but got ${contentType}. Body:`, text);
  return {};
}
async function runE2ETest(apiKey) {
  const repoUrl = 'https://github.com/expressjs/express';
  console.log('1. Starting scan on', repoUrl);
  
  // Create scan
  let res = await fetch('http://localhost:3000/api/scans/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Express Test', repoUrl, deployUrl: '' })
  });
  const scanData = await safeJson(res);
  console.log('Scan created:', scanData);
  
  // Wait a few seconds for issues to be populated
  console.log('Waiting for scanner to generate issues...');
  await new Promise(r => setTimeout(r, 5000));
  
  // Fetch issues
  res = await fetch('http://localhost:3000/api/issues');
  const issues = await safeJson(res);
  
  const scanIssues = issues.filter(i => i.scan_id === scanData.id);
  if (scanIssues.length === 0) {
    console.error('No issues found for this scan.');
    return;
  }
  
  const testIssue = scanIssues[0];
  console.log('Found issue to fix:', testIssue.title, '(ID:', testIssue.id, ')');
  
  // Run AI Fix
  console.log('2. Requesting AI Fix via OpenRouter...');
  res = await fetch('http://localhost:3000/api/ai/fix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issueId: testIssue.id,
      mode: 'cloud',
      model: 'google/gemini-2.5-flash',
      apiKey: apiKey
    })
  });
  
  if (!res.ok) {
    const errText = await res.text();
    console.error('AI Fix Request Failed:', res.status, errText);
    return;
  }
  
  const fixData = await safeJson(res);
  console.log('\n=============================');
  console.log('AI Fix Request Succeeded!');
  console.log('=============================');
  console.log('Problem Analysis:', JSON.stringify(fixData.problem_analysis, null, 2));
  console.log('\nEngineering Solution:', JSON.stringify(fixData.engineering_solution, null, 2));
  console.log('\nConfidence Score:', fixData.engineering_solution?.confidence_score);
  console.log('=============================');
}

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Please provide an OpenRouter API key as the first argument.');
  process.exit(1);
}

runE2ETest(apiKey).catch(console.error);
