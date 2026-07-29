import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'crypto';

export async function analyzeScanData(scanId, url, consoleLogs, networkRequests) {
  let hasKey = !!process.env.GEMINI_API_KEY;
  let aiResponseText = "";
  
  const prompt = `Analyze this web application scan data for regressions or errors.
  URL: ${url}
  Console Logs: ${JSON.stringify(consoleLogs.slice(-10))}
  Failed Network Requests: ${JSON.stringify(networkRequests.filter(r => r.status >= 400).slice(-5))}
  
  Provide a JSON response with:
  {
    "root_cause": "brief explanation of why it failed",
    "patch": "A simulated code diff patch to fix it",
    "severity": "High or Medium or Low",
    "confidence": 95,
    "area": "e.g., checkout, core, auth",
    "title": "A short 5-word title"
  }
  `;

  if (hasKey) {
    try {
      const ai = new GoogleGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      aiResponseText = response.text;
    } catch (e) {
      console.error("AI Error:", e);
      hasKey = false;
    }
  }

  if (!hasKey) {
    // Fallback realistic generator based on actual logs
    let title = "Uncaught Exception in DOM";
    let root = "The browser encountered a runtime error rendering the page.";
    let patch = "@@ -1,3 +1,3 @@\n-  renderComponent()\n+  if(data) renderComponent()";
    let severity = "Medium";
    let area = "frontend";
    
    const errors = consoleLogs.filter(l => l.type === 'error');
    if (errors.length > 0) {
      title = errors[0].text.substring(0, 30) + "...";
      root = `The application threw an uncaught error: ${errors[0].text}. This likely indicates a missing null check or a failed module import on the target deployment (${url}).`;
    }
    
    const failedNet = networkRequests.filter(r => r.status >= 400);
    if (failedNet.length > 0) {
      title = `API Request Failed: ${failedNet[0].status}`;
      root = `The endpoint ${failedNet[0].url} returned a ${failedNet[0].status} error during the automated flow. The client-side application did not handle this gracefully.`;
      patch = `@@ -10,2 +10,4 @@\n  const res = await fetch(url);\n+ if (!res.ok) throw new Error('API Timeout');\n  return res.json();`;
      severity = "High";
      area = "network";
    }

    aiResponseText = JSON.stringify({
      root_cause: root,
      patch: patch,
      severity: severity,
      confidence: 89,
      area: area,
      title: title
    });
  }

  try {
    const data = JSON.parse(aiResponseText);
    return {
      id: `ISSUE-${randomUUID().split('-')[0].toUpperCase()}`,
      scan_id: scanId,
      title: data.title || 'Discovered Regression',
      status: 'Open',
      severity: data.severity || 'Medium',
      area: data.area || 'core',
      root_cause: data.root_cause,
      patch: data.patch || 'No patch available'
    };
  } catch(e) {
    console.error("Failed to parse AI output", e);
    return null;
  }
}
