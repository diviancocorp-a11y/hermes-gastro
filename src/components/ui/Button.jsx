import React from 'react';

/**
 * Button — Reusable button component with Tailwind classes.
 *
 * @param {'primary'|'secondary'|'danger'|'success'|'blue'|'yellow'|'ghost'} variant
 * @param {'base'|'sm'|'lg'} size
 * @param {boolean} disabled
 * @param {boolean} loading
 * @param {React.ReactNode} children
 */
export default function Button({
  variant = 'primary',
  size = 'base',
  disabled = false,
  loading = false,
  className = '',
  children,
  ...props
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-bold font-sans rounded-[var(--radius-sm)] cursor-pointer transition-transform active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-accent text-white shadow-accent',
    secondary: 'bg-bg2 text-tx',
    danger: 'bg-red-light text-red',
    success: 'bg-green text-white',
    blue: 'bg-blue text-white',
    yellow: 'bg-yellow text-white',
    ghost: 'bg-transparent text-t3 hover:bg-bg2',
  };

  const sizes = {
    sm: 'px-3.5 py-2 text-[13px]',
    base: 'w-full px-4 py-3.5 text-[15px]',
    lg: 'w-full px-5 py-4 text-base',
  };

  return (
    <button
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.base} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  );
}
