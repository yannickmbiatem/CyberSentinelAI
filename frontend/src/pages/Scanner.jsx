import { useState, useRef, useEffect } from 'react';
import { Radar, Play, AlertTriangle, Download, ChevronDown, Shield, Globe, Lock, Info } from 'lucide-react';
import { scanNetwork, classifyTarget } from '../api';
import MarkdownRenderer from '../components/MarkdownRenderer';

const SCAN_PROFILES = [
  { id: 'quick', label: 'Quick Scan', ports: '21,22,23,25,53,80,110,135,443,445,3389,8080,8443', desc: 'Top 13 common ports' },
  { id: 'standard', label: 'Standard Scan', ports: '1-1024', desc: 'Ports 1–1024' },
  { id: 'extended', label: 'Extended Scan', ports: '1-10000', desc: 'Ports 1–10000' },
  { id: 'full', label: 'Full Scan', ports: '1-65535', desc: 'All 65535 ports (slow)' },
];

const PORT_RISK = {
  21: { label: 'FTP', risk: 'HIGH', tip: 'Unencrypted file transfer — use SFTP/SCP instead.' },
  22: { label: 'SSH', risk: 'MEDIUM', tip: 'Secure shell — ensure key-based auth and fail2ban.' },
  23: { label: 'Telnet', risk: 'CRITICAL', tip: 'Transmits credentials in cleartext. Disable immediately.' },
  25: { label: 'SMTP', risk: 'MEDIUM', tip: 'Mail server — ensure STARTTLS and SPF/DKIM records.' },
  80: { label: 'HTTP', risk: 'MEDIUM', tip: 'Unencrypted web — redirect to HTTPS.' },
  110: { label: 'POP3', risk: 'MEDIUM', tip: 'Unencrypted email retrieval — use POP3S on 995.' },
  135: { label: 'RPC', risk: 'HIGH', tip: 'Windows RPC — commonly exploited. Firewall if not needed.' },
  139: { label: 'NetBIOS', risk: 'HIGH', tip: 'Legacy Windows networking — disable if unused.' },
  443: { label: 'HTTPS', risk: 'LOW', tip: 'Secure web — ensure valid certificate and TLS 1.2+.' },
  445: { label: 'SMB', risk: 'CRITICAL', tip: 'EternalBlue / WannaCry vector. Block externally.' },
  1433: { label: 'MSSQL', risk: 'HIGH', tip: 'SQL Server — never expose to internet.' },
  3306: { label: 'MySQL', risk: 'HIGH', tip: 'MySQL — should only accept localhost connections.' },
  3389: { label: 'RDP', risk: 'CRITICAL', tip: 'Remote Desktop — use VPN, not direct exposure.' },
  5432: { label: 'PostgreSQL', risk: 'HIGH', tip: 'PostgreSQL — restrict to localhost or VPN.' },
  6379: { label: 'Redis', risk: 'CRITICAL', tip: 'Redis — often unauthenticated. Never expose publicly.' },
  27017: { label: 'MongoDB', risk: 'HIGH', tip: 'MongoDB — historically exposed with no auth by default.' },
  8080: { label: 'HTTP-Alt', risk: 'MEDIUM', tip: 'Alternate HTTP port — check for admin panels.' },
  8443: { label: 'HTTPS-Alt', risk: 'LOW', tip: 'Alternate HTTPS port — check for web apps.' },
};

function RiskBadge({ port }) {
  const info = PORT_RISK[Number(port)];
  if (!info) return null;
  const riskClass = info.risk === 'CRITICAL' ? 'badge-critical' : info.risk === 'HIGH' ? 'badge-high' : info.risk === 'MEDIUM' ? 'badge-medium' : 'badge-low';
  return (
    <span
      className={`badge ${riskClass}`}
      title={info.tip}
      style={{ cursor: 'help' }}
    >
      {info.risk}
    </span>
  );
}

function ElapsedTimer({ running }) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (running) {
      setElapsed(0);
      ref.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      clearInterval(ref.current);
    }
    return () => clearInterval(ref.current);
  }, [running]);
  if (!running) return null;
  return <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{elapsed}s elapsed</span>;
}

