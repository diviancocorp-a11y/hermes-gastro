# TASKS — hermes-gastro

> Estado efimero y pendientes. El contexto estable vive en CLAUDE.md.
> Ultima actualizacion: 2026-06-08

---

## En curso

- [ ] **Propina: permitir monto/porcentaje custom (sobre el tope 20%)**
  - Hoy `cpTip` es un % con botones `[0,5,10,15,20]` (CheckoutScreen.jsx Step2Pago).
  - Falta opcion "Otro" para superar el 20% en el apartado de pago.
  - Archivos: `src/catalog-pro/CheckoutScreen.jsx` (fragil, usar Python heredoc), `src/pages/Catalog.jsx` (estado `cpTip`, calculo `tipAmount`, submit `tip_pct`/`tip_amount`).

## Pendientes (heredados de CLAUDE.md)

- [ ] **Sentry sourcemaps + Seer**
  - Configurar `@sentry/vite-plugin` para subir sourcemaps. Sin eso, Seer ve codigo minified.
  - Bloquea: activar el agente de Anthropic en Sentry.

- [ ] **Refactor `check-schema-sync.mjs`**
  - Hoy usa manifest manual (`scripts/db-columns-manifest.json`) = 3er lugar duplicado.
  - Mejora: que lea directo `scripts/supabase-schema.json`. ~30 min.

- [ ] **Pre-commit: check UTF-8 strict**
  - Agregar al pre-commit `python3 -c "open(f,'rb').read().decode('utf-8','strict')"` para todo archivo staged.
  - Hubiera evitado el build fail de CheckoutScreen.jsx (commit 30aa94c).

## Deploy / git

- [ ] **`git push` pendiente** desde la terminal del user.
  - Ultimo commit local: `cce766a Fix UTF-8 corruption + reaplicar desglose propina/total en step 2`.

---

## Hecho

(vacio)
