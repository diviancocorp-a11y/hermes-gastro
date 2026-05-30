// @allow-bad-number-input (este componente ES el fix; documenta el bug en JSDoc)
// src/components/ui/DecimalInput.jsx
// Input decimal robusto para móvil + desktop.
//
// Problema que resuelve:
//   <input type="number" value={f.x || ""} onChange={e => s("x", Number(e.target.value))} />
//   Bugs:
//     1) "0" desaparece porque 0 es falsy → `f.x || ""` da "".
//     2) "0." se pierde porque Number("0.") = 0, se re-renderiza sin punto.
//     3) ".1" funciona accidentalmente porque 0.1 no es falsy.
//
// Este componente mantiene un buffer string interno mientras editás, valida con
// regex, y SÓLO emite onChange(number) cuando el string parsea a número válido.
// El "0", "0.", "0.1" se preservan visualmente entre re-renders.
//
// API:
//   value:        number | null | undefined (controlado desde afuera)
//   onChange:     (n: number) => void   — recibe número parseado
//   min:          number (default 0)    — clamp al emitir
//   max:          number (opcional)     — clamp al emitir
//   step:         "0.01" | "0.001" etc — sólo informativo (para teclado)
//   placeholder, className, style, disabled, ...

import { useState, useEffect, useRef } from "react";

const DECIMAL_RE = /^\d*\.?\d*$/;

export default function DecimalInput({
  value,
  onChange,
  min = 0,
  max,
  step = "0.01",
  placeholder = "0",
  className = "",
  style,
  disabled,
  ...rest
}) {
  // Buffer string que refleja lo que se está editando.
  const [raw, setRaw] = useState(formatValue(value));
  const lastEmittedRef = useRef(toNumber(value));

  // Si el valor externo cambia y NO viene de nuestro propio onChange,
  // actualizamos el buffer (ej: reset del form).
  useEffect(() => {
    const ext = toNumber(value);
    if (ext !== lastEmittedRef.current) {
      setRaw(formatValue(value));
      lastEmittedRef.current = ext;
    }
  }, [value]);

  const handleChange = (e) => {
    const v = e.target.value;
    // Permitir vacío y patrones decimales parciales: "", "0", "0.", "0.1", ".5"
    if (v === "" || DECIMAL_RE.test(v)) {
      setRaw(v);
      const num = v === "" || v === "." ? 0 : parseFloat(v);
      if (!Number.isNaN(num)) {
        let clamped = num;
        if (min != null) clamped = Math.max(min, clamped);
        if (max != null) clamped = Math.min(max, clamped);
        lastEmittedRef.current = clamped;
        onChange?.(clamped);
      }
    }
  };

  const handleBlur = () => {
    // Al perder foco, normalizamos visualmente (ej "0." → "0", "" → "")
    const num = raw === "" || raw === "." ? null : parseFloat(raw);
    if (num == null || Number.isNaN(num)) {
      setRaw("");
    } else {
      setRaw(String(num));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*\.?[0-9]*"
      className={className}
      style={style}
      value={raw}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      data-step={step}
      {...rest}
    />
  );
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function formatValue(v) {
  const n = toNumber(v);
  return n === null ? "" : String(n);
}
