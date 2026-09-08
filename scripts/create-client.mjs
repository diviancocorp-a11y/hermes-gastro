#!/usr/bin/env node
// Compatibilidad para el onboarding legacy retirado.
// Los clientes nuevos se crean como tenants dentro del edificio.

console.error([
  "create-client fue retirado: ya no se crean proyectos Supabase por cliente.",
  "Usa el alta del edificio:",
  "  npm run create-owner -- --email <email> --name <negocio> --vertical <gastro|barber|retail> --slug <slug>",
  "Documentacion: platform/scripts/README.md",
].join("\n"));

process.exitCode = 1;
