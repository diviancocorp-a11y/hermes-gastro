// src/components/catalog/CatalogSkeleton.jsx
// Skeleton screen mostrado mientras el catalog hace fetch inicial.
// Reemplaza al "Cargando..." textual — da sensación de velocidad y previene CLS.

export default function CatalogSkeleton() {
  return (
    <div className="app catalog-skeleton">
      <style>{`
        .catalog-skeleton .sk-cover {
          width: 100%; height: 140px; background: var(--b2, #F3EDE4);
          border-radius: 0 0 18px 18px;
        }
        .catalog-skeleton .sk-header {
          padding: 16px; display: flex; gap: 12px; align-items: center;
          margin-top: -36px;
        }
        .catalog-skeleton .sk-avatar {
          width: 72px; height: 72px; border-radius: 18px;
          background: var(--b3, #fff); flex-shrink: 0;
        }
        .catalog-skeleton .sk-line {
          height: 14px; border-radius: 4px; background: var(--b2, #F3EDE4);
          margin-bottom: 8px;
        }
        .catalog-skeleton .sk-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
          padding: 0 16px 24px;
        }
        @media (min-width: 600px) {
          .catalog-skeleton .sk-grid { grid-template-columns: 1fr 1fr 1fr; }
        }
        .catalog-skeleton .sk-card {
          background: var(--b3, #fff); border-radius: 14px;
          padding: 12px; min-height: 200px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .catalog-skeleton .sk-img {
          aspect-ratio: 1; width: 100%; border-radius: 10px;
          background: var(--b2, #F3EDE4);
        }
        .catalog-skeleton .sk-line,
        .catalog-skeleton .sk-avatar,
        .catalog-skeleton .sk-img,
        .catalog-skeleton .sk-cover {
          background-image: linear-gradient(90deg,
            var(--b2, #F3EDE4) 0%,
            var(--b3, #fff) 50%,
            var(--b2, #F3EDE4) 100%);
          background-size: 200% 100%;
          animation: sk-pulse 1.4s ease-in-out infinite;
        }
        @keyframes sk-pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div className="sk-cover" aria-hidden="true" />
      <div className="sk-header">
        <div className="sk-avatar" />
        <div style={{ flex: 1 }}>
          <div className="sk-line" style={{ width: '60%' }} />
          <div className="sk-line" style={{ width: '40%', height: 10 }} />
        </div>
      </div>
      <div className="sk-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="sk-card">
            <div className="sk-img" />
            <div className="sk-line" style={{ width: '70%' }} />
            <div className="sk-line" style={{ width: '50%', height: 10 }} />
            <div className="sk-line" style={{ width: '40%', marginTop: 'auto' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
