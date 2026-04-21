import React from 'react';

/**
 * Input — Reusable text input with label support.
 */
export default function Input({
  label,
  className = '',
  error,
  ...props
}) {
  return (
    <div className="mb-3.5">
      {label && (
        <label className="block text-xs font-semibold text-t2 uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}
      <input
        className={`w-full px-3.5 py-3 border-2 border-bg2 rounded-[var(--radius-sm)] text-[15px] font-sans text-tx bg-bg3 outline-none transition-colors focus:border-accent placeholder:text-t3 ${error ? 'border-red' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-red mt-1">{error}</p>
      )}
    </div>
  );
}

/**
 * Select — Styled select using same patterns as Input.
 */
export function Select({ label, className = '', children, ...props }) {
  return (
    <div className="mb-3.5">
      {label && (
        <label className="block text-xs font-semibold text-t2 uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}
      <select
        className={`w-full px-3.5 py-3 border-2 border-bg2 rounded-[var(--radius-sm)] text-[15px] font-sans text-tx bg-bg3 outline-none transition-colors focus:border-accent appearance-none bg-no-repeat bg-[position:right_12px_center] bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239C8B7A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")] ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

/**
 * Textarea — Styled textarea.
 */
export function Textarea({ label, className = '', error, ...props }) {
  return (
    <div className="mb-3.5">
      {label && (
        <label className="block text-xs font-semibold text-t2 uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}
      <textarea
        className={`w-full px-3.5 py-3 border-2 border-bg2 rounded-[var(--radius-sm)] text-[15px] font-sans text-tx bg-bg3 outline-none transition-colors focus:border-accent placeholder:text-t3 resize-none ${error ? 'border-red' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-red mt-1">{error}</p>
      )}
    </div>
  );
}
