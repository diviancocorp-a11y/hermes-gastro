// src/catalog-pro/plantillas/VistaPreviaPlantilla.jsx
// Vista previa en vivo de la plantilla elegida (`pop`, `cochi`) para el editor del panel.
// Vive aca y no en components/admin porque PlantillaPop exige `cp-root` y los
// tokens del catalogo, y el panel tiene prohibido `cp-root` (pinta fondo blanco
// y tapa los --ag-*). Un marco de 390 px aisla uno del otro.
//
// El tema del tenant (body[data-cp-theme]) no aplica fuera del catalogo: se
// completan los colores de la marca con los del tema base para que
// marcaATokens emita TODOS los tokens sobre el propio wrapper de la plantilla.
//
// Sin interaccion: el contenido va `inert` (sin foco ni clicks), sin carrito,
// sin navegar y sin la intro animada.
import { Suspense, useMemo } from "react";
import { TEMAS_BASE } from "./marcaATokens";
import { PLANTILLAS_CARGABLES } from "./plantillasCargables";

const nada = () => {};

export default function VistaPreviaPlantilla({ settings = {}, config = {}, products = [], categories = [], store, completa = false, plantilla = "pop" }) {
  const Plantilla = PLANTILLAS_CARGABLES[plantilla] || PLANTILLAS_CARGABLES.pop;
  const tema = TEMAS_BASE[settings.catalog_theme] ? settings.catalog_theme : "ambar";
  const base = TEMAS_BASE[tema];
  const configVista = useMemo(() => ({
    ...config,
    intro: false,
    marca: { primario: base.ac, fondo: base.bg, texto: base.tx, ...(config.marca || {}) },
  }), [config, base]);
  const tienda = store || { name: settings.biz_name || "Tu negocio", isOpen: true };
  return (
    <div className={completa ? "vp-completa" : "vp-marco"} data-testid="vista-previa-contenido">
      <div className="vp-contenido" inert aria-hidden="true">
        <Suspense fallback={<div className="vp-cargando">Cargando vista previa…</div>}>
          <Plantilla
            config={configVista} settings={settings} products={products} categories={categories} store={tienda}
            cart={[]} cartCount={0} cartTotal={0}
            onAddToCart={nada} onDecCart={nada} onOpenCart={nada} onSelectProduct={nada}
          />
        </Suspense>
      </div>
    </div>
  );
}
