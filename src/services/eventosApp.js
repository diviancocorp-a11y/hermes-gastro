// src/services/eventosApp.js
// Eventos de uso del panel, guardados en el edificio (tabla eventos_app, 0124).
//
// Los lee GerenteDico (herramienta `eventos`) y morning-health. trackEvent
// (lib/observability) no sirve para esto: manda a Plausible solo con
// VITE_ANALYTICS_ID, y produccion no lo tiene.
//
// Este archivo esta en PLATFORM_PATHS (scripts/check-supabase-columns.mjs).

import { supabase } from '../lib/supabase';
import { resolveTenantId } from '../lib/activeTenant';

// Los unicos que se guardan. La base solo exige el formato del nombre: sumar
// uno se hace aca, sin migracion.
export const EVENTOS = new Set(['plan-bloqueo-visto', 'plan-bloqueo-click']);

/**
 * Guarda un evento del negocio del host. Nunca tira: la analitica no puede
 * romper la pantalla. Devuelve si se guardo.
 */
export async function registrarEvento(nombre, props = {}) {
  if (!EVENTOS.has(nombre)) return false;
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) return false;
    const { error } = await supabase.from('eventos_app').insert({ tenant_id: tenantId, nombre, props });
    return !error;
  } catch {
    return false;
  }
}
