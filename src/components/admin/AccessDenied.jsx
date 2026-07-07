// src/components/admin/AccessDenied.jsx
// Pantalla para usuarios logueados SIN acceso al admin (no estan en
// admin_users). Tipico: cliente que registro su correo en el catalogo
// e intento entrar a /admin.
import { supabase } from '../../lib/supabase';

export default function AccessDenied({ email }) {
  const goCatalog = () => { window.location.href = '/'; };
  const logoutAndCatalog = async () => {
    try { await supabase.auth.signOut(); } catch { /* noop */ }
    window.location.href = '/';
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
      padding: 24, textAlign: 'center',
      background: '#0a0a0a', color: '#e8e0d8',
    }}>
      <div style={{ fontSize: 40 }} aria-hidden="true">🔒</div>
      <h1 style={{ fontSize: 20, margin: 0 }}>Esta cuenta no tiene acceso al panel</h1>
      <p style={{ fontSize: 14, opacity: 0.75, maxWidth: 420, margin: 0, lineHeight: 1.5 }}>
        {email ? <><b>{email}</b> es una cuenta de cliente del catalogo.</> : 'Tu cuenta es de cliente del catalogo.'}
        {' '}El panel de gestion es solo para el equipo del negocio. Si deberias tener acceso,
        pedile al dueno que te agregue desde Usuarios.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button type="button" onClick={goCatalog} style={{
          padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: '#F59E0B', color: '#1a1208', fontWeight: 600, fontSize: 14,
        }}>Ir al catalogo</button>
        <button type="button" onClick={logoutAndCatalog} style={{
          padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
          background: 'none', border: '1px solid rgba(232,224,216,0.3)', color: '#e8e0d8', fontSize: 14,
        }}>Cerrar sesion</button>
      </div>
    </div>
  );
}
