/**
 * AdminBackdrop — fondo del admin (jun 2026, v3).
 * Diseno adaptado del patron "background snippets" (grilla + radial)
 * al stack propio: CSS plano, tokens por tema.
 *
 *   · Grilla de lineas finas (estatica — costo cero).
 *   · Dos resplandores radiales AMBAR que derivan lento por transform:
 *     animacion compositor-friendly, no repinta nada (la v2 animaba el
 *     dash de 48 trazos SVG y saturaba el render).
 *
 * Se monta UNA vez como child del contenedor con .ag-root, detras de
 * todo el contenido. El login NO usa esta capa.
 */
import { memo } from 'react'

function AdminBackdrop() {
  return (
    <div className="ag-bg-layer" aria-hidden="true">
      <div className="ag-bg-grid" />
      <div className="ag-bg-glow g1" />
      <div className="ag-bg-glow g2" />
    </div>
  )
}

export default memo(AdminBackdrop)
