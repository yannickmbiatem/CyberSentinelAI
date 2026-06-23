import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Zap, Download } from 'lucide-react';
import { chat } from '../api';
import MarkdownRenderer from '../components/MarkdownRenderer';
import CopyButton from '../components/CopyButton';

const STORAGE_KEY = 'cybersentinel_chat_history';

const QUICK_PROMPTS = [
  'What is SQL Injection and how to prevent it?',
  'Explain the 5 phases of a penetration test',
  'How does WPA2 cracking work with hashcat?',
  'What are the OWASP Top 10 vulnerabilities?',
  'How to analyze Nmap scan results?',
  'Explain CVE scoring (CVSS) system',
];

const WELCOME_MSG = {
  role: 'assistant',
  content: '## Welcome to CyberSentinel AI 🛡️\n\nI\'m your expert cybersecurity analyst with 15+ years of experience. I can help you with:\n\n- **Vulnerability Assessment** — Analyze scan results, CVEs\n- **Penetration Testing** — Tools, techniques, phases\n- **Remediation** — Step-by-step fix guides\n- **Security Concepts** — WPA2, OWASP, network security\n\nWhat would you like to explore today?',
  ts: new Date().toISOString(),
};

function loadHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [WELCOME_MSG];
}

export default function Chat() {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Persist messages to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100))); // keep last 100
    } catch { /* quota exceeded — ignore */ }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text = input) {
    const userMsg = text.trim();
    if (!userMsg || loading) return;
    setInput('');
    const ts = new Date().toISOString();
    const newUserMsg = { role: 'user', content: userMsg, ts };
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const data = await chat(userMsg, history);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response, ts: new Date().toISOString() }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${err.message}`, ts: new Date().toISOString() }]);
    }
    setLoading(false);
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    const cleared = [{ ...WELCOME_MSG, content: 'Chat cleared. How can I help you with cybersecurity today?', ts: new Date().toISOString() }];
    setMessages(cleared);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleared));
  }

  function exportChat() {
    const lines = messages.map(m => {
      const role = m.role === 'user' ? '## You' : '## CyberSentinel AI';
      const time = m.ts ? `\n*${new Date(m.ts).toLocaleString()}*` : '';
      return `${role}${time}\n\n${m.content}`;
    });
    const md = `# CyberSentinel AI — Chat Export\n*Exported: ${new Date().toLocaleString()}*\n\n---\n\n${lines.join('\n\n---\n\n')}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cybersentinel_chat_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px' }}>
        <div>
          <div className="page-title" style={{ fontSize: '1.3rem' }}>
            <Bot size={20} color="var(--accent)" />
            AI Security Assistant
          </div>
          <div className="page-subtitle">
            Powered by Groq LLaMA-3 · Ctrl+Enter to send
            <span style={{ marginLeft: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              {messages.length - 1} message{messages.length !== 2 ? 's' : ''} · Auto-saved
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportChat} className="btn-ghost" style={{ fontSize: 12 }}>
            <Download size={13} /> Export
          </button>
          <button onClick={clearChat} className="btn-ghost" style={{ fontSize: 12 }}>
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </div>

      {/* Quick Prompts bar */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>
          <Zap size={12} /> Quick:
        </div>
        {QUICK_PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => send(p)}
            disabled={loading}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.2s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {p.slice(0, 32)}{p.length > 32 ? '…' : ''}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }} className="animate-fade-up">
            {/* AI Avatar */}
            {m.role === 'assistant' && (
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={15} color="var(--accent)" />
              </div>
            )}

            {/* Bubble */}
            <div style={{
              maxWidth: '75%',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
              borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
              padding: '12px 16px', position: 'relative',
            }}>
              {m.role === 'user' ? (
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#060b14', fontWeight: 500 }}>{m.content}</p>
              ) : (
                <div>
                  <MarkdownRenderer content={m.content} />
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {m.ts && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(m.ts).toLocaleTimeString()}</span>}
                    <CopyButton text={m.content} />
                  </div>
                </div>
              )}
            </div>

            {m.role === 'user' && (
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={15} color="var(--accent)" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={15} color="var(--accent)" style={{ animation: 'blink 1s ease-in-out infinite' }} />
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px 18px 18px 18px', padding: '14px 18px', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 150, 300].map(delay => (
                <span key={delay} style={{
                  width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)',
                  display: 'inline-block', animation: 'blink 1.2s ease-in-out infinite',
                  animationDelay: `${delay}ms`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about vulnerabilities, CVEs, pentesting techniques… (Ctrl+Enter to send)"
            rows={2}
            className="input-field"
            style={{ resize: 'none', flex: 1, fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="btn-primary"
            style={{ paddingLeft: 20, paddingRight: 20, flexShrink: 0, height: 48 }}
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
