import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy'}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
        copied
          ? 'bg-[var(--accent-green-dim)] text-[var(--accent-green)]'
          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border)]'
      } ${className}`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
