import React from 'react';

/**
 * Avatar — Circular or rounded image/letter avatar.
 *
 * @param {string} src - Image URL (optional)
 * @param {string} letter - Fallback letter when no image
 * @param {string} bg - Background color for letter avatar
 * @param {'sm'|'base'|'lg'} size
 */
export default function Avatar({
  src,
  letter,
  bg = 'var(--color-accent)',
  size = 'base',
  className = '',
  alt = '',
  ...props
}) {
  const sizes = {
    sm: 'w-8 h-8 text-sm rounded-[8px]',
    base: 'w-10 h-10 text-base rounded-[10px]',
    lg: 'w-20 h-20 text-4xl rounded-[24px]',
  };

  const sizeClass = sizes[size] || sizes.base;

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} object-cover flex-shrink-0 ${className}`}
        {...props}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center font-serif text-white flex-shrink-0 ${className}`}
      style={{ background: bg }}
      {...props}
    >
      {letter || '?'}
    </div>
  );
}
