// src/components/catalog/PushBanner.jsx
// Dismissible banner prompting customers to enable push notifications.
import { useState, useEffect } from 'react';
import { isPushSupported, getPushPermission, subscribeToPush } from '../../services/push';

export default function PushBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only show if push is supported, not yet granted, and not dismissed
    if (!isPushSupported()) return;
    const dismissed = sessionStorage.getItem('push_banner_dismissed');
    if (dismissed) return;

    getPushPermission().then(perm => {
      if (perm === 'default') setVisible(true);
    });
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const sub = await subscribeToPush();
      if (sub) {
        setVisible(false);
      } else {
        // Permission denied or failed
        setVisible(false);
      }
    } catch {
      setVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('push_banner_dismissed', '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      margin: '12px 16px', padding: '14px 16px', borderRadius: 12,
      background: 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>🔔</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#5D4037', marginBottom: 2 }}>
          ¡No te pierdas nada!
        </div>
        <div style={{ fontSize: 12, color: '#795548', lineHeight: 1.4 }}>
          Activá las notificaciones para enterarte de promociones y novedades.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={handleDismiss}
          style={{
            padding: '6px 10px', borderRadius: 8, border: '1px solid #D7CCC8',
            background: '#fff', color: '#795548', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Ahora no
        </button>
        <button
          onClick={handleEnable}
          disabled={loading}
          style={{
            padding: '6px 12px', borderRadius: 8, border: 'none',
            background: '#C45D3E', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '...' : 'Activar'}
        </button>
      </div>
    </div>
  );
}
