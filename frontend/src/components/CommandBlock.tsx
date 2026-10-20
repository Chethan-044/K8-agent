import { useState } from 'react';

interface CommandBlockProps {
  command: string;
  purpose?: string;
  risk?: 'low' | 'medium' | 'high';
}

export default function CommandBlock({ command, purpose, risk }: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = command;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div>
      {purpose && <div className="command-purpose">{purpose}</div>}
      <div className="command-block">
        <code>$ {command}</code>
        <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {risk && risk !== 'low' && (
        <div className={`command-risk ${risk}`}>
          ⚠ {risk === 'high' ? 'This command modifies the cluster' : 'Moderate risk — review before executing'}
        </div>
      )}
    </div>
  );
}
