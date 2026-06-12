/**
 * AdminBackdrop — fondo del admin con "paths flotantes" (jun 2026).
 * Diseno adaptado del patron "background paths" (framer-motion) al stack
 * propio: CSS plano. El flujo de trazo (pathLength/pathOffset del original)
 * se recrea con pathLength="1" + stroke-dasharray/dashoffset animados, y
 * el pulso de opacidad con un keyframe aparte.
 *
 * Dos capas espejadas (position 1 y -1) de 24 curvas cada una (el original
 * usa 36; bajamos la cuenta y escalamos el espaciado para cuidar el
 * rendimiento en el telefono donde vive el admin).
 *
 * Tema claro: trazos tinta calida. Tema oscuro: trazos ambar.
 * El login NO usa esta capa (tiene su propio FlowFieldBackground).
 */
import { memo } from 'react'

const COUNT = 24

function buildPaths(position) {
  return Array.from({ length: COUNT }, (_, i) => {
    const t = i * 1.5 // compensa que usamos 24 en vez de 36
    return {
      id: i,
      d: `M-${380 - t * 5 * position} -${189 + t * 6}C-${380 - t * 5 * position} -${189 + t * 6} -${312 - t * 5 * position} ${216 - t * 6} ${152 - t * 5 * position} ${343 - t * 6}C${616 - t * 5 * position} ${470 - t * 6} ${684 - t * 5 * position} ${875 - t * 6} ${684 - t * 5 * position} ${875 - t * 6}`,
      width: 0.5 + t * 0.03,
      opacity: Math.min(0.1 + t * 0.03, 0.95),
      dur: 22 + ((i * 7) % 14), // 22-35s, determinístico (sin Math.random en render)
    }
  })
}

const LAYER_A = buildPaths(1)
const LAYER_B = buildPaths(-1)

function FloatingPaths({ paths }) {
  return (
    <svg className="ag-fp-svg" viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {paths.map((p) => (
        <path
          key={p.id}
          className="ag-fp"
          d={p.d}
          pathLength="1"
          stroke="currentColor"
          strokeWidth={p.width}
          strokeOpacity={p.opacity}
          style={{ '--fp-d': `${p.dur}s` }}
        />
      ))}
    </svg>
  )
}

function AdminBackdrop() {
  return (
    <div className="ag-bg-layer" aria-hidden="true">
      <FloatingPaths paths={LAYER_A} />
      <FloatingPaths paths={LAYER_B} />
    </div>
  )
}

export default memo(AdminBackdrop)
