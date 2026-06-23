const API = '/api';

export async function chat(message, history = []) {
  const res = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
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

export async function generatePDF(vulnerabilities, target) {
  const res = await fetch(`${API}/reports/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vulnerabilities, target }),
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
