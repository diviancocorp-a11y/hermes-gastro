/**
 * OrderCard — card de pedido con swipe gesturizado + marco semáforo.
 *
 * Interacción:
 *   · Swipe derecha → ejecuta acción primaria (Aceptar / Marcar listo / Entregar)
 *     Aplica directo. Quien lo orqueste puede mostrar toast con "Deshacer".
 *   · Swipe izquierda → onCancel (la UI abre confirmación con motivo)
 *   · Tap en el kebab (···, esquina sup. der.) → expande los botones de respaldo
 *   · Tap en el chip verde de contacto → onContact (WhatsApp / phone)
 *
 * Marco semáforo según `minutes`:
 *   · 0-10 min  → calm (verde, sin pulso)
 *   · 10-20 min → alert (amarillo, pulso 2s)
 *   · > 20 min  → critical (rojo, pulso 0.7s)
 *
 * Props:
 *   order, onPrimary (=swipe der), onCancel (=swipe izq), onContact
 *   onGhost: legacy alias de onCancel cuando no se pasa onCancel
 *   actions: override opcional de los botones del menu expandido
 */
import { memo, useRef, useState } from 'react'

function ContactIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  )
}
function KebabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5"  r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  )
}
function CheckAvatar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ag-c-sales)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function XAvatar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ag-c-orders)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6"  y1="6" x2="18" y2="18" />
    </svg>
  )
}

const STATE_BY_STATUS = {
  new:       { class: 'ag-st-orders', badge: 'Nuevo',     next: 'Aceptar'      },
  prep:      { class: 'ag-st-prep',   badge: 'En prep.',  next: 'Marcar listo' },
  ready:     { class: 'ag-st-sales',  badge: 'Listo',     next: 'Entregar'     },
  done:      { class: 'ag-st-done',   badge: 'Entregado', next: null           },
  cancelled: { class: 'ag-st-orders', badge: 'Cancelado', next: null           },
}

const DEFAULT_ACTIONS = {
  new:   (h) => [
    { label: 'Rechazar',     variant: 'ghost',   onClick: h.onCancel },
    { label: 'Aceptar',      variant: 'primary', onClick: h.onPrimary },
  ],
  prep:  (h) => [
    { label: 'Cancelar',     variant: 'ghost',   onClick: h.onCancel },
    { label: 'Marcar listo', variant: 'primary', onClick: h.onPrimary },
  ],
  ready: (h) => [
    { label: 'Detalles',     variant: 'ghost',   onClick: h.onGhost  },
    { label: 'Entregar',     variant: 'primary', onClick: h.onPrimary },
  ],
  done:  (h) => [
    { label: 'Ver detalle',  variant: 'ghost',   onClick: h.onGhost  },
  ],
  // cancelled: sin accion primaria ni cancelar — solo consulta. Sin esta
  // entrada, DEFAULT_ACTIONS[status] era undefined y el buscador del panel
  // crasheaba al renderizar un pedido cancelado (HERMES-GASTRO-H).
  cancelled: (h) => [
    { label: 'Ver detalle',  variant: 'ghost',   onClick: h.onGhost  },
  ],
}

const SWIPE_LIMIT = 180     // px máximo de drag
const SWIPE_THRESHOLD = 100 // px para confirmar acción

