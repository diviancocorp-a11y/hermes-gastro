/**
 * AdminBackdrop — fondo del admin con gradiente animado (jun 2026).
 * Diseno adaptado del patron "background gradient animation" al stack
 * propio: CSS plano, sin Tailwind. Luces AMBAR (la marca Hermes) que
 * orbitan detras de un difuminado fuerte, sobre un degradado base que
 * cambia con el tema claro/oscuro.
 *
 * Se monta UNA vez como child del contenedor con .ag-root, detras de
 * todo el contenido (z-index 0). El login NO usa esta capa (tiene su
 * propio FlowFieldBackground).
 *
 * Animaciones respetan prefers-reduced-motion (en CSS).
 */
import { memo } from 'react'

function AdminBackdrop() {
  return (
    <div className="ag-bg-layer" aria-hidden="true">
      <div className="ag-bg-blobs">
        <div className="ag-gb g1" />
        <div className="ag-gb g2" />
        <div className="ag-gb g3" />
        <div className="ag-gb g4" />
        <div className="ag-gb g5" />
      </div>
    </div>
  )
}

export default memo(AdminBackdrop)
