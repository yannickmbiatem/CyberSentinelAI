const API = import.meta.env.VITE_BACKEND_URL || '/api';

export async function chat(message, history = [], context = '') {
  const res = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, context }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function scanNetwork(target, ports = '1-1024') {
  const res = await fetch(`${API}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, ports }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getCVEs(days = 7, keyword = '') {
  const params = new URLSearchParams({ days, keyword });
  const res = await fetch(`${API}/cves?${params}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getDashboard() {
  const res = await fetch(`${API}/dashboard`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function simulateAttack(target, mode = 'red') {
  const res = await fetch(`${API}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_description: target, mode }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fuseReports(nmapData = '', niktoData = '', wifiData = '', targetName = 'Unknown Target') {
  const res = await fetch(`${API}/reports/fuse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nmap_data: nmapData,
      nikto_data: niktoData,
      wifi_data: wifiData,
      target_name: targetName,
    }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function generatePDF(vulnerabilities, target, analyst = 'CyberSentinel AI') {
  const res = await fetch(`${API}/reports/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vulnerabilities, target, analyst }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `remediation_playbook_${target}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
export async function getAuditLog(limit = 50) {
  const res = await fetch(`${API}/audit?limit=${limit}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getScanHistory(limit = 20) {
  const res = await fetch(`${API}/scans/history?limit=${limit}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function classifyTarget(target) {
  const res = await fetch(`${API}/policy/classify?target=${encodeURIComponent(target)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Nikto Web Scanner API ─────────────────────────────────────────────────────
export async function scanWeb(target, port = 80, ssl = false, tuning = '1234689', maxtime = '2m') {
  const res = await fetch(`${API}/nikto/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, port, ssl, tuning, maxtime }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export async function getNiktoStatus(jobId) {
  const res = await fetch(`${API}/nikto/status/${jobId}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function analyzeNikto(jobId) {
  const res = await fetch(`${API}/nikto/analyze?job_id=${encodeURIComponent(jobId)}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getWebScanHistory(limit = 20) {
  const res = await fetch(`${API}/nikto/history?limit=${limit}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getNiktoInfo() {
  const res = await fetch(`${API}/nikto/info`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
