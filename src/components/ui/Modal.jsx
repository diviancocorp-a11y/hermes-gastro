import React, { useEffect, useRef } from 'react';

/**
 * Modal — Centered dialog with backdrop.
 * Keyboard: Escape closes. Focus is trapped inside.
 */
export default function Modal({ open, onClose, children, className = '' }) {
  const ref = useRef(null);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Auto-focus first focusable element
  useEffect(() => {
    if (!open || !ref.current) return;
    const focusable = ref.current.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-[rgba(45,27,14,0.5)] z-300 flex items-center justify-center p-5 max-w-[480px] mx-auto"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={ref}
        className={`bg-bg rounded-[var(--radius-base)] p-5 w-full shadow-elevated animate-[fn_0.3s_ease] ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Overlay — Full-screen panel that slides up (used for forms, detail views).
 * Keyboard: Escape closes.
 */
export function Overlay({ open, onClose, title, children, className = '' }) {
  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 bg-bg z-200 overflow-y-auto max-w-[480px] mx-auto animate-[su_0.3s_ease] ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex items-center gap-3 px-4 py-4 border-b border-bg2 bg-bg sticky top-0 z-10">
        <h2 className="font-serif text-lg flex-1">{title}</h2>
        {onClose && (
          <button
            className="bg-transparent border-none cursor-pointer text-tx p-1"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
