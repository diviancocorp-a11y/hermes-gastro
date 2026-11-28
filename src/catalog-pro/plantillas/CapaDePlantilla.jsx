// src/catalog-pro/plantillas/CapaDePlantilla.jsx
// Lugar donde el disenador de una plantilla exclusiva puede poner una capa
// DECORATIVA (ilustracion, animacion de fondo) en una pantalla del pedido.
//
// Garantias, para que lo decorativo no pueda cambiar lo que hace la pantalla:
// - detras del contenido (z-index -1), `aria-hidden`, `inert` y sin eventos;
// - recibe `datos` congelados, SOLO valores para mostrar (nunca callbacks);
// - si la decoracion tira un error, no se muestra nada y se reporta a Sentry.
import { Component } from "react";
import { useDecoraciones } from "./pantallasDePlantilla";
import { captureException } from "../../lib/observability";
import "./capaDePlantilla.css";

class Guardia extends Component {
  state = { fallo: false };
  static getDerivedStateFromError() { return { fallo: true }; }
  componentDidCatch(error, info) {
    captureException(error, {
      tags: { source: "capa-plantilla", lugar: this.props.lugar },
      extra: { componentStack: info?.componentStack },
    });
  }
  render() { return this.state.fallo ? null : this.props.children; }
}

export default function CapaDePlantilla({ lugar, datos }) {
  const Decoracion = useDecoraciones()[lugar];
  if (!Decoracion) return null;
  return (
    <div className="capa-plantilla" data-capa={lugar} aria-hidden="true" inert>
      <Guardia lugar={lugar}>
        <Decoracion datos={Object.freeze({ ...(datos || {}) })} />
      </Guardia>
    </div>
  );
}
