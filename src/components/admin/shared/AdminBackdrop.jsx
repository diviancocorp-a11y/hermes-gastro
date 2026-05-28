/**
 * AdminBackdrop — capa de fondo decorativa (blobs + topo)
 * Se monta UNA vez como child del contenedor con .ag-root,
 * detrás de todo el contenido (z-index 0).
 *
 * Animaciones se respetan según prefers-reduced-motion (en CSS).
 */
import { memo } from 'react'

function AdminBackdrop() {
  return (
    <div className="ag-bg-layer" aria-hidden="true">
      <div className="ag-blob b1" />
      <div className="ag-blob b2" />
      <div className="ag-blob b3" />
      <div className="ag-blob b4" />
      <svg className="ag-topo" viewBox="0 0 360 800" preserveAspectRatio="none">
        {/* Valle 1 */}
        <path d="M -40 80  Q 60 30  160 90  T 360 60   T 540 100"/>
        <path d="M -40 100 Q 60 50  160 110 T 360 80   T 540 120"/>
        <path d="M -40 120 Q 60 70  160 130 T 360 100  T 540 140"/>
        <path d="M -40 140 Q 60 90  160 150 T 360 120  T 540 160"/>
        <path d="M -40 160 Q 60 110 160 170 T 360 140  T 540 180"/>
        <path d="M -40 180 Q 60 130 160 190 T 360 160  T 540 200"/>
        {/* Valle 2 */}
        <path d="M -40 250 Q 80 310  200 240 T 380 290 T 560 250"/>
        <path d="M -40 270 Q 80 330  200 260 T 380 310 T 560 270"/>
        <path d="M -40 290 Q 80 350  200 280 T 380 330 T 560 290"/>
        <path d="M -40 310 Q 80 370  200 300 T 380 350 T 560 310"/>
        <path d="M -40 330 Q 80 390  200 320 T 380 370 T 560 330"/>
        <path d="M -40 350 Q 80 410  200 340 T 380 390 T 560 350"/>
        {/* Valle 3 */}
        <path d="M -40 440 Q 100 380 220 460 T 400 410 T 580 470"/>
        <path d="M -40 460 Q 100 400 220 480 T 400 430 T 580 490"/>
        <path d="M -40 480 Q 100 420 220 500 T 400 450 T 580 510"/>
        <path d="M -40 500 Q 100 440 220 520 T 400 470 T 580 530"/>
        <path d="M -40 520 Q 100 460 220 540 T 400 490 T 580 550"/>
        <path d="M -40 540 Q 100 480 220 560 T 400 510 T 580 570"/>
        {/* Valle 4 */}
        <path d="M -40 640 Q 70 700  170 630 T 350 680 T 540 640"/>
        <path d="M -40 660 Q 70 720  170 650 T 350 700 T 540 660"/>
        <path d="M -40 680 Q 70 740  170 670 T 350 720 T 540 680"/>
        <path d="M -40 700 Q 70 760  170 690 T 350 740 T 540 700"/>
        <path d="M -40 720 Q 70 780  170 710 T 350 760 T 540 720"/>
        <path d="M -40 740 Q 70 800  170 730 T 350 780 T 540 740"/>
        <path d="M -40 760 Q 70 820  170 750 T 350 800 T 540 760"/>
      </svg>
    </div>
  )
}

export default memo(AdminBackdrop)
