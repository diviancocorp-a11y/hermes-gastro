// src/components/ui/Skeleton.jsx
// Shimmer skeleton loaders for loading states.

export function SkeletonLine({ width = '100%', height = 14 }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{ width, height, borderRadius: 6, background: 'var(--bg2, #F3EDE4)' }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        height: 120,
        borderRadius: 'var(--radius-base, 14px)',
        background: 'var(--bg2, #F3EDE4)',
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonProductGrid({ count = 6 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonLine key={i} height={48} />
      ))}
    </div>
  );
}
