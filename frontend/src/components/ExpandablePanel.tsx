import { useState, ReactNode } from 'react';

interface ExpandablePanelProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function ExpandablePanel({ title, children, defaultOpen = false }: ExpandablePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="expandable">
      <button
        className={`expandable-header ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        <span className="arrow">▶</span>
      </button>
      {open && (
        <div className="expandable-content">
          {children}
        </div>
      )}
    </div>
  );
}
