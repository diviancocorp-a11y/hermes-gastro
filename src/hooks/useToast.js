// src/hooks/useToast.js
// Toast minimalista para feedback de acciones en el catalog público.
// Sin libs externas — solo state local + render condicional.
//
// Uso:
//   const { toast, ToastContainer } = useToast();
//   toast('✓ Agregado al carrito');
//   ...
//   return (<><ToastContainer />... </>);
import { useState, useCallback, useRef } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback((message, opts = {}) => {
    const id = ++idRef.current;
    const duration = opts.duration ?? 2200;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const ToastContainer = useCallback(() => (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 90,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: 'var(--tx, #2D1B0E)',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 24,
            fontSize: 14,
            fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            animation: 'toast-in .22s ease-out',
            whiteSpace: 'nowrap',
          }}
        >
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  ), [toasts]);

  return { toast, ToastContainer };
}
