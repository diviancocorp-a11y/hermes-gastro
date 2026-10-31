// src/services/signup.js
// Alta self-service de un negocio en la plataforma.
//
// El flujo esta partido en dos porque la confirmacion de email esta activada
// y auth.signUp() NO devuelve sesion:
//
//   registrarNegocio()  -> crea el auth user con los datos del negocio en
//                          user_metadata. NO crea el tenant todavia.
//   [el usuario confirma desde el mail, quiza en otro dispositivo]
//   crearTenantPendiente() -> ya con sesion, dispara signup_tenant(), que lee
//                          ese metadata server-side y crea tenant+owner+profile.
//
// Los datos viajan en user_metadata y no en localStorage justamente porque el
// mail se puede abrir en otro equipo, donde localStorage no existe.

import { supabase } from '../lib/supabase';
import { vincularDiagnosticoPendiente } from '../lib/diagnostico';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** true si el slug esta libre Y es valido segun el server. */
export async function slugDisponible(slug) {
  const { data, error } = await supabase.rpc('slug_available', { p_slug: slug });
  if (error) {
    console.error('slug_available:', error.message);
    return null; // null = no se pudo verificar (distinto de "ocupado")
  }
  return data === true;
}

/**
 * Paso 1: crea la cuenta. El tenant se crea recien tras confirmar el email.
 * @returns {{ ok: boolean, needsConfirmation?: boolean, error?: string }}
 */
export async function registrarNegocio(datos) {
  const { email, password, fullName, diagnostico } = datos;
  const nombrePersona = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (nombrePersona.length < 2) {
    return { ok: false, error: 'Tu nombre es obligatorio' };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadataDelAlta({ ...datos, fullName: nombrePersona }),
      // Vuelve SIEMPRE a la raiz: el tenant todavia no existe, asi que su
      // subdominio no resolveria a nada.
      emailRedirectTo: `${window.location.origin}/bienvenido${
        UUID.test(String(diagnostico || '')) ? `?d=${diagnostico}` : ''}`,
    },
  });

  if (error) return { ok: false, error: traducirError(error.message) };

  // Con confirmacion activada no hay sesion: hay que esperar el mail.
  return { ok: true, needsConfirmation: !data.session };
}

/**
 * Paso 2: con sesion activa, crea el tenant desde el metadata del usuario.
 * @returns {{ ok: boolean, slug?: string, error?: string }}
 */
export async function crearTenantPendiente() {
  const { data, error } = await supabase.rpc('signup_tenant');
  if (error) return { ok: false, error: traducirError(error.message) };
  return {
    ok: true,
    // El staff de la plataforma no tiene negocio: la RPC lo dice asi.
    esStaff: data?.es_staff === true,
    slug: data?.slug,
    vertical: data?.vertical,
    tenantId: data?.tenant_id,
  };
}

/**
 * Inicia sesion en la plataforma.
 * @returns {{ ok: boolean, error?: string }}
 */
export async function iniciarSesion({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: traducirError(error.message) };
  return { ok: true };
}

/**
 * A donde mandar al dueño despues de entrar.
 *
 * Aprovecha que signup_tenant() es idempotente (0019): una sola llamada cubre
 * los DOS casos sin preguntar antes.
 *   - ya tiene negocio  -> lo devuelve (already_existed) -> a su subdominio
 *   - confirmo el mail pero nunca llego a /bienvenido -> lo crea ahora
 *
 * @returns {{ ok: boolean, url?: string, slug?: string, error?: string }}
 */
