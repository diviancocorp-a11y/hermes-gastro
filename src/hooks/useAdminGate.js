// src/hooks/useAdminGate.js
// Gate de acceso al panel admin (12/jun 2026).
//
// Problema que resuelve: cualquier usuario con cuenta (ej: alguien que
// registro su correo en el catalogo publico) podia ENTRAR a /admin porque
// el unico check era "tiene sesion". RLS bloqueaba los writes (por eso
// "no se guardaba nada") pero la UI cargaba igual.
//
// Regla: es admin quien tiene fila en admin_users (owner/staff). Un usuario
// de catalogo NO tiene fila -> denied. No existe rol "cliente" en admin_users
// a proposito: cliente = ausencia de fila.
//
// Devuelve:
//   { status: 'checking' | 'ok' | 'denied', role: 'owner' | 'staff' | null }
//
// Nota: esto es UX, no seguridad. La seguridad real son las policies
// is_admin()/is_owner() en la DB (Sprint 1).

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function useAdminGate(userId) {
  const [state, setState] = useState({ status: 'checking', role: null });

  useEffect(() => {
    let alive = true;
    if (!userId) {
      setState({ status: 'checking', role: null });
      return undefined;
    }
    supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        // Sin fila o error de lectura (RLS) -> no es admin.
        if (error || !data?.role) setState({ status: 'denied', role: null });
        else setState({ status: 'ok', role: data.role });
      });
    return () => { alive = false; };
  }, [userId]);

  return state;
}
