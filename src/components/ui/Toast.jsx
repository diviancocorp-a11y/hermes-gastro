import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

/**
 * useToast — Hook to show toast notifications.
 * Returns a `toast(message, durationMs?)` function.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

/**
 * ToastProvider — Wrap your app with this to enable toast notifications.
 */
export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null);

  const toast = useCallback((msg, ms = 2000) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), ms);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 left-1/2 -translate-x-1/2 bg-tx text-white px-5 py-2.5 rounded-[10px] text-[13px] font-semibold z-[9999] animate-[fn_0.3s_ease] max-w-[90%] text-center"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
