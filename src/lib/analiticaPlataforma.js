// src/lib/analiticaPlataforma.js
// Vercel Web Analytics para la PLATAFORMA (landing, /registro, /bienvenido).
//
// Sin dependencia: Vercel sirve el script en /_vercel/insights/script.js
// cuando Analytics esta activado en el proyecto (panel > Analytics > Enable).
// Sin activarlo el script da 404 y no pasa nada mas.
//
// Solo se carga fuera de los subdominios de tenant: el plan Hobby trae 50.000
// eventos por mes para toda la cuenta, y los catalogos se los comerian.
//
// Hobby NO tiene eventos propios (track). Por eso las acciones que no cambian
// de ruta (clic en WhatsApp, alta enviada) se mandan como visita virtual a
// /evento/<nombre>: en el panel aparecen como una pagina mas. Si la cuenta
// pasa a Pro, esto se puede cambiar por va('event', ...).
//
// OJO: despues de una visita virtual el script de Vercel se queda con ese
// path para las visitas siguientes que hagan pushState. Hoy no pasa porque
// landing, registro y bienvenida salen siempre con recarga completa (<a href>
// o location.href), que reinicia el script. Si alguna pasa a navegar con
// react-router, esto cuenta mal.

import { classifyHost } from './tenantHost';

const SRC = '/_vercel/insights/script.js';

/** Decide por host: si, en la raiz y en *.vercel.app; no en tenants, local,
 *  subdominios reservados ni dominios propios (todo eso gasta la cuota). */
export function analiticaHabilitada(host, prod = import.meta.env.PROD) {
  if (!prod || !host) return false;
  return classifyHost(host).kind === 'root' || host.endsWith('.vercel.app');
}

function habilitada() {
  return typeof window !== 'undefined' && analiticaHabilitada(window.location.hostname);
}

/** Inserta el script una sola vez. Idempotente: cada pantalla lo llama. */
export function cargarAnalitica() {
  if (!habilitada()) return;
  window.va = window.va || function va(...args) { (window.vaq = window.vaq || []).push(args); };
  if (document.querySelector(`script[src="${SRC}"]`)) return;
  const s = document.createElement('script');
  s.src = SRC;
  s.defer = true;
  document.head.appendChild(s);
}

/** Visita virtual: /evento/<nombre>. Ver arriba por que no es un evento. */
export function marcarEvento(nombre) {
  if (!habilitada() || typeof window.va !== 'function') return;
  const path = `/evento/${nombre}`;
  window.va('pageview', { route: path, path });
}
