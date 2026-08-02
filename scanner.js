import { supabase } from './lib/supabase.js';
import { randomUUID } from 'crypto';

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
    await logTerminal("Initializing scan (MOCK MODE)", 5);
    
    // Fake delay
    await new Promise(r => setTimeout(r, 2000));
    await logTerminal("Skipping Playwright and AI in Recovery Mode", 50, true);
    
    // Fake results
    await logTerminal("Saving placeholder results to Supabase", 95);
    
    const issId = `BUG-LG-${new Date().getFullYear()}-${randomUUID().split('-')[0].toUpperCase()}`;
    await supabase.from('issues').insert([{
      id: issId, scan_id: scanId, title: 'Placeholder Issue', status: 'OPEN', severity: 'Medium',
      area: 'General', root_cause: 'Placeholder for recovery mode', patch: '',
      affected_url: deployUrl || '', affected_component: 'App',
      before_code: '', after_code: '',
      screenshot_url: '', console_error: '',
      network_error: '', stack_trace: '', confidence: 100
    }]);

    await supabase.from('scans').update({ 
      status: 'completed', 
      score: 100, 
      api_failures: 0, 
      error_message: null 
    }).eq('id', scanId);
    
    await supabase.from('ai_reports').insert([{ 
      scan_id: scanId, 
      summary_json: { message: "AI disabled in recovery mode." } 
    }]);
    
    await logTerminal("Completed (MOCK MODE)", 100);
  } catch (error) {
    console.error("Scan Error:", error);
    let errorMsg = error.message || 'Pipeline crashed.';
    await supabase.from('scans').update({ status: 'failed', error_message: errorMsg }).eq('id', scanId);
    await logTerminal(`Error: ${errorMsg}`, 100, true);
  }
}
