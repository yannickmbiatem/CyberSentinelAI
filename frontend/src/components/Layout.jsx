import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Shield, MessageSquare, Radar, FileText, Swords, Rss, Circle } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: Shield, label: 'Dashboard' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { to: '/scanner', icon: Radar, label: 'Scanner' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/simulator', icon: Swords, label: 'Simulator' },
  { to: '/cve-feed', icon: Rss, label: 'CVE Feed' },
];

export default function Layout() {
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'

  useEffect(() => {
    async function checkHealth() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch('/api/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        setBackendStatus(res.ok ? 'online' : 'offline');
      } catch {
        clearTimeout(timeoutId);
        setBackendStatus('offline');
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = backendStatus === 'online' ? 'var(--accent-green)' : backendStatus === 'offline' ? 'var(--accent-red)' : 'var(--accent-orange)';
  const statusLabel = backendStatus === 'online' ? 'Backend Online' : backendStatus === 'offline' ? 'Backend Offline' : 'Connecting...';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--accent-dim)',
              border: '1px solid var(--border-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px var(--accent-glow)',
            }}>
              <Shield size={20} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
                CyberSentinel
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                AI Platform
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 10px 10px' }}>
            Navigation
          </div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                textDecoration: 'none', fontSize: 14, fontWeight: 500,
                transition: 'all 0.2s',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                boxShadow: isActive ? 'inset 0 0 20px var(--accent-dim)' : 'none',
              })}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <Circle
              size={8}
              fill={statusColor}
              color={statusColor}
              style={{ flexShrink: 0, filter: backendStatus === 'online' ? 'drop-shadow(0 0 4px var(--accent-green))' : 'none' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{statusLabel}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Powered by Groq AI • v1.0.0
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
        <Outlet />
      </main>
    </div>
  );
}
