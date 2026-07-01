import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Globe, Play, Square, AlertTriangle, Download, Shield, Lock,
  ChevronDown, Info, Clock, BarChart2, RefreshCw, Wifi, Database,
  CheckCircle, XCircle, AlertCircle, Zap, Search, FileText
} from 'lucide-react';
import { scanWeb, getNiktoStatus, analyzeNikto, getWebScanHistory, getNiktoInfo, classifyTarget } from '../api';
import MarkdownRenderer from '../components/MarkdownRenderer';

// ── Constants ──────────────────────────────────────────────────────────────────
const DEMO_TARGETS = [
  { label: 'testphp.vulnweb.com', value: 'http://testphp.vulnweb.com', port: 80, ssl: false },
  { label: 'testhtml5.vulnweb.com', value: 'http://testhtml5.vulnweb.com', port: 80, ssl: false },
  { label: 'demo.testfire.net', value: 'http://demo.testfire.net', port: 80, ssl: false },
  { label: 'localhost', value: 'http://localhost', port: 80, ssl: false },
];

const SCAN_INTENSITIES = [
  { id: 'quick', label: '⚡ Quick', maxtime: '30s', desc: '30-second sweep', color: 'var(--accent-green)' },
  { id: 'standard', label: '🔍 Standard', maxtime: '2m', desc: '2-minute scan', color: 'var(--accent)' },
  { id: 'deep', label: '🔬 Deep', maxtime: '5m', desc: '5-minute full scan', color: 'var(--accent-orange)' },
];

const TUNING_OPTIONS = [
  { key: '1', label: 'Interesting Files', desc: 'Log files, backups, config files', icon: '📁', defaultOn: true },
  { key: '2', label: 'Misconfiguration', desc: 'Server config issues, wrong settings', icon: '⚙️', defaultOn: true },
  { key: '3', label: 'Info Disclosure', desc: 'Version banners, debug info', icon: '📢', defaultOn: true },
  { key: '4', label: 'Injection', desc: 'Generic injection tests', icon: '💉', defaultOn: true },
  { key: '6', label: 'XSS / Denial', desc: 'Cross-site scripting probes', icon: '🎯', defaultOn: true },
  { key: '8', label: 'Command Exec', desc: 'Remote command execution', icon: '💻', defaultOn: false },
  { key: '9', label: 'SQL Injection', desc: 'SQL injection probes', icon: '🗄️', defaultOn: true },
];

const SEVERITY_CONFIG = {
  CRITICAL: { color: 'var(--accent-red)', bg: 'rgba(255,45,85,0.12)', border: 'rgba(255,45,85,0.3)', icon: '🔴', badge: 'badge-critical' },
  HIGH:     { color: 'var(--accent-orange)', bg: 'rgba(255,149,0,0.12)', border: 'rgba(255,149,0,0.3)', icon: '🟠', badge: 'badge-high' },
  MEDIUM:   { color: '#ffd60a', bg: 'rgba(255,214,10,0.12)', border: 'rgba(255,214,10,0.3)', icon: '🟡', badge: 'badge-medium' },
  LOW:      { color: 'var(--accent-green)', bg: 'rgba(0,255,148,0.08)', border: 'rgba(0,255,148,0.2)', icon: '🟢', badge: 'badge-low' },
  INFO:     { color: 'var(--accent)', bg: 'rgba(0,229,255,0.08)', border: 'rgba(0,229,255,0.2)', icon: '🔵', badge: 'badge-info' },
};

// ── Helper components ──────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFO;
  return (
    <span className={`badge ${cfg.badge}`} style={{ fontSize: 10 }}>
      {cfg.icon} {severity}
    </span>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 18px', flex: '1 1 100px',
      transition: 'border-color 0.2s',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
        {value ?? '—'}
      </div>
    </div>
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
  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  return (
    <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
      {m > 0 ? `${m}m ` : ''}{s}s elapsed
    </span>
  );
}

