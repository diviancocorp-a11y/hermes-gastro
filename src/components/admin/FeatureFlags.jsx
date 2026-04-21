import { useState, useEffect, useCallback } from 'react';
import { fetchAllFlags, updateFlag, refreshFlags } from '../../services/featureFlags';

const FLAG_DESCRIPTIONS = {
  RECIPES_WITH_INGREDIENTS: 'Mostrar ingredientes en recetas',
  DELIVERY_ENABLED: 'Habilitar delivery en checkout',
  SCHEDULING_ENABLED: 'Permitir programar pedidos',
  GIFT_MODE: 'Opción de envolver como regalo',
  COUPONS: 'Sistema de cupones/promociones',
  WHATSAPP: 'Links de contacto WhatsApp',
  LOYALTY: 'Programa de puntos/fidelización',
  REVIEWS: 'Reseñas de clientes',
  REFERRAL: 'Programa de referidos',
  E_INVOICE: 'Facturación electrónica AFIP',
  PUSH_NOTIFICATIONS: 'Notificaciones push',
  DAILY_DEALS: 'Ofertas del día por categoría',
};

export default function FeatureFlags({ msg, onClose }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllFlags();
    setFlags(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (key, currentEnabled) => {
    setToggling(key);
    try {
      await updateFlag(key, !currentEnabled);
      setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !currentEnabled } : f));
      await refreshFlags();
      msg(`${key}: ${!currentEnabled ? 'activado' : 'desactivado'}`);
    } catch (err) {
      msg('Error al actualizar flag');
      console.error(err);
    }
    setToggling(null);
  };

  return (
    <div className="ov" onClick={e => e.target.classList.contains("ov") && onClose()}>
      <div className="ov-c" style={{ maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>⚙️ Feature Flags</h2>
          <button className="abtn" onClick={onClose} style={{ padding: "4px 12px", fontSize: 13 }}>✕</button>
        </div>

        <p style={{ fontSize: 13, color: "var(--t3)", marginBottom: 16 }}>
          Activá o desactivá funcionalidades del sistema. Los cambios aplican inmediatamente.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>Cargando flags...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {flags.map(f => (
              <div key={f.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 10,
                background: f.enabled ? 'var(--b1, #f5f0eb)' : 'var(--bg2, #fafafa)',
                border: '1px solid var(--br, #eee)',
                opacity: toggling === f.key ? 0.6 : 1,
                transition: 'all .2s',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx, #333)' }}>{f.key}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3, #888)', marginTop: 2 }}>
                    {FLAG_DESCRIPTIONS[f.key] || f.description || '—'}
                  </div>
                </div>
                <button
                  onClick={() => toggle(f.key, f.enabled)}
                  disabled={toggling === f.key}
                  style={{
                    width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                    background: f.enabled ? 'var(--pr, #C45D3E)' : '#ccc',
                    position: 'relative', transition: 'background .2s', flexShrink: 0,
                  }}
                  aria-label={`Toggle ${f.key}`}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3,
                    left: f.enabled ? 25 : 3,
                    transition: 'left .2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && flags.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>
            No hay flags configurados en la base de datos.
          </div>
        )}
      </div>
    </div>
  );
}