function ClassificationBadge({ kind }) {
  if (!kind) return null;
  const configs = {
    loopback: { label: 'Loopback', color: 'var(--accent-green)', icon: '🔁', bg: 'var(--accent-green-dim)' },
    private: { label: 'Private LAN', color: 'var(--accent-green)', icon: '🏠', bg: 'var(--accent-green-dim)' },
    allowlisted_public: { label: 'Pre-authorized Demo', color: 'var(--accent)', icon: '✅', bg: 'var(--accent-dim)' },
    public: { label: 'Public IP', color: 'var(--accent-orange)', icon: '🌐', bg: 'var(--accent-orange-dim)' },
    forbidden: { label: 'Forbidden', color: 'var(--accent-red)', icon: '🚫', bg: 'var(--accent-red-dim)' },
    invalid: { label: 'Invalid', color: 'var(--accent-red)', icon: '❌', bg: 'var(--accent-red-dim)' },
  };
  const cfg = configs[kind] || { label: kind, color: 'var(--text-muted)', icon: '?', bg: 'transparent' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40`,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export default function Scanner() {
  const [target, setTarget] = useState('127.0.0.1');
  const [profile, setProfile] = useState(SCAN_PROFILES[0]);
  const [showProfiles, setShowProfiles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [classification, setClassification] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState('');
  const classifyTimeout = useRef(null);

  // Auto-classify target as user types (debounced 600ms)
  useEffect(() => {
    if (!target.trim()) { setClassification(null); return; }
    clearTimeout(classifyTimeout.current);
    setClassifying(true);
    classifyTimeout.current = setTimeout(async () => {
      try {
        const data = await classifyTarget(target.trim());
        setClassification(data);
      } catch {
        setClassification(null);
      } finally {
        setClassifying(false);
      }
    }, 600);
    return () => clearTimeout(classifyTimeout.current);
  }, [target]);

  async function runScan() {
    setLoading(true);
    setResults(null);
    setAnalysis('');
    setError('');
    try {
      const data = await scanNetwork(target, profile.ports);
      setResults(data.results);
      setAnalysis(data.ai_analysis);
    } catch (err) {
      const msg = err.message || 'Scan failed';
      // Try to extract backend error detail
      if (msg.includes('403')) {
        setError('⛔ Scan refused by policy: this target is classified as forbidden (cloud metadata, broadcast, or reserved range).');
      } else if (msg.includes('429')) {
        setError('⏱ Rate limit exceeded. You can run a maximum of 5 scans per minute. Please wait and try again.');
      } else {
        setError(`Scan error: ${msg}`);
      }
    }
    setLoading(false);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `scan_${target}_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  const allPorts = results?.hosts?.flatMap(h => h.protocols?.flatMap(p => p.ports || []) || []) || [];
  const webVulns = results?.web_vulnerabilities;
  const engineUsed = results?.engine;
  const targetClassification = results?.target_classification;

  return (
    <div style={{ padding: '0 0 40px' }} className="animate-fade-up">
      <div className="page-header">
        <div className="page-title"><Radar size={22} color="var(--accent)" /> Network Scanner</div>
        <div className="page-subtitle">Nmap-powered live scan with AI analysis · Only scan networks you own</div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
        {/* Scan config */}
        <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {/* Target IP */}
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Target (IP or Hostname)
              </label>
              <input
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="example.com or 192.168.1.1"
                className="input-field"
                onKeyDown={e => e.key === 'Enter' && runScan()}
              />
              {/* Real-time classification indicator */}
              <div style={{ marginTop: 6, height: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                {classifying && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Classifying…</span>}
                {!classifying && classification && (
                  <>
                    <ClassificationBadge kind={classification.kind} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{classification.reason}</span>
                  </>
                )}
              </div>
            </div>

            {/* Scan profile dropdown */}
            <div style={{ flex: '1 1 180px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scan Profile</label>
              <button
                onClick={() => setShowProfiles(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10, background: 'var(--bg-primary)',
                  border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer',
                }}
              >
                <span>{profile.label}</span>
                <ChevronDown size={15} color="var(--text-secondary)" />
              </button>
              {showProfiles && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4,
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                  overflow: 'hidden', boxShadow: 'var(--shadow-card)',
                }}>
                  {SCAN_PROFILES.map(p => (
                    <button key={p.id} onClick={() => { setProfile(p); setShowProfiles(false); }} style={{
                      width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent',
                      border: 'none', color: profile.id === p.id ? 'var(--accent)' : 'var(--text-primary)',
                      fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 600 }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={runScan}
              disabled={loading || !target || classification?.kind === 'forbidden' || classification?.kind === 'invalid'}
              className="btn-primary"
              style={{ height: 42, paddingLeft: 24, paddingRight: 24 }}
            >
              <Play size={16} /> {loading ? 'Scanning...' : 'Launch Scan'}
            </button>

            <ElapsedTimer running={loading} />
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12 }}>
            <AlertTriangle size={12} color="var(--accent-orange)" />
            Only scan systems you own or have explicit written authorization to test. Unauthorized scanning is illegal.
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ background: 'var(--accent-red-dim)', border: '1px solid rgba(255,45,85,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ color: 'var(--accent-red)', margin: 0, fontSize: 14 }}>{error}</p>
          </div>
        )}

        {/* Scanning animation */}
        {loading && (
          <div className="glass-card" style={{ padding: 32, textAlign: 'center', marginBottom: 20 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', margin: '0 auto 16px', animation: 'spin-slow 1s linear infinite' }} />
            <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 16 }}>Scanning {target}…</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Running {profile.label} · Nmap + optional Nikto web scan</div>
          </div>
        )}

        {/* Scan error from backend */}
        {results?.error && (
          <div style={{ background: 'var(--accent-red-dim)', border: '1px solid rgba(255,45,85,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ color: 'var(--accent-red)', margin: 0 }}>{results.error}</p>
          </div>
        )}

        {/* Scan Results Table */}
        {results && !results.error && results.hosts?.length > 0 && (
          <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>
                  Scan Results — {results.hosts.length} host(s)
                </h3>
                {engineUsed && (
                  <span style={{
                    padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: engineUsed === 'nmap' ? 'var(--accent-dim)' : 'var(--accent-orange-dim)',
                    color: engineUsed === 'nmap' ? 'var(--accent)' : 'var(--accent-orange)',
                    border: `1px solid ${engineUsed === 'nmap' ? 'var(--border-accent)' : 'rgba(255,152,0,0.3)'}`,
                  }}>
                    {engineUsed === 'nmap' ? '⚡ Nmap' : '🔌 Socket fallback'}
                  </span>
                )}
                {targetClassification && <ClassificationBadge kind={targetClassification} />}
              </div>
              <button onClick={exportJSON} className="btn-ghost" style={{ fontSize: 12 }}>
                <Download size={13} /> Export JSON
              </button>
            </div>

            {results.hosts.map((host, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <code style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{host.address}</code>
                  {host.hostname && host.hostname !== 'N/A' && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({host.hostname})</span>}
                  {host.os_guess && <span className="badge badge-info">{host.os_guess}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: allPorts.length > 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    {allPorts.length} open port(s)
                  </span>
                </div>
                {host.protocols.map((proto, j) => (
                  <div key={j} style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Port', 'Protocol', 'State', 'Service', 'Version', 'Risk'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {proto.ports.map((p, k) => (
                          <tr key={k} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--accent)' }}>{p.port}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{proto.protocol}</td>
                            <td style={{ padding: '10px 12px' }}><span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{p.state}</span></td>
                            <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.service}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{p.product} {p.version}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <RiskBadge port={p.port} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Nikto web vulnerability section */}
        {webVulns && webVulns !== 'No specific web vulnerabilities found by Nikto (or server not responding).' && (
          <div className="glass-card" style={{ padding: 24, marginBottom: 20, borderColor: 'rgba(255,152,0,0.3)' }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: 8 }}>
              🌐 Nikto Web Vulnerability Scan
              <span className="badge badge-high" style={{ marginLeft: 4 }}>Web Scan</span>
            </h3>
            <pre style={{
              margin: 0, fontSize: 12, lineHeight: 1.7,
              color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace',
              background: 'var(--bg-primary)', padding: 16, borderRadius: 8,
              overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {webVulns}
            </pre>
          </div>
        )}

        {/* No hosts found */}
        {results && !results.error && results.hosts?.length === 0 && (
          <div className="glass-card" style={{ padding: 32, textAlign: 'center', marginBottom: 20 }}>
            <Shield size={40} color="var(--accent-green)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 6 }}>No Open Ports Found</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              The target responded but no open ports were detected in the scanned range.
            </div>
          </div>
        )}

        {/* AI Analysis */}
        {analysis && (
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
              🤖 AI Security Analysis
            </h3>
            <MarkdownRenderer content={analysis} />
          </div>
        )}
      </div>
    </div>
  );
}