function ClassificationBadge({ kind }) {
  if (!kind) return null;
  const configs = {
    loopback:          { label: 'Loopback', color: 'var(--accent-green)', icon: '🔁', bg: 'var(--accent-green-dim)' },
    private:           { label: 'Private LAN', color: 'var(--accent-green)', icon: '🏠', bg: 'var(--accent-green-dim)' },
    allowlisted_public:{ label: 'Pre-authorized', color: 'var(--accent)', icon: '✅', bg: 'var(--accent-dim)' },
    public:            { label: 'Public', color: 'var(--accent-orange)', icon: '🌐', bg: 'var(--accent-orange-dim)' },
    forbidden:         { label: 'Forbidden', color: 'var(--accent-red)', icon: '🚫', bg: 'var(--accent-red-dim)' },
    invalid:           { label: 'Invalid', color: 'var(--accent-red)', icon: '❌', bg: 'var(--accent-red-dim)' },
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

function ProgressBar({ progress, status }) {
  const color = status === 'error' ? 'var(--accent-red)' : status === 'done' ? 'var(--accent-green)' : 'var(--accent)';
  return (
    <div style={{ background: 'var(--bg-primary)', borderRadius: 100, height: 6, overflow: 'hidden', marginTop: 12 }}>
      <div style={{
        height: '100%', borderRadius: 100,
        width: `${Math.max(5, progress)}%`,
        background: color,
        boxShadow: `0 0 8px ${color}80`,
        transition: 'width 0.5s ease, background 0.3s ease',
        animation: status === 'running' ? 'pulse-glow 1.5s ease-in-out infinite' : 'none',
      }} />
    </div>
  );
}

function FindingRow({ finding, index }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.INFO;

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      background: expanded ? cfg.bg : 'transparent',
      transition: 'background 0.2s',
    }}>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, width: 24, textAlign: 'right', flexShrink: 0 }}>{index + 1}</span>
        <SeverityBadge severity={finding.severity} />
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {finding.description}
        </span>
        {finding.path && finding.path !== '/' && (
          <code style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
            {finding.path}
          </code>
        )}
        {finding.osvdb && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
            {finding.osvdb}
          </span>
        )}
        <ChevronDown size={14} color="var(--text-muted)" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s', flexShrink: 0 }} />
      </div>
      {expanded && (
        <div style={{ padding: '0 16px 16px 52px' }}>
          <div style={{
            background: 'var(--bg-primary)', borderRadius: 10, padding: '14px 16px',
            border: `1px solid ${cfg.border}`, fontSize: 13, lineHeight: 1.7,
          }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Finding</span>
              <p style={{ margin: '4px 0 0', color: 'var(--text-primary)' }}>{finding.description}</p>
            </div>
            {finding.path && finding.path !== '/' && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Affected Path</span>
                <p style={{ margin: '4px 0 0' }}>
                  <code style={{ color: 'var(--accent)', fontSize: 12 }}>{finding.path}</code>
                </p>
              </div>
            )}
            {finding.osvdb && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Reference</span>
                <p style={{ margin: '4px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{finding.osvdb}</p>
              </div>
            )}
            {finding.cve && (
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>CVE</span>
                <p style={{ margin: '4px 0 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--accent-orange)' }}>{finding.cve}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function WebScanner() {
  // Form state
  const [target, setTarget] = useState('http://testphp.vulnweb.com');
  const [port, setPort] = useState(80);
  const [ssl, setSsl] = useState(false);
  const [intensity, setIntensity] = useState(SCAN_INTENSITIES[1]);
  const [tuning, setTuning] = useState(new Set(['1','2','3','4','6','9']));
  const [showIntensityMenu, setShowIntensityMenu] = useState(false);
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Classification
  const [classification, setClassification] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const classifyTimeout = useRef(null);

  // Scan state
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); // full job object
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  // AI analysis
  const [analysis, setAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // Nikto info + history
  const [niktoInfo, setNiktoInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('findings'); // 'findings' | 'analysis' | 'history' | 'raw'

  // ── Auto-detect SSL AND port from URL scheme + explicit port in URL
  useEffect(() => {
    try {
      // Ensure URL is parseable — prepend http:// if missing scheme
      const raw = target.trim();
      const hasScheme = raw.startsWith('http://') || raw.startsWith('https://');
      const urlToParse = hasScheme ? raw : `http://${raw}`;
      const parsed = new URL(urlToParse);

      // SSL detection
      const isHttps = parsed.protocol === 'https:';
      setSsl(isHttps);

      // Port detection — if the URL has an explicit port, use it.
      // Otherwise fall back to the protocol default (443 / 80).
      if (parsed.port) {
        setPort(Number(parsed.port));
      } else {
        setPort(isHttps ? 443 : 80);
      }
    } catch {
      // Malformed URL while typing — leave port/ssl as-is
    }
  }, [target]);

  // ── Auto-classify target
  useEffect(() => {
    if (!target.trim()) { setClassification(null); return; }
    clearTimeout(classifyTimeout.current);
    setClassifying(true);
    classifyTimeout.current = setTimeout(async () => {
      try {
        // Extract hostname for classification
        let hostToClassify = target.trim();
        if (hostToClassify.startsWith('http')) {
          try { hostToClassify = new URL(hostToClassify).hostname; } catch {}
        }
        const data = await classifyTarget(hostToClassify);
        setClassification(data);
      } catch {
        setClassification(null);
      } finally {
        setClassifying(false);
      }
    }, 600);
    return () => clearTimeout(classifyTimeout.current);
  }, [target]);

  // ── Load Nikto info + history on mount
  useEffect(() => {
    getNiktoInfo().then(setNiktoInfo).catch(() => {});
    getWebScanHistory(10).then(d => setHistory(d.history || [])).catch(() => {});
  }, []);

  // ── Polling
  const startPolling = useCallback((jid) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await getNiktoStatus(jid);
        setJobStatus(status);
        if (status.status === 'done' || status.status === 'error') {
          clearInterval(pollRef.current);
          setScanning(false);
          if (status.status === 'done') {
            // Refresh history
            getWebScanHistory(10).then(d => setHistory(d.history || [])).catch(() => {});
          }
        }
      } catch {
        clearInterval(pollRef.current);
        setScanning(false);
      }
    }, 2000);
  }, []);

  useEffect(() => () => clearInterval(pollRef.current), []);

  // ── Start scan
  async function startScan() {
    if (!target.trim()) return;
    setError('');
    setScanning(true);
    setJobId(null);
    setJobStatus(null);
    setAnalysis('');
    setAnalysisError('');
    setActiveTab('findings');

    const tuningStr = Array.from(tuning).sort().join('');

    try {
      const res = await scanWeb(target.trim(), port, ssl, tuningStr, intensity.maxtime);
      setJobId(res.job_id);
      startPolling(res.job_id);
    } catch (err) {
      setError(err.message || 'Failed to start scan');
      setScanning(false);
    }
  }

  // ── Stop scan (kill job client-side by stopping polling)
  function stopScan() {
    clearInterval(pollRef.current);
    setScanning(false);
    setError('Scan stopped by user.');
  }

  // ── Get AI analysis
  async function runAnalysis() {
    if (!jobId || jobStatus?.status !== 'done') return;
    setAnalyzing(true);
    setAnalysisError('');
    setActiveTab('analysis');
    try {
      const res = await analyzeNikto(jobId);
      setAnalysis(res.analysis);
    } catch (err) {
      setAnalysisError(err.message || 'AI analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Export findings as JSON
  function exportJSON() {
    if (!jobStatus?.findings) return;
    const data = { target: jobStatus.target, port: jobStatus.port, ssl: jobStatus.ssl, findings: jobStatus.findings, severity_counts: jobStatus.severity_counts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nikto_${jobStatus.target}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Toggle tuning category
  function toggleTuning(key) {
    setTuning(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Derived
  const findings = jobStatus?.findings || [];
  const severityCounts = jobStatus?.severity_counts || {};
  const isDone = jobStatus?.status === 'done';
  const isRunning = jobStatus?.status === 'running' || jobStatus?.status === 'pending' || scanning;
  const isError = jobStatus?.status === 'error' || (error && !scanning);
  const progress = jobStatus?.progress || 0;
  const canScan = !scanning && target.trim() && classification?.kind !== 'forbidden' && classification?.kind !== 'invalid';

  // ── Filtered findings by severity for display
  const criticalFindings = findings.filter(f => f.severity === 'CRITICAL');
  const highFindings = findings.filter(f => f.severity === 'HIGH');
  const otherFindings = findings.filter(f => !['CRITICAL', 'HIGH'].includes(f.severity));

  return (
    <div style={{ padding: '0 0 60px' }} className="animate-fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <Globe size={22} color="var(--accent)" /> Web Vulnerability Scanner
        </div>
        <div className="page-subtitle">
          Nikto-powered web scan · Detects misconfigurations, XSS, SQLi, outdated software & more
          {niktoInfo && (
            <span style={{ marginLeft: 12, color: niktoInfo.available ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: 12 }}>
              {niktoInfo.available ? `✓ Nikto v${niktoInfo.version} ready` : '⚠ Nikto not found'}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
        {/* ── Scan Configuration Card ── */}
        <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Target input */}
            <div style={{ flex: '1 1 280px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Target URL / IP / Hostname
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  placeholder="http://example.com or 192.168.1.1"
                  className="input-field"
                  style={{ paddingRight: 44 }}
                  onKeyDown={e => e.key === 'Enter' && canScan && startScan()}
                  disabled={scanning}
                />
                {/* Demo targets dropdown */}
                <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
                  <button
                    onClick={() => setShowDemoMenu(v => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}
                    title="Load demo target"
                  >
                    <Search size={16} />
                  </button>
                  {showDemoMenu && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, zIndex: 200, marginTop: 6, width: 240,
                      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
                      overflow: 'hidden', boxShadow: 'var(--shadow-card)',
                    }}>
                      <div style={{ padding: '8px 14px 6px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Authorized Demo Targets
                      </div>
                      {DEMO_TARGETS.map(t => (
                        <button key={t.value} onClick={() => { setTarget(t.value); setPort(t.port); setSsl(t.ssl); setShowDemoMenu(false); }}
                          style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 12 }}>{t.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.value}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Classification */}
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

            {/* Port input */}
            <div style={{ flex: '0 0 90px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Port</label>
              <input
                type="number" value={port}
                onChange={e => setPort(Number(e.target.value))}
                className="input-field"
                style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}
                min={1} max={65535} disabled={scanning}
              />
            </div>

            {/* SSL toggle */}
            <div style={{ flex: '0 0 auto' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>SSL/TLS</label>
              <button
                onClick={() => setSsl(v => !v)}
                disabled={scanning}
                style={{
                  height: 42, paddingLeft: 16, paddingRight: 16, borderRadius: 10, border: '1px solid',
                  borderColor: ssl ? 'var(--accent-green)' : 'var(--border)',
                  background: ssl ? 'var(--accent-green-dim)' : 'var(--bg-primary)',
                  color: ssl ? 'var(--accent-green)' : 'var(--text-muted)',
                  cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                }}
              >
                <Lock size={14} /> {ssl ? 'HTTPS' : 'HTTP'}
              </button>
            </div>

            {/* Intensity dropdown */}
            <div style={{ flex: '0 0 160px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Intensity</label>
              <button
                onClick={() => setShowIntensityMenu(v => !v)}
                disabled={scanning}
                style={{
                  width: '100%', height: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 14px', borderRadius: 10, background: 'var(--bg-primary)',
                  border: '1px solid var(--border)', color: intensity.color, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                }}
              >
                <span>{intensity.label}</span>
                <ChevronDown size={14} color="var(--text-secondary)" />
              </button>
              {showIntensityMenu && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4,
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                  overflow: 'hidden', boxShadow: 'var(--shadow-card)',
                }}>
                  {SCAN_INTENSITIES.map(s => (
                    <button key={s.id} onClick={() => { setIntensity(s); setShowIntensityMenu(false); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent',
                        border: 'none', borderBottom: '1px solid var(--border)',
                        color: intensity.id === s.id ? s.color : 'var(--text-primary)',
                        fontSize: 13, cursor: 'pointer',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontWeight: 700 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!scanning ? (
                <button
                  onClick={startScan}
                  disabled={!canScan}
                  className="btn-primary"
                  id="start-web-scan-btn"
                  style={{ height: 42, paddingLeft: 24, paddingRight: 24 }}
                >
                  <Play size={16} /> Launch Scan
                </button>
              ) : (
                <button
                  onClick={stopScan}
                  className="btn-danger"
                  style={{ height: 42, paddingLeft: 20, paddingRight: 20 }}
                >
                  <Square size={14} /> Stop
                </button>
              )}
              <ElapsedTimer running={scanning} />
            </div>
          </div>

          {/* Advanced options toggle */}
          <button
            onClick={() => setShowAdvanced(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginBottom: showAdvanced ? 16 : 0, padding: 0 }}
          >
            <ChevronDown size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            {showAdvanced ? 'Hide' : 'Show'} Tuning Options
          </button>

          {/* Tuning options */}
          {showAdvanced && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Nikto Test Categories
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TUNING_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => !scanning && toggleTuning(opt.key)}
                    disabled={scanning}
                    title={opt.desc}
                    style={{
                      padding: '7px 14px', borderRadius: 20, border: '1px solid',
                      borderColor: tuning.has(opt.key) ? 'var(--border-accent)' : 'var(--border)',
                      background: tuning.has(opt.key) ? 'var(--accent-dim)' : 'var(--bg-primary)',
                      color: tuning.has(opt.key) ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: scanning ? 'not-allowed' : 'pointer',
                      fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12 }}>
            <AlertTriangle size={12} color="var(--accent-orange)" />
            Only scan systems you own or have explicit written authorization to test. Unauthorized scanning is illegal.
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && !scanning && (
          <div style={{ background: 'var(--accent-red-dim)', border: '1px solid rgba(255,45,85,0.3)', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <XCircle size={16} color="var(--accent-red)" />
            <p style={{ color: 'var(--accent-red)', margin: 0, fontSize: 14 }}>{error}</p>
          </div>
        )}

        {/* ── Live Scan Progress ── */}
        {(scanning || (jobStatus && jobStatus.status !== 'done')) && jobStatus && (
          <div className="glass-card" style={{ padding: 24, marginBottom: 20, borderColor: 'rgba(0,229,255,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
                animation: 'spin-slow 1s linear infinite', flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)', marginBottom: 2 }}>
                  {jobStatus.status === 'pending' ? 'Initializing Nikto…' : `Scanning ${jobStatus.target}…`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {jobStatus.status === 'pending' ? 'Starting scan engine' : `${intensity.label} · Port ${port}${ssl ? ' (SSL)' : ''}`}
                  {jobStatus.finding_count > 0 && ` · ${jobStatus.finding_count} findings so far`}
                </div>
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}>
                {progress}%
              </span>
            </div>
            <ProgressBar progress={progress} status={jobStatus.status} />
            {/* Live output preview */}
            {jobStatus.output_lines?.length > 0 && (
              <div style={{
                marginTop: 14, background: 'var(--bg-primary)', borderRadius: 8, padding: '10px 14px',
                maxHeight: 100, overflow: 'hidden', fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: 'var(--text-muted)', lineHeight: 1.6,
              }}>
                {jobStatus.output_lines.slice(-5).map((l, i) => (
                  <div key={i} style={{ color: l.startsWith('+') ? 'var(--accent-green)' : 'var(--text-muted)' }}>{l}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Results Section ── */}
        {isDone && (
          <>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <StatCard label="Total Findings" value={findings.length} color="var(--text-primary)" icon="📊" />
              <StatCard label="Critical" value={severityCounts.CRITICAL || 0} color="var(--accent-red)" icon="🔴" />
              <StatCard label="High" value={severityCounts.HIGH || 0} color="var(--accent-orange)" icon="🟠" />
              <StatCard label="Medium" value={severityCounts.MEDIUM || 0} color="#ffd60a" icon="🟡" />
              <StatCard label="Low" value={severityCounts.LOW || 0} color="var(--accent-green)" icon="🟢" />
              <StatCard label="Info" value={severityCounts.INFO || 0} color="var(--accent)" icon="🔵" />
            </div>

            {/* Tabs */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                {[
                  { key: 'findings', label: `Findings (${findings.length})`, icon: <AlertCircle size={14} /> },
                  { key: 'analysis', label: 'AI Analysis', icon: <Zap size={14} /> },
                  { key: 'raw', label: 'Raw Output', icon: <FileText size={14} /> },
                  { key: 'history', label: 'History', icon: <Database size={14} /> },
                ].map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '14px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
                      color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                      borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                      fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'color 0.2s',
                    }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                {/* Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 16 }}>
                  <button onClick={exportJSON} className="btn-ghost" style={{ fontSize: 12 }}>
                    <Download size={13} /> Export JSON
                  </button>
                  {!analysis && !analyzing && findings.length > 0 && (
                    <button onClick={runAnalysis} className="btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>
                      <Zap size={13} /> AI Analysis
                    </button>
                  )}
                </div>
              </div>

              {/* ── Findings Tab ── */}
              {activeTab === 'findings' && (
                <div>
                  {findings.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                      <CheckCircle size={40} color="var(--accent-green)" style={{ marginBottom: 12 }} />
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 6 }}>No Vulnerabilities Detected</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nikto found no web vulnerabilities on this target. Great sign!</div>
                    </div>
                  ) : (
                    <>
                      {criticalFindings.length > 0 && (
                        <div>
                          <div style={{ padding: '10px 16px 6px', fontSize: 11, color: 'var(--accent-red)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(255,45,85,0.05)' }}>
                            🔴 Critical ({criticalFindings.length})
                          </div>
                          {criticalFindings.map((f, i) => <FindingRow key={f.id} finding={f} index={i} />)}
                        </div>
                      )}
                      {highFindings.length > 0 && (
                        <div>
                          <div style={{ padding: '10px 16px 6px', fontSize: 11, color: 'var(--accent-orange)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(255,149,0,0.05)' }}>
                            🟠 High ({highFindings.length})
                          </div>
                          {highFindings.map((f, i) => <FindingRow key={f.id} finding={f} index={criticalFindings.length + i} />)}
                        </div>
                      )}
                      {otherFindings.length > 0 && (
                        <div>
                          <div style={{ padding: '10px 16px 6px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(255,255,255,0.02)' }}>
                            Other Findings ({otherFindings.length})
                          </div>
                          {otherFindings.map((f, i) => <FindingRow key={f.id} finding={f} index={criticalFindings.length + highFindings.length + i} />)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── AI Analysis Tab ── */}
              {activeTab === 'analysis' && (
                <div style={{ padding: 24 }}>
                  {analyzing && (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin-slow 1s linear infinite', margin: '0 auto 16px' }} />
                      <div style={{ color: 'var(--accent)', fontWeight: 600 }}>Generating AI Security Analysis…</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Powered by Groq · LLaMA 3.3 70B</div>
                    </div>
                  )}
                  {analysisError && (
                    <div style={{ background: 'var(--accent-red-dim)', borderRadius: 10, padding: 16, color: 'var(--accent-red)', fontSize: 14 }}>
                      {analysisError}
                    </div>
                  )}
                  {analysis && !analyzing && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                        <Zap size={16} color="var(--accent)" />
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>AI Security Assessment</span>
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>Powered by Groq · LLaMA 3.3 70B</span>
                      </div>
                      <MarkdownRenderer content={analysis} />
                    </>
                  )}
                  {!analysis && !analyzing && !analysisError && (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <Zap size={40} color="var(--accent)" style={{ marginBottom: 12, opacity: 0.5 }} />
                      <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
                        Click "AI Analysis" to get a deep-dive assessment of these findings.
                      </div>
                      <button onClick={runAnalysis} className="btn-primary" disabled={findings.length === 0}>
                        <Zap size={16} /> Generate AI Analysis
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Raw Output Tab ── */}
              {activeTab === 'raw' && (
                <div style={{ padding: 20 }}>
                  <pre style={{
                    margin: 0, fontSize: 11, lineHeight: 1.7, color: 'var(--text-secondary)',
                    fontFamily: 'JetBrains Mono, monospace', background: 'var(--bg-primary)',
                    padding: 16, borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all', maxHeight: 600,
                  }}>
                    {jobStatus?.raw_output || 'No raw output available.'}
                  </pre>
                </div>
              )}

              {/* ── History Tab ── */}
              {activeTab === 'history' && (
                <div style={{ padding: 20 }}>
                  {history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
                      No web scan history yet. Run your first scan!
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Target', 'Port', 'Time', 'Findings', 'Critical', 'High', 'Medium'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(row => (
                          <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)', fontSize: 12 }}>{row.target}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{row.port}{row.ssl ? ' 🔒' : ''}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11 }}>{new Date(row.timestamp).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>{row.finding_count}</td>
                            <td style={{ padding: '10px 12px' }}>{row.critical_count > 0 ? <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{row.critical_count}</span> : <span style={{ color: 'var(--text-muted)' }}>0</span>}</td>
                            <td style={{ padding: '10px 12px' }}>{row.high_count > 0 ? <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>{row.high_count}</span> : <span style={{ color: 'var(--text-muted)' }}>0</span>}</td>
                            <td style={{ padding: '10px 12px' }}>{row.medium_count > 0 ? <span style={{ color: '#ffd60a', fontWeight: 700 }}>{row.medium_count}</span> : <span style={{ color: 'var(--text-muted)' }}>0</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Error state from job ── */}
        {jobStatus?.status === 'error' && (
          <div style={{ background: 'var(--accent-red-dim)', border: '1px solid rgba(255,45,85,0.3)', borderRadius: 12, padding: '20px 24px', marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <XCircle size={18} color="var(--accent-red)" />
              <span style={{ fontWeight: 700, color: 'var(--accent-red)', fontSize: 15 }}>Scan Failed</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>{jobStatus.error}</p>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
              Common causes: Nikto/Perl not installed, target unreachable, or scan timed out.
            </div>
          </div>
        )}

        {/* ── Idle state with history sidebar ── */}
        {!scanning && !jobStatus && history.length > 0 && (
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={15} color="var(--accent)" /> Recent Web Scans
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Target', 'Port', 'When', 'Findings', 'Risk'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 5).map(row => {
                  const risk = row.critical_count > 0 ? 'CRITICAL' : row.high_count > 0 ? 'HIGH' : row.medium_count > 0 ? 'MEDIUM' : row.finding_count > 0 ? 'LOW' : 'CLEAN';
                  const riskColor = { CRITICAL: 'var(--accent-red)', HIGH: 'var(--accent-orange)', MEDIUM: '#ffd60a', LOW: 'var(--accent-green)', CLEAN: 'var(--accent-green)' }[risk];
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)', fontSize: 12 }}>
                        {row.ssl ? '🔒 ' : ''}{row.target}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{row.port}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11 }}>{new Date(row.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{row.finding_count}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ color: riskColor, fontWeight: 700, fontSize: 12 }}>{risk}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