export async function destinoTrasLogin() {
  const r = await crearTenantPendiente();

  // El staff de Divianco NO tiene negocio: `signup_tenant` no le crea ninguno
  // y por eso vuelve sin slug. Sin este corte se armaba
  // `https://undefined.divianco.app` — no se creaba nada en la base, pero la
  // persona terminaba en un dominio que no existe.
  if (r.ok && r.esStaff) {
    return { ok: true, url: `${window.location.origin}/consola`, slug: null };
  }

  // Cinturon: si por lo que sea no vino slug, no se arma una URL con `undefined`.
  if (r.ok && !r.slug) {
    return { ok: false, error: 'No pudimos identificar tu negocio. Volvé a entrar.' };
  }

  if (r.ok) {
    // Confirmo el mail pero nunca paso por /bienvenido: el diagnostico de la
    // landing se vincula aca, solo si hay uno, y con un tope corto: la
    // navegacion al subdominio cortaria el pedido si no se espera.
    const diagnostico = await diagnosticoDelUsuario();
    if (diagnostico) {
      await Promise.race([
        vincularDiagnosticoPendiente(diagnostico),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    }
    return { ok: true, url: urlDelNegocio(r.slug), slug: r.slug };
  }
  return { ok: false, error: r.error };
}

/** El id del diagnostico guardado en el metadata del alta, si hay. */
export async function diagnosticoDelUsuario() {
  try {
    const { data } = await supabase.auth.getUser();
    const id = data?.user?.user_metadata?.diagnostico;
    return UUID.test(String(id || '')) ? id : null;
  } catch {
    return null;
  }
}

/** Manda el mail de restablecimiento de contraseña. */
export async function pedirResetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/entrar`,
  });
  if (error) return { ok: false, error: traducirError(error.message) };
  return { ok: true };
}

/**
 * Fija la contraseña nueva. Solo tiene sentido con la sesion de recuperacion
 * que abre el link del mail (type=recovery en el hash de /entrar).
 */
export async function cambiarPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: traducirError(error.message) };
  return { ok: true };
}

/** URL final del negocio ya creado. */
export function urlDelNegocio(slug) {
  const host = window.location.hostname;
  // En local/preview no hay wildcard: se queda donde esta.
  if (!host.endsWith('divianco.app')) return `${window.location.origin}/`;
  return `https://${slug}.divianco.app/`;
}

/** Mensajes de Supabase/Postgres -> castellano entendible. */
function traducirError(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Ya existe una cuenta con ese email. Probá iniciar sesión.';
  }
  if (m.includes('password') && m.includes('6')) return 'La contraseña necesita al menos 6 caracteres.';
  if (m.includes('should be different')) return 'La contraseña nueva tiene que ser distinta de la anterior.';
  if (m.includes('invalid') && m.includes('email')) return 'Ese email no parece válido.';
  if (m.includes('esta cuenta ya tiene un negocio')) return 'Esta cuenta ya tiene un negocio creado.';
  if (m.includes('no esta disponible')) return 'Esa dirección se ocupó mientras completabas el registro. Elegí otra.';
  if (m.includes('confirma tu email')) return 'Confirmá tu email antes de continuar.';
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos. Esperá unos minutos.';
  }
  // Supabase devuelve el mismo error para "no existe" y "clave incorrecta", a
  // proposito: distinguirlos permitiria averiguar que emails estan registrados.
  if (m.includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }
  if (m.includes('email not confirmed')) {
    return 'Todavía no confirmaste tu email. Revisá tu casilla.';
  }
  if (m.includes('faltan datos del negocio')) {
    return 'Tu cuenta existe pero no tiene un negocio asociado. Escribinos y lo resolvemos.';
  }
  return msg || 'Algo falló. Intentá de nuevo.';
}


// La preferencia no concede modulos ni autoriza un cobro.
function preferenciaDePlan(plan, periodo) {
  return ['digital', 'local', 'cadena'].includes(plan)
    ? { requested_plan: plan, requested_billing_period: plan !== 'digital' && periodo === 'anual' ? 'anual' : 'mensual' }
    : {};
}

/** El boton social solo aparece cuando el proveedor esta habilitado realmente. */
export async function googleDisponible() {
  try {
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }, credentials: 'omit',
    });
    return r.ok && (await r.json()).external?.google === true;
  } catch { return false; }
}

export async function iniciarRegistroGoogle() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: {
      redirectTo: `${window.location.origin}/registro?oauth=google`, scopes: 'email profile',
    } });
    return error ? { ok: false, error: 'No pudimos abrir Google. Podés continuar con tu email.' } : { ok: true };
  } catch { return { ok: false, error: 'No pudimos conectar con Google. Volvé a intentarlo.' }; }
}

export async function cuentaGoogleActual() {
  try {
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user;
    const esGoogle = user?.identities?.some(i => i.provider === 'google');
    if (error || !user?.email || !user.email_confirmed_at || !esGoogle) return { ok: false, error: 'No se completó el acceso con Google. Podés volver a intentarlo o usar tu email.' };
    return { ok: true, email: user.email, nombre: user.user_metadata?.full_name || '' };
  } catch { return { ok: false, error: 'No pudimos verificar tu cuenta de Google. Intentá de nuevo.' }; }
}

/** Google ya verifico el correo. Los datos del negocio se confirman aparte. */
export async function registrarNegocioConGoogle(datos) {
  const { fullName } = datos;
  const cuenta = await cuentaGoogleActual();
  if (!cuenta.ok) return cuenta;
  const nombre = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (nombre.length < 2) return { ok: false, error: 'Tu nombre es obligatorio' };
  try {
    const { error } = await supabase.auth.updateUser({ data: metadataDelAlta({ ...datos, fullName: nombre }) });
    return error ? { ok: false, error: traducirError(error.message) } : { ok: true, needsConfirmation: false };
  } catch { return { ok: false, error: 'No pudimos guardar tu negocio. Tus datos siguen acá para reintentar.' }; }
}


// Mismo contrato de negocio para correo y Google; la RPC lo revalida.
function metadataDelAlta({ bizName, vertical, slug, fullName, operationMode, country, currency, timezone, channels, diagnostico, plan, periodo }) {
  return {
    biz_name: bizName, vertical, slug: String(slug || '').toLowerCase(), full_name: fullName,
    operation_mode: operationMode || null, country: country || null,
    currency: currency || null, timezone: timezone || null,
    channels: Array.isArray(channels) ? channels : [],
    diagnostico: UUID.test(String(diagnostico || '')) ? diagnostico : null,
    ...preferenciaDePlan(plan, periodo),
  };
}
