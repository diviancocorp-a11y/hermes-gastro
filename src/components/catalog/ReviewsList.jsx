// src/components/catalog/ReviewsList.jsx
// Public display of customer reviews with aggregate stats.
import { useState, useEffect } from 'react';
import StarRating from '../ui/StarRating';
import { getPublicReviews, getReviewStats } from '../../services/reviews';

export default function ReviewsList() {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ total: 0, average: 0, distribution: [0, 0, 0, 0, 0] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPublicReviews(), getReviewStats()])
      .then(([revs, st]) => { setReviews(revs); setStats(st); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 16, color: 'var(--t3)', fontSize: 13 }}>Cargando reseñas...</div>;
  if (stats.total === 0) return null;

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--tx)', marginBottom: 12 }}>⭐ Reseñas de clientes</div>

      {/* Aggregate stats */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'center', padding: '12px 16px',
        background: 'var(--b2)', borderRadius: 14, marginBottom: 16,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--ac)' }}>{stats.average}</div>
          <StarRating value={Math.round(stats.average)} readOnly size={16} />
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{stats.total} reseñas</div>
        </div>
        <div style={{ flex: 1 }}>
          {[5, 4, 3, 2, 1].map(star => {
            const count = stats.distribution[star - 1];
            const pct = stats.total ? (count / stats.total) * 100 : 0;
            return (
              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 11, width: 14, color: 'var(--t3)' }}>{star}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--b3,#ddd)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--ac)', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, width: 20, textAlign: 'right', color: 'var(--t3)' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual reviews */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {reviews.slice(0, 10).map(r => (
          <div key={r.id} style={{
            padding: '12px 14px', background: 'var(--b2)', borderRadius: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{r.customer_name || 'Anónimo'}</span>
              <StarRating value={r.rating} readOnly size={14} />
            </div>
            {r.comment && <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.4 }}>{r.comment}</div>}
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
              {new Date(r.created_at).toLocaleDateString('es-AR')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
