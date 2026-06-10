# Tareas manuales de Ricky

> Cosas que Claude no puede hacer por vos (dashboards, decisiones de negocio, assets).
> Tachalas a medida que las hagas. Actualizado: 9 jun 2026.

## Seguridad (5 min)

- [ ] **Leaked password protection** en los 3 proyectos Supabase:
  Dashboard → Authentication → Settings → "Leaked password protection" → ON.
  Proyectos: la-nona-pato (`rewzotanfurutjolghkf`), cochi (`nzrzfknvlnddpexghynq`), mala-miga (`tszcksppdglktcmzgepd`).

## Tu maquina (5 min, evita bugs recurrentes)

- [ ] **Sacar `NODE_ENV=production` de las variables de entorno de Windows**:
  Configuracion → Sistema → Variables de entorno → eliminar NODE_ENV (o ponerla en blanco).
  Mientras exista: `npm install --include=dev` y `set NODE_ENV=test&& npm test`.

## Decisiones de negocio

- [ ] **Datos de contacto reales de Hermes** para el footer del catalogo:
  WhatsApp, email e Instagram de Hermes Gastro (hoy estan ocultos por ser placeholders).
  Cuando los tengas, se cargan en `src/catalog-pro/CatalogFooter.jsx` (constante HERMES).
- [ ] **AFIP / facturacion electronica**: la edge function `afip-invoice` es un stub no funcional
  (auth con PLACEHOLDER_TOKEN). Decidir: implementar WSAA real (requiere certificado AFIP
  del cliente) o eliminarla hasta que un cliente la pida. El feature flag E_INVOICE esta OFF.
- [ ] **Usuarios admin de LNP**: ricardousa1313, rrodriguezs777 y danagonzalez2607 perdieron
  acceso al panel (Sprint 1). Si alguno era empleado real, re-agregalo desde Mas → Usuarios.

## Assets pendientes

- [ ] **Iconos PWA** para la-nona-pato y mala-miga (solo cochi tiene set completo).
  Patron: `public/clients/<slug>/` con icon-192.png, icon-512.png, favicon.
- [ ] **Mover los 4 .docx del root** (Resumen_Socios, Reporte_Pre_Lanzamiento, SAAS_ROADMAP,
  auditoria_ingenieria) fuera del repo publico — cualquiera los puede descargar de GitHub.

## Cuando toque Sentry (Sprint 4.7)

- [ ] Crear `SENTRY_AUTH_TOKEN` (Sentry → Settings → Auth Tokens) para subir sourcemaps
  y pasarmelo por env var local (NO por chat).
