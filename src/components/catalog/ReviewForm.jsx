// src/components/catalog/ReviewForm.jsx
// Public review submission form shown after order completion.
import { useState } from 'react';
import StarRating from '../ui/StarRating';
import { submitReview } from '../../services/reviews';

export default function ReviewForm({ orderId, customerName, customerPhone, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) { setError('Elegí una calificación'); return; }
    setLoading(true);
    setError('');
    try {
      await submitReview({
        orderId,
        customerName: customerName || 'Anónimo',
        customerPhone: customerPhone || '',
        rating,
        comment,
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      setError(err.message || 'Error al enviar');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{
        textAlign: 'center', padding: '24px 16px', background: 'var(--gl,#E8F5E9)',
        borderRadius: 16, margin: '12px 0',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>💚</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gn,#3A7D44)' }}>¡Gracias por tu reseña!</div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>Tu opinión nos ayuda a mejorar</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{
      padding: '16px', background: 'var(--b2)', borderRadius: 16, margin: '12px 0',
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', marginBottom: 12 }}>
        ¿Cómo fue tu experiencia?
      </div>

      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <StarRating value={rating} onChange={setRating} size={36} />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Contanos tu experiencia (opcional)"
        maxLength={500}
        rows={3}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--b3,#ddd)',
          background: 'var(--bg)', color: 'var(--tx)', fontSize: 14, resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />

      {error && <div style={{ fontSize: 12, color: 'var(--rd)', marginTop: 6 }}>{error}</div>}

      <button
        type="submit"
        disabled={loading || rating === 0}
        className="btn bp"
        style={{
          width: '100%', marginTop: 12, padding: '12px 0', fontSize: 14, fontWeight: 700,
          borderRadius: 12, opacity: rating === 0 ? 0.5 : 1,
        }}
      >
        {loading ? 'Enviando...' : 'Enviar reseña'}
      </button>
    </form>
  );
}
