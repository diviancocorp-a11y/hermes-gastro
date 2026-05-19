// ⚠️  DEPRECATED — DO NOT USE THIS PATH
// ═══════════════════════════════════════════════════════════════
// Brand-specific config now lives in `clients/<CLIENT>/business.js`
// and is resolved at build time via the Vite alias `@business`.
//
// Always import from '@business' instead of this path:
//
//   import business, { waLink, telLink, fullName } from '@business';
//
// This file is kept only as a defensive re-export to avoid breaking
// older imports; it will be removed in a future cleanup. New code
// MUST use `@business`.
// ═══════════════════════════════════════════════════════════════

export { default, waLink, telLink, fullName } from '@business';
