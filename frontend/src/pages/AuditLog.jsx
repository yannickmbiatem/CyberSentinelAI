import { useState, useEffect } from 'react';
import { Lock, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getAuditLog } from '../api';

function DecisionBadge({ decision }) {
  const configs = {
    ALLOWED: { cls: 'badge-low', icon: <CheckCircle size={11} />, label: 'Allowed' },
    REFUSED_FORBIDDEN: { cls: 'badge-critical', icon: <XCircle size={11} />, label: 'Refused — Forbidden' },
    REFUSED_RATE_LIMIT: { cls: 'badge-high', icon: <Clock size={11} />, label: 'Refused — Rate Limit' },
    REFUSED_NO_CONSENT: { cls: 'badge-medium', icon: <AlertTriangle size={11} />, label: 'Refused — No Consent' },
  };
  const cfg = configs[decision] || { cls: 'badge-unknown', icon: null, label: decision };
  return (
    <span className={`badge ${cfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function KindBadge({ kind }) {
  const colors = {
    loopback: 'var(--accent-green)',
    private: 'var(--accent-green)',
    allowlisted_public: 'var(--accent)',
    public: 'var(--accent-orange)',
    forbidden: 'var(--accent-red)',
    invalid: 'var(--accent-red)',
  };
  const color = colors[kind] || 'var(--text-muted)';
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color,
      background: `${color}20`, border: `1px solid ${color}40`,
      padding: '2px 8px', borderRadius: 12,
    }}>
      {kind || 'unknown'}
    </span>
  );
}

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');

  async function loadAudit() {
    setLoading(true);
    setError('');
    try {
      const data = await getAuditLog(100);
      setEntries(data.entries || []);
    } catch (err) {
      setError('Could not load audit log. Is the backend running?');
    }
    setLoading(false);
  }

  useEffect(() => { loadAudit(); }, []);

  const decisions = ['ALL', 'ALLOWED', 'REFUSED_FORBIDDEN', 'REFUSED_RATE_LIMIT', 'REFUSED_NO_CONSENT'];
  const filtered = filter === 'ALL' ? entries : entries.filter(e => e.decision === filter);

  const stats = {
    total: entries.length,
    allowed: entries.filter(e => e.decision === 'ALLOWED').length,
    refused: entries.filter(e => e.decision?.startsWith('REFUSED')).length,
  };

  return (
    <div style={{ padding: '0 0 40px' }} className="animate-fade-up">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">
            <Lock size={22} color="var(--accent-orange)" />
            Audit Log
          </div>
          <div className="page-subtitle">
            Every scan decision recorded — ethical control & accountability
          </div>
        </div>
        <button onClick={loadAudit} disabled={loading} className="btn-ghost" style={{ fontSize: 12 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin-slow 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1200 }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Scan Events', value: stats.total, color: 'var(--accent)' },
            { label: 'Scans Allowed', value: stats.allowed, color: 'var(--accent-green)' },
            { label: 'Scans Refused', value: stats.refused, color: 'var(--accent-red)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{loading ? '—' : value}</div>
            </div>
          ))}
        </div>

        {/* Ethical notice */}
        <div style={{
          background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13,
        }}>
          <Lock size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Ethical Control: </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Every scan request is logged here regardless of outcome. This audit trail ensures accountability,
              compliance with Cameroon Law No. 2010/012 (Cybersecurity & Cybercriminality), and ethical use of scanning tools.
            </span>
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--accent-red-dim)', border: '1px solid rgba(255,45,85,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ color: 'var(--accent-red)', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {decisions.map(d => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
                borderColor: filter === d ? 'var(--accent-orange)' : 'var(--border)',
                background: filter === d ? 'rgba(255,152,0,0.1)' : 'transparent',
                color: filter === d ? 'var(--accent-orange)' : 'var(--text-secondary)',
              }}
            >
              {d === 'ALL' ? `All (${entries.length})` : d.replace('REFUSED_', 'Refused — ').replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card" style={{ padding: 64, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No audit entries yet</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Run a scan from the Scanner page and the entries will appear here.
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  {['Timestamp', 'Target', 'Kind', 'Decision', 'Scan Type', 'Client IP'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                      {entry.timestamp?.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: 200 }}>
                      <code style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }}>
                        {entry.target}
                      </code>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <KindBadge kind={entry.target_kind} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <DecisionBadge decision={entry.decision} />
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {entry.scan_type}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                      {entry.client_ip || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
