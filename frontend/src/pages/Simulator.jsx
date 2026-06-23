import { useState } from 'react';
import { Swords, Shield, Skull, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { simulateAttack } from '../api';
import CopyButton from '../components/CopyButton';

// Parse the AI text into phases
function parsePhases(text) {
  const phaseRegex = /##\s+(?:Phase|Step)\s+\d+[:\s]+(.+?)(?=\n##\s+(?:Phase|Step)|$)/gis;
  const phases = [];
  let match;
  while ((match = phaseRegex.exec(text)) !== null) {
    const title = match[1].split('\n')[0].trim();
    const content = match[0].replace(/##\s+(?:Phase|Step)\s+\d+[:\s]+[^\n]+\n/, '').trim();
    phases.push({ title, content });
  }
  return phases.length >= 2 ? phases : null;
}

// Icons per red team phase
const RED_ICONS = ['🔍', '📡', '⚠️', '💥', '🏴'];
const BLUE_ICONS = ['🔒', '📊', '🚨', '🛡️', '♻️'];

function PhaseCard({ title, content, index, isRed, expanded, onToggle }) {
  const icons = isRed ? RED_ICONS : BLUE_ICONS;
  const icon = icons[index] || (isRed ? '🔴' : '🔵');
  const accentColor = isRed ? 'var(--accent-red)' : 'var(--accent)';
  const dimColor = isRed ? 'var(--accent-red-dim)' : 'var(--accent-dim)';

  // Extract commands (lines starting with $ or contain nmap/sudo/etc.)
  const commands = content.match(/`[^`]+`|(?:(?:nmap|sudo|hashcat|aircrack|metasploit|msfconsole|python|curl|wget)[^\n]*)/g) || [];

  return (
    <div
      className="glass-card"
      style={{ marginBottom: 10, overflow: 'hidden', borderColor: expanded ? accentColor : 'var(--border)', transition: 'all 0.2s' }}
    >
      {/* Phase header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: dimColor, border: `1px solid ${accentColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {isRed ? 'Phase' : 'Step'} {index + 1}
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{title}</div>
        </div>
        {expanded ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
      </button>

      {/* Phase content */}
      {expanded && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${accentColor}30` }}>
          <div style={{ paddingTop: 14, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Simulator() {
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState('red');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState({});

  async function run() {
    if (!target.trim()) return;
    setLoading(true);
    setResult(null);
    setExpandedPhases({});
    try {
      const data = await simulateAttack(target, mode);
      setResult(data);
      // Auto-expand first phase
      setExpandedPhases({ 0: true });
    } catch (err) {
      setResult({ analysis: `**Error:** ${err.message}`, mode });
    }
    setLoading(false);
  }

  function togglePhase(i) {
    setExpandedPhases(prev => ({ ...prev, [i]: !prev[i] }));
  }

  const isRed = mode === 'red';
  const phases = result ? parsePhases(result.analysis) : null;

  return (
    <div style={{ padding: '0 0 40px' }} className="animate-fade-up">
      <div className="page-header" style={{
        background: loading || result
          ? `linear-gradient(180deg, ${isRed ? 'rgba(255,45,85,0.08)' : 'rgba(0,229,255,0.06)'} 0%, transparent 100%)`
          : undefined,
        transition: 'background 0.5s',
      }}>
        <div className="page-title">
          <Swords size={22} color={isRed ? 'var(--accent-red)' : 'var(--accent)'} />
          Attack Simulator
        </div>
        <div className="page-subtitle">AI-powered Red Team vs Blue Team scenario generation</div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 960 }}>
        {/* Config card */}
        <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Target Description
            </label>
            <input
              value={target}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && run()}
              placeholder="e.g., Apache 2.4.49 on Ubuntu 20.04 with MySQL 5.7 backend"
              className="input-field"
            />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Describe a fictional target in detail. More detail = better simulation.
            </p>
          </div>

          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <button
              onClick={() => setMode('red')}
              style={{
                flex: 1, padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: 'pointer', border: '2px solid',
                borderColor: mode === 'red' ? 'var(--accent-red)' : 'var(--border)',
                background: mode === 'red' ? 'var(--accent-red-dim)' : 'transparent',
                color: mode === 'red' ? 'var(--accent-red)' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              <Skull size={18} /> Red Team — Attack
            </button>
            <button
              onClick={() => setMode('blue')}
              style={{
                flex: 1, padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: 'pointer', border: '2px solid',
                borderColor: mode === 'blue' ? 'var(--accent)' : 'var(--border)',
                background: mode === 'blue' ? 'var(--accent-dim)' : 'transparent',
                color: mode === 'blue' ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              <Shield size={18} /> Blue Team — Defend
            </button>
          </div>

          <button onClick={run} disabled={loading || !target.trim()} className={isRed ? 'btn-danger' : 'btn-primary'} style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15 }}>
            {loading ? 'Generating simulation...' : isRed ? '⚔️ Simulate Attack' : '🛡️ Generate Defense Plan'}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
              border: `3px solid ${isRed ? 'var(--accent-red-dim)' : 'var(--accent-dim)'}`,
              borderTopColor: isRed ? 'var(--accent-red)' : 'var(--accent)',
              animation: 'spin-slow 1s linear infinite',
            }} />
            <div style={{ color: isRed ? 'var(--accent-red)' : 'var(--accent)', fontWeight: 700, fontSize: 16 }}>
              {isRed ? '🔴 Generating attack simulation...' : '🔵 Generating defense plan...'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>This may take 15–30 seconds</div>
          </div>
        )}

        {/* Phase cards */}
        {result && phases && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0, color: isRed ? 'var(--accent-red)' : 'var(--accent)' }}>
                {isRed ? '⚔️ Red Team Attack Simulation' : '🛡️ Blue Team Defense Plan'}
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>• {target}</span>
            </div>
            {phases.map((phase, i) => (
              <PhaseCard
                key={i} title={phase.title} content={phase.content}
                index={i} isRed={isRed}
                expanded={!!expandedPhases[i]}
                onToggle={() => togglePhase(i)}
              />
            ))}
          </div>
        )}

        {/* Fallback: raw text if phases couldn't be parsed */}
        {result && !phases && (
          <div className={`glass-card`} style={{ padding: 24, borderColor: isRed ? 'rgba(255,45,85,0.3)' : 'var(--border-accent)' }}>
            <h3 style={{ fontWeight: 700, color: isRed ? 'var(--accent-red)' : 'var(--accent)', marginBottom: 16 }}>
              {isRed ? '⚔️ Red Team Analysis' : '🛡️ Blue Team Defense Plan'}
            </h3>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {result.analysis}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
