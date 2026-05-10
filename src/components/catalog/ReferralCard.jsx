// src/components/catalog/ReferralCard.jsx
// Shows referral code, share buttons, and referral stats for logged-in customers.
import { useState, useEffect } from 'react';
import { getOrCreateReferralCode, getReferralStats, buildWhatsAppShareUrl, buildShareUrl } from '../../services/referrals';
import business from '@business';

export default function ReferralCard({ phone, name, bizName = business.name }) {
  const [code, setCode] = useState('');
  const [stats, setStats] = useState({ total: 0, completed: 0 });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) { setLoading(false); return; }
    Promise.all([
      getOrCreateReferralCode(phone, name),
      getReferralStats(phone),
    ])
      .then(([c, s]) => { setCode(c); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [phone, name]);

  if (!phone || loading) return null;

  const shareUrl = buildShareUrl(code);
  const waUrl = buildWhatsAppShareUrl(code, bizName);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = () => {
    if (navigator.share) {
      navigator.share({
        title: `${bizName} — Código de referido`,
        text: `Usá mi código ${code} para un descuento en tu primer pedido!`,
        url: shareUrl,
      }).catch(() => {});
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--ac,#C45D3E) 0%, #E07A5C 100%)',
      borderRadius: 16, padding: '20px 16px', color: '#fff', margin: '12px 0',
    }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🎁 Invitá amigos</div>
      <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 12, lineHeight: 1.4 }}>
        Compartí tu código y cuando hagan su primer pedido, ¡ambos reciben un descuento!
      </div>

      {/* Code display */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 12,
      }}>
        <code style={{ flex: 1, fontSize: 20, fontWeight: 800, letterSpacing: 2 }}>{code}</code>
        <button onClick={copyCode} style={{
          padding: '6px 12px', background: 'rgba(255,255,255,0.3)', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>

      {/* Share buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px 0', background: '#25D366', color: '#fff', borderRadius: 10,
          textDecoration: 'none', fontSize: 13, fontWeight: 700,
        }}>
          💬 WhatsApp
        </a>
        {navigator.share && (
          <button onClick={shareNative} style={{
            flex: 1, padding: '10px 0', background: 'rgba(255,255,255,0.25)', color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            📤 Compartir
          </button>
        )}
      </div>

      {/* Stats */}
      {stats.completed > 0 && (
        <div style={{ fontSize: 12, opacity: 0.85, textAlign: 'center' }}>
          🎉 {stats.completed} amigo{stats.completed > 1 ? 's' : ''} referido{stats.completed > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
