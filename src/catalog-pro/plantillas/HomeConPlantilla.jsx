// src/catalog-pro/plantillas/HomeConPlantilla.jsx
// Unico punto donde el catalogo elige entre la portada de siempre (HomeScreen)
// y una plantilla. Recibe EXACTAMENTE las props de HomeScreen y las reenvia.
//
// - `default` (o ausente, o desconocida): HomeScreen, sin tocar nada.
// - Config rota: HomeScreen y un aviso a Sentry. Nunca una pantalla en blanco.
// - Plantilla que lanza al renderizar: la guardia cae a HomeScreen y reporta.
// - La plantilla es un chunk aparte: el catalogo de los demas tenants no lo baja.
import { Component, Suspense, useEffect, useMemo } from "react";
import HomeScreen from "../HomeScreen";
import { lazyReload } from "../../lib/lazyReload";
import { captureException, captureMessage } from "../../lib/observability";
import { leerConfigPlantilla, resolverPlantilla } from "../../lib/plantillaConfig";

const PlantillaPop = lazyReload(() => import("./PlantillaPop"));
const PLANTILLAS_CARGABLES = { pop: PlantillaPop };

class Guardia extends Component {
  state = { fallo: false };
  static getDerivedStateFromError() { return { fallo: true }; }
  componentDidCatch(error, info) {
    captureException(error, { tags: { source: "plantilla-catalogo" }, extra: { componentStack: info?.componentStack } });
  }
  render() { return this.state.fallo ? this.props.fallback : this.props.children; }
}

export default function HomeConPlantilla(props) {
  const { settings } = props;
  const plantilla = resolverPlantilla(settings?.catalog_template);
  const { config, error } = useMemo(
    () => leerConfigPlantilla(settings?.catalog_template_config),
    [settings?.catalog_template_config],
  );

  useEffect(() => {
    if (plantilla !== "default" && error) {
      captureMessage(`Config de plantilla invalida: ${error}`, "warning", { tags: { source: "plantilla-catalogo" } });
    }
  }, [plantilla, error]);

  const clasica = <HomeScreen {...props} />;
  const Plantilla = PLANTILLAS_CARGABLES[plantilla];
  if (!Plantilla || error) return clasica;

  return (
    <Guardia fallback={clasica}>
      <Suspense fallback={<div className="cp-root" style={{ minHeight: "100dvh", background: "var(--bg)" }} aria-busy="true" />}>
        <Plantilla {...props} config={config} />
      </Suspense>
    </Guardia>
  );
}
