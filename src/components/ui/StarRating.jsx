// src/components/ui/StarRating.jsx
// Interactive star rating component (1-5 stars).
import { useState } from 'react';

export default function StarRating({ value = 0, onChange, size = 28, readOnly = false }) {
  const [hover, setHover] = useState(0);

  return (
    <div style={{ display: 'inline-flex', gap: 2 }} role="group" aria-label={`Calificación: ${value} de 5`}>
      {[1, 2, 3, 4, 5].map(star => {
        const active = star <= (hover || value);
        return (
          <button
            key={star}
            type="button"
            onClick={() => !readOnly && onChange?.(star)}
            onMouseEnter={() => !readOnly && setHover(star)}
            onMouseLeave={() => !readOnly && setHover(0)}
            disabled={readOnly}
            aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: readOnly ? 'default' : 'pointer',
              fontSize: size, lineHeight: 1, transition: 'transform 0.1s',
              transform: !readOnly && hover === star ? 'scale(1.2)' : 'scale(1)',
              filter: active ? 'none' : 'grayscale(1) opacity(0.3)',
            }}
          >
            ⭐
          </button>
        );
      })}
    </div>
  );
}
