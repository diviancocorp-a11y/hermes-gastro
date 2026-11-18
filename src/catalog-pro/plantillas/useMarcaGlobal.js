// src/catalog-pro/plantillas/useMarcaGlobal.js
// La marca de una plantilla tambien tiene que llegar a las pantallas que no son
// la portada (ficha, carrito, checkout, confirmacion): todas son `.cp-root` y se
// pintan con el tema del tenant. Mientras la plantilla activa tenga marca, se
// emite UNA hoja con sus tokens sobre `.cp-root` (mas especifica que el tema).
// Sin plantilla, o con la `default`, no hace nada: los demas tenants no cambian.
import { useEffect, useMemo } from "react";
import { leerConfigPlantilla, resolverPlantilla } from "../../lib/plantillaConfig";
import { marcaATokens, urlFuentes } from "./marcaATokens";

export function reglaMarcaGlobal(settings) {
  if (resolverPlantilla(settings?.catalog_template) === "default") return null;
  const { config, error } = leerConfigPlantilla(settings?.catalog_template_config);
  if (error || !config?.marca) return null;
  const tokens = marcaATokens(config.marca, settings.catalog_theme);
  const cuerpo = Object.entries(tokens).map(([k, v]) => `${k}:${v}`).join(";");
  if (!cuerpo) return null;
  // Titulos de las pantallas del pedido con el mismo peso que los de la portada.
  const css = `body[data-cp-theme] .cp-root.cp-root{${cuerpo}}body[data-cp-theme] .cp-root.cp-root :is(h1,h2,h3){font-weight:800;letter-spacing:-0.02em}`;
  return { css, fuentes: urlFuentes(config.marca) };
}

export default function useMarcaGlobal(settings) {
  const regla = useMemo(
    () => reglaMarcaGlobal(settings),
    [settings?.catalog_template, settings?.catalog_template_config, settings?.catalog_theme],
  );
  useEffect(() => {
    if (!regla) return undefined;
    const nodos = [];
    const estilo = document.createElement("style");
    estilo.setAttribute("data-pop-marca", "1");
    estilo.textContent = regla.css;
    document.head.appendChild(estilo);
    nodos.push(estilo);
    if (regla.fuentes) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = regla.fuentes;
      link.setAttribute("data-pop-fuentes-global", "1");
      document.head.appendChild(link);
      nodos.push(link);
    }
    return () => nodos.forEach((n) => n.remove());
  }, [regla]);
}
