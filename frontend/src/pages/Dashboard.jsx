import { useState, useEffect, useRef } from 'react';
import { Shield, AlertTriangle, TrendingUp, Bug, ExternalLink, Zap, MessageSquare, Radar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCVEs, getDashboard } from '../api';

// Animated SVG ring for security score
function ScoreRing({ score }) {
  const [displayed, setDisplayed] = useState(0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayed / 100) * circumference;

  useEffect(() => {
    let start = null;
    const duration = 1200;
    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setDisplayed(Math.round(progress * score));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [score]);

  const color = score >= 70 ? 'var(--accent-green)' : score >= 40 ? 'var(--accent-orange)' : 'var(--accent-red)';

  return (
    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.05s linear', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{displayed}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>/100</div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const cls = severity === 'CRITICAL' ? 'badge-critical' : severity === 'HIGH' ? 'badge-high' : severity === 'MEDIUM' ? 'badge-medium' : severity === 'LOW' ? 'badge-low' : 'badge-unknown';
  return <span className={`badge ${cls}`}>{severity}</span>;
}

export default function Dashboard() {
  const [cves, setCves] = useState([]);
  const [filteredCves, setFilteredCves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [dash, setDash] = useState(null);
  const [cveSource, setCveSource] = useState('live');
  const navigate = useNavigate();

  useEffect(() => {
    // Real dashboard data: score, risk, CVE count (one resilient call).
    getDashboard().then(setDash).catch(() => setDash(null));

    // Detailed CVE feed list (envelope: {cves, source, ...}).
    getCVEs(7).then(data => {
      setCves(data.cves || []);
      setCveSource(data.source || 'live');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (filter === 'ALL') setFilteredCves(cves);
    else setFilteredCves(cves.filter(c => c.severity === filter));
  }, [cves, filter]);

  const criticalCount = cves.filter(c => c.severity === 'CRITICAL').length;
  const highCount = cves.filter(c => c.severity === 'HIGH').length;

  const score = dash?.score ?? null;
  const riskLevel = dash?.risk_level ?? 'N/A';

  const filters = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  const sourceLabel = cveSource === 'live' ? null
    : cveSource === 'cached' ? 'Cached (offline)'
    : cveSource === 'sample' ? 'Sample data (NVD unreachable)'
    : 'NVD unreachable';

  return (
    <div style={{ padding: '0 0 32px' }} className="animate-fade-up">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <Shield size={22} color="var(--accent)" />
          Security Dashboard
        </div>
        <div className="page-subtitle">Real-time overview of your security posture</div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1200 }}>

        {/* Top stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>

          {/* Score ring card */}
          <div className="glass-card" style={{ padding: '24px 20px', textAlign: 'center', gridRow: 'span 1' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              Security Score
            </div>
            {score == null ? (
              <div style={{ padding: '12px 0' }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-muted)' }}>N/A</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '10px 0 14px', lineHeight: 1.5 }}>
                  No scan yet.<br />Run your first scan to get a real score.
                </div>
                <button onClick={() => navigate('/scanner')} className="btn-ghost" style={{ fontSize: 13 }}>
                  <Radar size={14} /> Run Scan
                </button>
              </div>
            ) : (
              <>
                <ScoreRing score={score} />
                <div style={{ marginTop: 12, fontSize: 13, color: score >= 70 ? 'var(--accent-green)' : score >= 40 ? 'var(--accent-orange)' : 'var(--accent-red)', fontWeight: 600 }}>
                  {score >= 70 ? 'Good' : score >= 40 ? 'Moderate' : 'Critical'}
                </div>
                {dash?.latest_scan_summary && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    {dash.latest_scan_summary.target} · {dash.latest_scan_summary.open_ports} open ports
                  </div>
                )}
              </>
            )}
          </div>

          {/* CVE count */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-red-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bug size={16} color="var(--accent-red)" />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CVEs (7d)</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-red)', lineHeight: 1 }}>{loading ? '—' : cves.length}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <span className="badge badge-critical">{criticalCount} Critical</span>
              <span className="badge badge-high">{highCount} High</span>
            </div>
          </div>

          {/* Risk level */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={16} color="var(--accent-orange)" />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Level</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: riskLevel === 'Critical' || riskLevel === 'High' ? 'var(--accent-red)' : riskLevel === 'Medium' ? 'var(--accent-orange)' : riskLevel === 'Low' ? 'var(--accent-green)' : 'var(--text-muted)' }}>{riskLevel}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>{score == null ? 'Run a scan first' : 'From latest scan'}</div>
          </div>

          {/* Quick actions */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
              Quick Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Run Scan', icon: Radar, path: '/scanner', color: 'var(--accent)' },
                { label: 'AI Chat', icon: MessageSquare, path: '/chat', color: 'var(--accent-green)' },
                { label: 'Simulate Attack', icon: Zap, path: '/simulator', color: 'var(--accent-red)' },
              ].map(({ label, icon: Icon, path, color }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'transparent', cursor: 'pointer', color,
                    fontSize: 13, fontWeight: 600, transition: 'all 0.2s', textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = color}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CVE Live Feed */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="var(--accent-red)" />
              Live CVE Feed
              {!loading && !sourceLabel && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>• Last 7 days from NVD</span>}
              {!loading && sourceLabel && (
                <span className="badge badge-medium" style={{ marginLeft: 2 }}>{sourceLabel}</span>
              )}
            </h3>
            <button onClick={() => navigate('/cve-feed')} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
              View All →
            </button>
          </div>

          {/* Severity filter tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
                  borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
                  background: filter === f ? 'var(--accent-dim)' : 'transparent',
                  color: filter === f ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />
              ))}
            </div>
          ) : filteredCves.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No CVEs found for this filter.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredCves.slice(0, 8).map((cve, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '12px 14px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--bg-primary)',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <code style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{cve.id}</code>
                      <SeverityBadge severity={cve.severity} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{cve.published}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {cve.description}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: Number(cve.score) >= 9 ? 'var(--accent-red)' : Number(cve.score) >= 7 ? 'var(--accent-orange)' : 'var(--text-secondary)' }}>
                      {cve.score}
                    </span>
                    <a href={cve.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                      <ExternalLink size={10} /> NVD
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
