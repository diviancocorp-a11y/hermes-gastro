// Contexto no secreto para el registro: el diagnostico y el retorno de Google.
import { planRecomendado } from './diagnostico';
const CLAVE_BORRADOR = 'dico:registro-google';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = v => typeof v === 'string' ? v.trim().slice(0, 80) : '';
export function contextoDelRegistro() {
  const q = new URLSearchParams(window.location.search);
  let sesion, borrador;
  try { sesion = JSON.parse(sessionStorage.getItem('dico:diagnostico-v2-en-curso') || 'null'); } catch { /* sin diagnostico */ }
  if (q.get('oauth') === 'google') {
    try { const b = JSON.parse(sessionStorage.getItem(CLAVE_BORRADOR) || 'null'); if (b && Date.now() - b.creado < 3600000) borrador = b; } catch { /* se completa de nuevo */ }
  }
  const id = q.get('d') || borrador?.diagnostico || null;
  const diagnostico = UUID.test(String(id || '')) ? id : null;
  const r = sesion?.id === diagnostico && diagnostico ? sesion.respuestas || {} : {};
  const canales = Array.isArray(r.canales) ? r.canales : [];
  const fisico = canales.some(c => ['salon', 'mostrador'].includes(c));
  const remoto = canales.some(c => !['salon', 'mostrador'].includes(c));
  const rubro = q.get('rubro') || borrador?.vertical || ({ gastronomia: 'gastro', comercio: 'retail', servicios: 'barber', otro: 'retail' }[r.vertical]);
  const candidatoPlan = q.get('plan') || borrador?.plan || (r.vertical ? planRecomendado(r) : 'digital');
  const plan = ['digital', 'local', 'cadena'].includes(candidatoPlan) ? candidatoPlan : 'digital';
  const periodo = plan !== 'digital' && (q.get('periodo') || borrador?.periodo) === 'anual' ? 'anual' : 'mensual';
  return {
    bizName: texto(q.get('negocio') || borrador?.bizName || r.nombre_negocio),
    fullName: texto(borrador?.fullName || r.contacto_nombre), email: texto(borrador?.email),
    vertical: ['gastro', 'retail', 'barber'].includes(rubro) ? rubro : 'gastro',
    modo: ['fisico', 'virtual', 'hibrido'].includes(borrador?.modo) ? borrador.modo : fisico && remoto ? 'hibrido' : remoto ? 'virtual' : 'fisico',
    country: borrador?.country || 'AR', slug: texto(borrador?.slug), slugTocado: Boolean(borrador?.slugTocado),
    plan, periodo, diagnostico, desdeDiagnostico: Boolean(r.vertical),
  };
}
export function recordarRegistroGoogle(datos) {
  // Nunca persistir contraseña, tokens de autenticacion ni capacidad del diagnostico.
  const { bizName, fullName, email, vertical, modo, country, slug, slugTocado, plan, periodo, diagnostico } = datos;
  try { sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ bizName, fullName, email, vertical, modo, country, slug, slugTocado, plan, periodo, diagnostico, creado: Date.now() })); return true; } catch { return false; }
}
export function limpiarRegistroGoogle() {
  try { sessionStorage.removeItem(CLAVE_BORRADOR); } catch { /* sin storage */ }
}
