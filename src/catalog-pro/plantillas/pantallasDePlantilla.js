// src/catalog-pro/plantillas/pantallasDePlantilla.js
// Estetica de las pantallas del pedido (ficha, carrito, checkout, confirmando,
// pedido recibido, seguimiento) para una plantilla EXCLUSIVA.
//
// El disenador de la plantilla cambia COMO SE VE, nunca QUE HACE: las pantallas
// siguen siendo nuestras y solo reciben (1) la marca `html[data-plantilla]` para
// que su CSS las apunte con `[data-pantalla]` / `[data-parte]`, y (2) capas
// decorativas sin datos ni callbacks (ver CapaDePlantilla.jsx).
//
// Para los demas tenants no pasa nada: ni atributo en <html>, ni chunk, ni request.
import { createContext, useContext, useEffect, useState } from "react";
import { PLANTILLAS_EXCLUSIVAS } from "../../lib/plantillaListas";
import { resolveTenantSlug } from "../../lib/activeTenant";

// Un chunk aparte por plantilla: ningun otro tenant lo baja.
export const CARGADORES = { cochi: () => import("./cochi/pantallas.js") };

const SIN_DECORACIONES = Object.freeze({});

export const PantallasDePlantillaContext = createContext(SIN_DECORACIONES);

/** Decoraciones activas (objeto lugar -> componente); `{}` si no hay. */
export const useDecoraciones = () => useContext(PantallasDePlantillaContext);

/** La plantilla esta activa solo si es exclusiva Y el tenant es su dueno. */
export function plantillaActiva(plantilla, slug) {
  return Boolean(plantilla && slug && PLANTILLAS_EXCLUSIVAS[plantilla] === slug && CARGADORES[plantilla]);
}

/**
 * Plantilla exclusiva que le corresponde a un tenant, o null. Sirve donde no hay
 * `settings` (el seguimiento `/order/:id` vive fuera del catalogo): ahi la
 * plantilla se deduce del tenant, no se lee de la base.
 */
export function plantillaExclusivaDe(slug) {
  if (!slug) return null;
  return Object.keys(PLANTILLAS_EXCLUSIVAS).find((p) => PLANTILLAS_EXCLUSIVAS[p] === slug) || null;
}

/** Slug del tenant de esta carga (null hasta resolverlo). */
export function useSlugDelTenant() {
  const [slug, setSlug] = useState(null);
  useEffect(() => {
    let vivo = true;
    Promise.resolve(resolveTenantSlug?.())
      .then((s) => { if (vivo) setSlug(s || null); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  return slug;
}

/**
 * Marca `<html data-plantilla>` y carga las decoraciones mientras la plantilla
 * este activa. Con otra plantilla u otro tenant no hace nada (ni baja el chunk).
 * @returns {Record<string, Function>} lugar -> componente (o `{}`)
 */
export default function usePantallasDePlantilla({ plantilla, slug } = {}) {
  const activa = plantillaActiva(plantilla, slug) ? plantilla : null;
  const [cargado, setCargado] = useState({ plantilla: null, decoraciones: SIN_DECORACIONES });

  useEffect(() => {
    if (!activa) return undefined;
    let vivo = true;
    document.documentElement.dataset.plantilla = activa;
    CARGADORES[activa]()
      .then((mod) => {
        if (vivo) setCargado({ plantilla: activa, decoraciones: mod?.DECORACIONES || SIN_DECORACIONES });
      })
      .catch(() => { /* sin chunk no hay capa: la pantalla funciona igual */ });
    return () => {
      vivo = false;
      if (document.documentElement.dataset.plantilla === activa) delete document.documentElement.dataset.plantilla;
    };
  }, [activa]);

  return activa && cargado.plantilla === activa ? cargado.decoraciones : SIN_DECORACIONES;
}
