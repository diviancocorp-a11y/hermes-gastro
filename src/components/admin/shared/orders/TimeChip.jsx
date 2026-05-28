/**
 * TimeChip — semáforo de tiempo elapsed (minutos).
 *
 * Props:
 *   minutes:   number elapsed
 *   thresholds:{ warn?: 10, late?: 20 } (default)
 *   label:     string opcional override (si no, formatea "X min")
 */
import { memo } from 'react'

function TimeChip({ minutes = 0, thresholds, label }) {
  const t = { warn: 10, late: 20, ...thresholds }
  let tone = 'ok'
  if (minutes >= t.late) tone = 'late'
  else if (minutes >= t.warn) tone = 'warn'

  const text = label ?? `⏱ ${minutes} min`

  return (
    <span className={`ag-time-chip ${tone}`} aria-label={`Tiempo transcurrido ${minutes} minutos`}>
      <span className="ag-t-dot" aria-hidden="true" />
      {text}
    </span>
  )
}

export default memo(TimeChip)
