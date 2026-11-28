// src/catalog-pro/plantillas/plantillasCargables.js
// Mapa unico nombre -> componente de las plantillas con portada propia. Lo usan
// HomeConPlantilla (el catalogo) y VistaPreviaPlantilla (el editor del panel):
// una plantilla nueva se suma aca y en plantillaListas.js, nada mas.
// Cada una es un chunk aparte: el catalogo de los demas tenants no la baja.
import { lazyReload } from "../../lib/lazyReload";

export const PLANTILLAS_CARGABLES = {
  pop: lazyReload(() => import("./PlantillaPop")),
  cochi: lazyReload(() => import("./cochi/PlantillaCochi")),
};
