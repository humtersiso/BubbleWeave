import React, { useEffect, useId, useRef, useState } from 'react';

const IconHelp = ({ className = 'h-4 w-4' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/** 步驟旁說明：灰問號、無圓框（不放品牌旁） */
export default function HelpTip({ title = '說明', children, className = '' }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className={`relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        className="inline-flex items-center justify-center p-1 text-[var(--ink)]/40 transition hover:text-[var(--ink)]"
        aria-label={title}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <IconHelp />
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={title}
          className="absolute right-0 top-full z-50 mt-2 w-[min(17.5rem,calc(100vw-2rem))] border-2 border-[var(--ink)] bg-white p-3 text-left text-xs leading-relaxed shadow-card"
        >
          <p className="mb-2 text-[13px] font-semibold tracking-wide">{title}</p>
          <div className="space-y-1.5 text-[12px] text-[var(--ink)]/80">{children}</div>
        </div>
      ) : null}
    </span>
  );
}

export function StepHeading({ step, title, hint, helpTitle, children }) {
  return (
    <header className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {step ? (
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[var(--accent)]">
              {step}
            </p>
          ) : null}
          <h1 className="font-display mt-1 text-2xl font-bold leading-tight tracking-tight">
            {title}
          </h1>
        </div>
        {children ? (
          <HelpTip title={helpTitle || `${title}說明`} className="mt-0.5">
            {children}
          </HelpTip>
        ) : null}
      </div>
      {hint ? (
        <p className="text-[13px] leading-relaxed text-[var(--ink)]/65">{hint}</p>
      ) : null}
    </header>
  );
}
