/**
 * ToggleSwitch — control boolean.
 *
 * Props:
 *   checked, onChange:(bool) => void, label?
 */
import { memo } from 'react'

function ToggleSwitch({ checked = false, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`ag-toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange?.(!checked)}
    />
  )
}

export default memo(ToggleSwitch)
