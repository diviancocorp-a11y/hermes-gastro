// src/catalog-pro/plantillas/cochi/PlantillaCochi.jsx
// Plantilla EXCLUSIVA de Cochi (settings.catalog_template = 'cochi'). Es pop con
// las secciones que el disenador de Cochi reemplaza. Esta carpeta es su espacio:
// ver LEEME.md. Hoy no reemplaza nada, asi que se ve igual que pop.
import "./cochi.css";
import PlantillaPop from "../PlantillaPop";

// Registro de secciones propias. Clave = nombre de la seccion en PlantillaPop
// (Intro, Header, Hero, Cinta, Favoritos, Flyers, Menu, Submarca, Banda,
// Testimonios, Historia, Footer); valor = tu componente CochiXxx.
// Constante de modulo: no la muevas dentro del componente.
const COMPONENTES = {};

export default function PlantillaCochi(props) {
  return <PlantillaPop {...props} componentes={COMPONENTES} className="plantilla-cochi" />;
}
