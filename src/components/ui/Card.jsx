import React from 'react';

/**
 * Card — Reusable card container with shadow and rounded corners.
 */
export default function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`bg-bg3 rounded-[var(--radius-base)] p-4 shadow-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * StatCard — Dashboard stat card with label, value, and optional detail text.
 */
export function StatCard({ label, value, detail, valueClass = '', className = '', ...props }) {
  return (
    <Card className={`p-3.5 ${className}`} {...props}>
      <div className="text-[11px] text-t3 uppercase tracking-wide font-semibold mb-1">
        {label}
      </div>
      <div className={`font-serif text-[22px] ${valueClass}`}>
        {value}
      </div>
      {detail && (
        <div className="text-[11px] text-t3 mt-0.5">{detail}</div>
      )}
    </Card>
  );
}
