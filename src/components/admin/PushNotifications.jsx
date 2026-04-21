// src/components/admin/PushNotifications.jsx
// Admin panel for sending push notifications and viewing subscriber stats.
import { useState, useEffect } from 'react';
import { Icon } from '../../lib/utils';
import { sendPushNotification, getSubscriberCount } from '../../services/push';

export default function PushNotifications({ msg, onClose }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');
  const [loading, setLoading] = useState(false);
  const [subCount, setSubCount] = useState(0);

  useEffect(() => {
    getSubscriberCount().then(setSubCount).catch(() => {});
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { msg?.('Completá título y mensaje'); return; }
    setLoading(true);
    try {
      const result = await sendPushNotification({ title, body, url });
      msg?.(`Notificación enviada a ${result.sent || 0} suscriptores ✓`);
      setTitle('');
      setBody('');
    } catch (err) {
      msg?.(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ov">
      <div className="op">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="st" style={{ marginBottom: 0 }}>🔔 Notificaciones push</div>
          <button className="hb" onClick={onClose}>{Icon.x({ size: 20 })}</button>
        </div>

        {/* Stats */}
        <div style={{
          padding: '12px 14px', background: 'var(--b2)', borderRadius: 10, marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>Suscriptores activos</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ac)' }}>{subCount}</div>
          </div>
          <div style={{ fontSize: 40 }}>📱</div>
        </div>

        {subCount === 0 && (
          <div style={{
            padding: '12px 14px', background: 'var(--yl,#FFF8E1)', borderRadius: 10, marginBottom: 16,
            fontSize: 12, color: 'var(--yw,#8D6E00)', lineHeight: 1.5,
          }}>
            ⚠️ No hay suscriptores aún. Los clientes deben aceptar notificaciones en el catálogo. Asegurate de configurar las claves VAPID en las variables de entorno.
          </div>
        )}

        {/* Send form */}
        <form onSubmit={handleSend}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginBottom: 8 }}>Enviar notificación</div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (ej: ¡Nuevas tortas!)"
            maxLength={80}
            className="cki"
            style={{ width: '100%', marginBottom: 8 }}
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Mensaje (ej: Probá nuestras nuevas tortas artesanales...)"
            maxLength={200}
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--b3,#ddd)',
              background: 'var(--bg)', color: 'var(--tx)', fontSize: 14, resize: 'vertical',
              fontFamily: 'inherit', marginBottom: 8,
            }}
          />

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL al hacer click (ej: /)"
            className="cki"
            style={{ width: '100%', marginBottom: 16 }}
          />

          {/* Preview */}
          {(title || body) && (
            <div style={{
              padding: '12px 14px', background: 'var(--b2)', borderRadius: 10, marginBottom: 16,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <div style={{ fontSize: 20, flexShrink: 0 }}>🔔</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{title || 'Título'}</div>
                <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{body || 'Mensaje'}</div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn bp"
            disabled={loading || !title.trim() || !body.trim()}
            style={{ width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 700, borderRadius: 12 }}
          >
            {loading ? 'Enviando...' : `Enviar a ${subCount} suscriptores`}
          </button>
        </form>
      </div>
    </div>
  );
}
