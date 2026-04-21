// src/components/admin/Reviews.jsx
// Admin reviews management: view all reviews, toggle visibility.
import { useState, useEffect, useMemo } from 'react';
import StarRating from '../ui/StarRating';
import { getAdminReviews, toggleReviewVisibility, getReviewStats } from '../../services/reviews';
import { Icon } from '../../lib/utils';

export default function Reviews({ msg }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ total: 0, average: 0, distribution: [0, 0, 0, 0, 0] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'visible' | 'hidden'

  const loadData = () => {
    setLoading(true);
    Promise.all([getAdminReviews(), getReviewStats()])
      .then(([revs, st]) => { setReviews(revs); setStats(st); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    if (filter === 'visible') return reviews.filter(r => r.visible);
    if (filter === 'hidden') return reviews.filter(r => !r.visible);
    return reviews;
  }, [reviews, filter]);

  const handleToggle = async (id, currentVisible) => {
    try {
      await toggleReviewVisibility(id, !currentVisible);
      setReviews(prev => prev.map(r => r.id === id ? { ...r, visible: !currentVisible } : r));
      msg?.(currentVisible ? 'Reseña ocultada' : 'Reseña visible');
    } catch {
      msg?.('Error al actualizar');
    }
  };

  return (
    <>
      <div className="s" style={{ paddingTop: 4 }}>
        <div className="st">⭐ Reseñas</div>
      </div>

      {/* Stats summary */}
      <div className="s">
        <div className="c" style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--ac)' }}>{stats.average || '—'}</div>
            <StarRating value={Math.round(stats.average)} readOnly size={18} />
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{stats.total} reseñas</div>
          </div>
          <div style={{ flex: 1 }}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = stats.distribution[star - 1];
              const pct = stats.total ? (count / stats.total) * 100 : 0;
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, width: 14, fontWeight: 600, color: 'var(--t2)' }}>{star}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--b2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--ac)', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 11, width: 24, textAlign: 'right', color: 'var(--t3)' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="s" style={{ display: 'flex', gap: 4, paddingTop: 4 }}>
        {[{ k: 'all', l: `Todas (${reviews.length})` }, { k: 'visible', l: 'Visibles' }, { k: 'hidden', l: 'Ocultas' }].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
            background: filter === f.k ? 'var(--ac)' : 'var(--b2)', color: filter === f.k ? '#fff' : 'var(--t2)', cursor: 'pointer',
          }}>{f.l}</button>
        ))}
      </div>

      {/* Reviews list */}
      <div className="s" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)', fontSize: 13 }}>Sin reseñas</div>
        ) : filtered.map(r => (
          <div key={r.id} className="c" style={{ padding: '12px 14px', opacity: r.visible ? 1 : 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{r.customer_name || 'Anónimo'}</span>
                {r.customer_phone && <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 8 }}>{r.customer_phone}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StarRating value={r.rating} readOnly size={14} />
                <button
                  className="hb"
                  onClick={() => handleToggle(r.id, r.visible)}
                  title={r.visible ? 'Ocultar' : 'Mostrar'}
                  style={{ fontSize: 16 }}
                >
                  {r.visible ? Icon.eye({ size: 16 }) : Icon.eyeOff({ size: 16 })}
                </button>
              </div>
            </div>
            {r.comment && <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.4 }}>{r.comment}</div>}
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
              {new Date(r.created_at).toLocaleDateString('es-AR')}
              {!r.visible && <span style={{ marginLeft: 8, color: 'var(--rd)', fontWeight: 600 }}>OCULTA</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