function OrderCard({ order, actions, onPrimary, onCancel, onGhost, onContact }) {
  const status = order.status || 'new'
  const cfg = STATE_BY_STATUS[status] || STATE_BY_STATUS.new
  const minutes = order.minutes ?? 0

  // Pulso del marco según el tiempo desde creado
  const pulseLevel = minutes >= 20 ? 'critical' : minutes >= 10 ? 'alert' : 'calm'

  // ─── Avatar: ring + contenido según status ───
  // new/prep   → ring se llena con el tiempo · muestra minutos · color = semáforo
  // ready/done → ring lleno verde · check ✓
  // cancelled  → ring lleno rojo · X ✕
  const isFinished = status === 'done'      // entregado
  const isReady    = status === 'ready'
  const isCancel   = status === 'cancelled'

  let ringPct, ringColor, avContent
  if (isCancel) {
    ringPct = 100
    ringColor = 'var(--ag-c-orders)'
    avContent = <XAvatar />
  } else if (isReady || isFinished) {
    ringPct = 100
    ringColor = isFinished ? 'var(--ag-ink-3)' : 'var(--ag-c-sales)'
    avContent = <CheckAvatar />
  } else {
    // new/prep: tiempo transcurrido
    ringPct = Math.min(100, Math.round((minutes / 30) * 100))
    ringColor = pulseLevel === 'critical' ? 'var(--ag-c-orders)'
              : pulseLevel === 'alert'    ? 'var(--ag-c-stock)'
              : 'var(--ag-c-sales)'
    const timeLabel = minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`
    avContent = <span style={{ color: ringColor }}>{timeLabel}</span>
  }

  // ─── Swipe state ───
  const [dragX, setDragX] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const startX = useRef(0)
  const dragging = useRef(false)
  const cardRef = useRef(null)

  // Permisos de swipe según status
  const canSwipeRight = !!cfg.next && !!onPrimary                 // avanzar
  const canSwipeLeft  = status !== 'done' && (onCancel || onGhost) // cancelar

  // Acción onCancel: si no se pasa, fallback a onGhost (compat con uso viejo)
  const cancelFn = onCancel || onGhost

  // ─── Handlers comunes ───
  const beginDrag = (clientX) => {
    if (animating) return
    dragging.current = true
    startX.current = clientX
  }
  const moveDrag = (clientX) => {
    if (!dragging.current) return
    const raw = clientX - startX.current
    let limited = raw
    if (raw > 0 && !canSwipeRight) limited = 0
    if (raw < 0 && !canSwipeLeft) limited = 0
    if (limited > SWIPE_LIMIT)  limited = SWIPE_LIMIT
    if (limited < -SWIPE_LIMIT) limited = -SWIPE_LIMIT
    setDragX(limited)
  }
  const endDrag = () => {
    if (!dragging.current) return
    dragging.current = false
    const cardW = cardRef.current?.offsetWidth || 300

    if (dragX >= SWIPE_THRESHOLD && canSwipeRight) {
      setAnimating(true)
      setDragX(cardW)
      setTimeout(() => {
        onPrimary?.()
        setDragX(0)
        setAnimating(false)
      }, 200)
    } else if (dragX <= -SWIPE_THRESHOLD && canSwipeLeft) {
      setAnimating(true)
      setDragX(-cardW)
      setTimeout(() => {
        cancelFn?.()
        setDragX(0)
        setAnimating(false)
      }, 200)
    } else {
      setAnimating(true)
      setDragX(0)
      setTimeout(() => setAnimating(false), 200)
    }
  }

  // Touch handlers
  const onTouchStart = (e) => beginDrag(e.touches[0].clientX)
  const onTouchMove  = (e) => moveDrag(e.touches[0].clientX)
  const onTouchEnd   = endDrag

  // Mouse handlers (desktop drag)
  const onMouseDown = (e) => {
    // Solo si el target no es un botón interactivo
    if (e.target.closest('button, a, input')) return
    beginDrag(e.clientX)
  }
  const onMouseMove = (e) => {
    if (!dragging.current) return
    e.preventDefault()
    moveDrag(e.clientX)
  }
  const onMouseUp = endDrag

  // Contact fallback
  const handleContact = () => {
    if (onContact) return onContact(order)
    if (order.phone) {
      const phone = String(order.phone).replace(/\D/g, '')
      window.open(`https://wa.me/${phone}`, '_blank', 'noopener,noreferrer')
    }
  }

  // Acciones del menú expandido. Fallback defensivo: un status desconocido
  // no puede tirar abajo el listado entero (ErrorBoundary) nunca mas.
  const acts = actions || (DEFAULT_ACTIONS[status] || DEFAULT_ACTIONS.done)({ onPrimary, onCancel: cancelFn, onGhost })

  // Opacidades del reveal
  const revealLeftOpacity  = canSwipeRight && dragX > 0  ? Math.min(dragX / SWIPE_THRESHOLD, 1) : 0
  const revealRightOpacity = canSwipeLeft  && dragX < 0  ? Math.min(-dragX / SWIPE_THRESHOLD, 1) : 0

  return (
    <div className={`ag-o-wrap ag-o-pulse-${pulseLevel}`}>
      {/* Reveal de fondo izq (verde · acción primaria) */}
      {canSwipeRight && (
        <div className="ag-o-reveal ag-o-reveal-left" style={{ opacity: revealLeftOpacity }}>
          <CheckIcon />
          <span>{cfg.next}</span>
        </div>
      )}
      {/* Reveal de fondo der (rojo · cancelar) */}
      {canSwipeLeft && (
        <div className="ag-o-reveal ag-o-reveal-right" style={{ opacity: revealRightOpacity }}>
          <span>Cancelar</span>
          <XIcon />
        </div>
      )}

      <article
        ref={cardRef}
        className={`ag-o-card ${cfg.class}`}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: animating ? 'transform 200ms ease-out' : 'none',
          touchAction: 'pan-y',
          userSelect: dragging.current ? 'none' : 'auto',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => dragging.current && endDrag()}
      >
        <div className="ag-o-head">
          {/* Avatar: ring + tiempo en activos · check verde si listo/entregado · X roja si cancelado */}
          <div
            className="ag-o-av-ring"
            style={{
              background: `conic-gradient(${ringColor} ${ringPct}%, rgba(127,127,127,0.16) 0)`,
            }}
          >
            <div className="ag-o-av">{avContent}</div>
          </div>
          <div className="ag-o-who">
            <div className="ag-o-name">{order.customer}</div>
            <div className="ag-o-meta">
              <span>#{order.id}</span>
              <span className="sep">·</span>
              <span>{order.mode}{order.total ? ` · ${order.total}` : ''}</span>
            </div>
            {order.address && (
              <div className="ag-o-meta" style={{ marginTop: 2, fontSize: 12, opacity: 0.85, overflowWrap: 'anywhere' }}>
                <span aria-hidden="true">📍</span> <span>{order.address}</span>
              </div>
            )}
          </div>
          {/* Acciones uniformes arriba derecha: contacto + kebab */}
          <div className="ag-o-head-actions">
            <button
              type="button"
              className="ag-o-icon-btn ag-o-icon-contact"
              onClick={handleContact}
              aria-label={`Contactar a ${order.customer}`}
              title="Contactar cliente"
            >
              <ContactIcon size={14} />
            </button>
            <button
              type="button"
              className={`ag-o-icon-btn ag-o-kebab ${menuOpen ? 'on' : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Más acciones"
              aria-expanded={menuOpen}
            >
              <KebabIcon />
            </button>
          </div>
        </div>

        {order.items?.length > 0 && (
          <div className="ag-o-items">
            {order.items.map((it, i) => (
              <span key={i} className="ag-o-item">
                <span className="qty">{it.qty}×</span>{it.name}
              </span>
            ))}
          </div>
        )}

        {/* Hint centrado al fondo (solo cuando hay swipe disponible) */}
        {(canSwipeRight || canSwipeLeft) && (
          <div className="ag-o-hint">
            <span>← deslizá →</span>
          </div>
        )}

        {/* Menú de acciones expandibles (oculto por default) */}
        {menuOpen && (
          <div className="ag-o-menu">
            {acts.map((a, i) => (
              <button
                key={i}
                type="button"
                className={`ag-o-act ${a.variant || 'ghost'}`}
                onClick={() => { setMenuOpen(false); a.onClick?.() }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </article>
    </div>
  )
}

export default memo(OrderCard)
