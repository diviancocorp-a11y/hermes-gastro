// src/components/ui/OfflineBanner.jsx
// Shows a fixed banner when the user loses internet connection.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function OfflineBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#2D1B0E',
        color: '#fff',
        textAlign: 'center',
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 600,
        zIndex: 10000,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {t('app.offline')}
    </div>
  );
}
