#!/usr/bin/env node
// Entrada de compatibilidad.
//
// Los proyectos Supabase legacy por restaurante fueron retirados del flujo de
// despliegue. Todos los tenants viven en el edificio y comparten las functions
// de platform/functions/. Mantener este archivo evita que comandos antiguos
// vuelvan a publicar codigo legacy o intenten reactivar proyectos pausados.

import "../platform/scripts/deploy-functions.mjs";
