// src/catalog-pro/useCatalogMusic.js
// Estado de la musica del catalogo para los controles de cualquier plantilla
// (clasica y pop). No guarda estado propio: lee y suscribe a catalogMusic.js,
// que es el singleton, asi el header y el footer siempre coinciden.
// No arranca la musica: eso lo hace Catalog.jsx (configureMusic + ensureMusic).
// Asi la vista previa del editor, que monta la plantilla en el panel, no suena.
import { useSyncExternalStore } from "react";
import { toggleMusic, musicOn, subscribeMusic } from "./catalogMusic";

export default function useCatalogMusic() {
  const on = useSyncExternalStore(subscribeMusic, musicOn, musicOn);
  return [on, toggleMusic];
}
