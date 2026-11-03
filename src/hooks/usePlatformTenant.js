// src/hooks/usePlatformTenant.js
// Sesion + tenant + rol para el panel del edificio.
//
// Junta en un solo hook lo que en el legacy estaba partido entre useAdminData
// (sesion) y useAdminGate (rol), porque en la plataforma las dos preguntas son
// la misma: "este usuario, en ESTE host, que puede hacer".
//
// El gate real es RLS: fetchMyTenant devuelve fila solo si el usuario es
// miembro del tenant del host. Aca no se decide nada de seguridad, se decide
// que pantalla mostrar.
//
// status:
//   'checking'  · resolviendo
//   'anon'      · sin sesion -> login
//   'no-tenant' · el host no corresponde a ningun tenant (raiz, preview)
//   'denied'    · hay sesion pero no es miembro de este tenant
//   'ok'        · adentro
//
// intro / terminarIntro: el intro de Dico (IntroDico) se ve al abrir el negocio
// SOLO cuando hubo un login de verdad: la persona entro por el login del admin
// (`doLogin`) o llego por el traspaso desde /entrar. Una sesion que ya estaba
// abierta (reabrir la ventana, F5, volver a la pestana) NUNCA lo enciende.

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getSession, logout } from '../services/auth';
import { fetchMyTenant } from '../services/platformAdmin';
import { tomarTraspaso, CLAVE_TRASPASO } from '../services/entradaUnica';
import { captureException } from '../lib/observability.js';
import { resumenDeSuscripcion } from '../modules/suscripcion';

export default function usePlatformTenant() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [role, setRole] = useState(null);
  // 6f: una persona puede tener varios roles, y en varias sucursales.
  const [roles, setRoles] = useState([]);
  const [branchIds, setBranchIds] = useState([]);
  const [gate, setGate] = useState('checking'); // 'checking' | 'ok' | 'denied' | 'no-tenant'
  const alive = useRef(true);
  // Sincronico y desde el primer render: si la URL trae el traspaso el intro ya
  // esta encendido, y no parpadea un "Cargando..." antes. Si el token resulta
  // invalido, mas abajo se apaga.
  const [intro, setIntro] = useState(() => {
    try { return (window.location.hash || '').includes(`${CLAVE_TRASPASO}=`); } catch { return false; }
  });
  // El traspaso se consume UNA vez: el efecto corre dos veces en StrictMode y la
  // segunda encontraria el hash ya borrado (y apagaria el intro).
  const traspaso = useRef(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // ── Sesion ──
  useEffect(() => {
    // Si llegamos desde divianco.app/entrar, la sesion viene en el hash: se toma
    // ANTES de preguntar si hay una, o el panel mostraria el login un instante.
    if (!traspaso.current) traspaso.current = tomarTraspaso();
    traspaso.current
      .then(abrio => {
        if (alive.current) setIntro(abrio === true);
        return getSession();
      })
      .then(s => {
        if (!alive.current) return;
        setSession(s);
        if (!s) setIntro(false);
        setCheckingSession(false);
      })
      .catch(err => {
        // Si Supabase falla en boot no dejamos la pantalla colgada: cae a login.
        captureException(err, { tags: { source: 'usePlatformTenant.getSession' } });
        if (alive.current) { setSession(null); setIntro(false); setCheckingSession(false); }
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (alive.current) setSession(s);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // ── Tenant + rol (depende de la sesion) ──
  const loadTenant = useCallback(async () => {
    if (!session) {
      setTenant(null); setRole(null); setRoles([]); setBranchIds([]);
      setGate('checking');
      return;
    }
    const { tenant: t, role: r, roles: rs, branchIds: bs, reason } = await fetchMyTenant();
    if (!alive.current) return;
    setTenant(t);
    setRole(r);
    setRoles(rs || []);
    setBranchIds(bs || []);
    if (t) setGate('ok');
    else if (reason === 'no-slug') setGate('no-tenant');
    else setGate('denied');
  }, [session]);

  useEffect(() => { loadTenant(); }, [loadTenant]);

  const doLogin = useCallback(async () => {
    // Login de verdad: se abre el negocio con el intro. Se enciende ANTES de
    // esperar la sesion, o se veria un instante el panel (o "Cargando...")
    // antes del overlay; si no hay sesion, se apaga.
    setIntro(true);
    const s = await getSession();
    if (!alive.current) return;
    setSession(s);
    if (!s) setIntro(false);
  }, []);

  // Si la sesion se pierde con el intro activo (otra pestana cerro sesion), un
  // login posterior sin pasar por doLogin no tiene que heredar la bandera.
  useEffect(() => {
    if (!checkingSession && !session) setIntro(false);
  }, [checkingSession, session]);

  const terminarIntro = useCallback(() => {
    if (alive.current) setIntro(false);
  }, []);

  const doLogout = useCallback(async () => {
    await logout();
    if (!alive.current) return;
    setSession(null);
    setIntro(false);
    setTenant(null);
    setRole(null);
    setRoles([]);
    setBranchIds([]);
    setGate('checking');
  }, []);

  const status = checkingSession ? 'checking' : (!session ? 'anon' : gate);

  return {
    session, tenant, role, roles, branchIds, status,
    // Suscripcion en SOLO LECTURA: que plan tiene y como viene la fecha.
    // Todavia no recorta nada — `suscripcion.puedeOperar` sale de
    // `tenants.status`, que lo escribe el server. Ver src/modules/suscripcion.js
    // para el orden en que se va a ir encendiendo.
    suscripcion: resumenDeSuscripcion(tenant),
    isOwner: roles.includes('owner') || role === 'owner',
    // Lista vacia = sin limite de sucursal (el caso del duenio).
    todasLasSucursales: branchIds.length === 0,
    doLogin, doLogout, reloadTenant: loadTenant,
    intro, terminarIntro,
  };
}
