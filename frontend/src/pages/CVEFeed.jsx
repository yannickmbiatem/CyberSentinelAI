import { useState, useCallback } from 'react';
import { Rss, Search, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCVEs } from '../api';

const SEVERITIES = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const PAGE_SIZE = 10;

function SeverityBadge({ severity }) {
  const cls = severity === 'CRITICAL' ? 'badge-critical' : severity === 'HIGH' ? 'badge-high' : severity === 'MEDIUM' ? 'badge-medium' : severity === 'LOW' ? 'badge-low' : 'badge-unknown';
  return <span className={`badge ${cls}`}>{severity || 'UNKNOWN'}</span>;
}

function ScoreMeter({ score }) {
  const s = Number(score) || 0;
  const color = s >= 9 ? 'var(--accent-red)' : s >= 7 ? 'var(--accent-orange)' : s >= 4 ? 'var(--text-secondary)' : 'var(--accent-green)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${(s / 10) * 100}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color }}>{s.toFixed(1)}</span>
    </div>
  );
}

export default function CVEFeed() {
  const [cves, setCves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [days, setDays] = useState(7);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  async function search() {
    setLoading(true);
    setPage(1);
    try {
      const data = await getCVEs(days, keyword);
      setCves(data.cves || []);
      setHasSearched(true);
    } catch (err) {
      setCves([]);
    }
    setLoading(false);
  }

  const filtered = severityFilter === 'ALL' ? cves : cves.filter(c => c.severity === severityFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleKeyDown(e) {
    if (e.key === 'Enter') search();
  }

  const counts = {};
  SEVERITIES.slice(1).forEach(s => { counts[s] = cves.filter(c => c.severity === s).length; });

  return (
    <div style={{ padding: '0 0 40px' }} className="animate-fade-up">
      <div className="page-header">
        <div className="page-title"><Rss size={22} color="var(--accent)" /> CVE Intelligence Feed</div>
        <div className="page-subtitle">Live vulnerability data from NIST NVD — search, filter, and monitor</div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
        {/* Search bar */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search keyword: apache, windows, ssh, log4j..."
                className="input-field"
                style={{ paddingLeft: 36 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Last</span>
              <select
                value={days}
                onChange={e => setDays(Number(e.target.value))}
                className="input-field"
                style={{ width: 90 }}
              >
                {[1, 7, 14, 30].map(d => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <button onClick={search} disabled={loading} className="btn-primary" style={{ flexShrink: 0 }}>
              <Search size={16} /> {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {hasSearched && !loading && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {SEVERITIES.map(s => (
              <button
                key={s}
                onClick={() => { setSeverityFilter(s); setPage(1); }}
                style={{
                  padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
                  borderColor: severityFilter === s ? 'var(--accent)' : 'var(--border)',
                  background: severityFilter === s ? 'var(--accent-dim)' : 'transparent',
                  color: severityFilter === s ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {s} {s !== 'ALL' ? `(${counts[s] || 0})` : `(${cves.length})`}
              </button>
            ))}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />
            ))}
          </div>
        )}

        {/* No results */}
        {hasSearched && !loading && filtered.length === 0 && (
          <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-secondary)' }}>No CVEs found</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Try a different keyword or time range</div>
          </div>
        )}

        {/* Empty state */}
        {!hasSearched && (
          <div className="glass-card" style={{ padding: 64, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>CVE Intelligence Center</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
              Search for recent vulnerabilities from the NIST NVD database. Filter by keyword, time range, and severity level.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
              {['apache', 'windows', 'ssh', 'log4j', 'openssl', 'chrome'].map(kw => (
                <button key={kw} onClick={() => { setKeyword(kw); }} className="btn-ghost" style={{ fontSize: 12 }}>
                  {kw}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CVE Table */}
        {hasSearched && !loading && paginated.length > 0 && (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  {['CVE ID', 'Severity', 'CVSS Score', 'Published', 'Description', 'Link'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((cve, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{cve.id}</code>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <SeverityBadge severity={cve.severity} />
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <ScoreMeter score={cve.score} />
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{cve.published}</td>
                    <td style={{ padding: '12px 16px', maxWidth: 400 }}>
                      <p style={{ margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {cve.description}
                      </p>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <a href={cve.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 12, textDecoration: 'none' }}>
                        <ExternalLink size={12} /> NVD
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost" style={{ padding: '6px 10px' }}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Page <strong style={{ color: 'var(--text-primary)' }}>{page}</strong> of {totalPages}
                  &nbsp;·&nbsp; {filtered.length} CVEs
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-ghost" style={{ padding: '6px 10px' }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
