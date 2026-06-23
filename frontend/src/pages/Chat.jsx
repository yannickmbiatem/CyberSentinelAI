import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Zap } from 'lucide-react';
import { chat } from '../api';
import MarkdownRenderer from '../components/MarkdownRenderer';
import CopyButton from '../components/CopyButton';

const QUICK_PROMPTS = [
  'What is SQL Injection and how to prevent it?',
  'Explain the 5 phases of a penetration test',
  'How does WPA2 cracking work with hashcat?',
  'What are the OWASP Top 10 vulnerabilities?',
  'How to analyze Nmap scan results?',
  'Explain CVE scoring (CVSS) system',
];

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '## Welcome to CyberSentinel AI 🛡️\n\nI\'m your expert cybersecurity analyst with 15+ years of experience. I can help you with:\n\n- **Vulnerability Assessment** — Analyze scan results, CVEs\n- **Penetration Testing** — Tools, techniques, phases\n- **Remediation** — Step-by-step fix guides\n- **Security Concepts** — WPA2, OWASP, network security\n\nWhat would you like to explore today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text = input) {
    const userMsg = text.trim();
    if (!userMsg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const data = await chat(userMsg, history);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${err.message}` }]);
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
    setMessages([{
      role: 'assistant',
      content: 'Chat cleared. How can I help you with cybersecurity today?'
    }]);
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
          <div className="page-subtitle">Powered by Groq · Ctrl+Enter to send</div>
        </div>
        <button onClick={clearChat} className="btn-ghost">
          <Trash2 size={14} /> Clear Chat
        </button>
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
            {/* Avatar */}
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
              padding: '12px 16px',
              position: 'relative',
            }}>
              {m.role === 'user' ? (
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#060b14', fontWeight: 500 }}>{m.content}</p>
              ) : (
                <div>
                  <MarkdownRenderer content={m.content} />
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
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
