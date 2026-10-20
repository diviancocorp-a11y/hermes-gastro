import { lazy } from 'react'
import { hardReload } from './hardReload'

// lazy con auto-recuperacion (fix HERMES-GASTRO-8, 11/jun): si el usuario
// tiene la app abierta de ANTES de un deploy, el chunk viejo ya no existe y
// el import dinamico falla ("Failed to fetch dynamically imported module").
// Solucion: recargar la pagina UNA vez (trae el HTML nuevo con hashes nuevos).
// El guard en sessionStorage evita loops si el error es otro.
//
// Vivia en App.jsx; salio aca el 20/oct para que lo usen tambien los paneles
// de PlatformAdmin, que eran lazy pelados (HERMES-GASTRO-S, Monare).

export function cargarConRescate(importer) {
  return importer().catch((err) => {
    try {
      // Maximo 1 recarga cada 60s: recupera tras cada deploy nuevo pero
      // nunca entra en loop si el fallo es persistente
      const last = Number(sessionStorage.getItem('hg_chunk_reload') || 0)
      if (Date.now() - last > 60000) {
        sessionStorage.setItem('hg_chunk_reload', String(Date.now()))
        // hardReload y no location.reload(): si el chunk fallo por un deploy
        // nuevo, el SW todavia tiene cacheado el index.html viejo que apunta
        // a ese mismo chunk inexistente. Recargar a secas repite el error y
        // el guard de 60s deja al usuario con la pantalla rota.
        hardReload()
        return new Promise(() => {}) // la recarga interrumpe; no renderizar nada
      }
    } catch { /* sin storage: dejar que el error suba al ErrorBoundary */ }
    throw err
  })
}

export function lazyReload(importer) {
  return lazy(() => cargarConRescate(importer))
}
