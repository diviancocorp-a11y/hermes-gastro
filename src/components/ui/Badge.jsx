import React from 'react';

/**
 * Badge — Small colored label for status or category tags.
 *
 * @param {'default'|'success'|'warning'|'danger'|'info'} variant
 */
export default function Badge({
  variant = 'default',
  children,
  className = '',
  style,
  ...props
}) {
  const variants = {
    default: 'bg-bg2 text-t2',
    success: 'bg-green-light text-green',
    warning: 'bg-yellow-light text-[#8D6E00]',
    danger: 'bg-red-light text-red',
    info: 'bg-blue-light text-blue',
  };

  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${variants[variant] || variants.default} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}
