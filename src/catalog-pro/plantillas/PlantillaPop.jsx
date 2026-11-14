// src/catalog-pro/plantillas/PlantillaPop.jsx
// PROVISORIO (commit 5): la plantilla `pop` se construye en el commit 6 con
// /diseno. Hasta entonces delega en la portada de siempre para que el switch,
// la guardia y los tests de regresion ya existan.
import HomeScreen from "../HomeScreen";

export default function PlantillaPop({ config: _config, ...props }) {
  return <HomeScreen {...props} />;
}
