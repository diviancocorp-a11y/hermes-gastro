# Tablero de pendientes — Hermes Gastro

> Fuente unica de pendientes post-Sprints 0-4 (10 jun 2026).
> Tres secciones: lo MANUAL tuyo, las DECISIONES que solo vos podes tomar,
> y lo TECNICO que sigue en la proxima sesion de desarrollo.

---

## A. TAREAS MANUALES (las haces vos, ~30 min total)

### Urgente — seguridad (10 min)

- [ ] **Leaked password protection** en los 3 proyectos Supabase:
  Dashboard → Authentication → Settings → "Leaked password protection" → ON.
  la-nona-pato (`rewzotanfurutjolghkf`) · cochi (`nzrzfknvlnddpexghynq`) · mala-miga (`tszcksppdglktcmzgepd`).
- [ ] **Sacar `NODE_ENV=production` de las variables de entorno de Windows**:
  Configuracion → Sistema → Variables de entorno → eliminar NODE_ENV.
  Rompe `npm install` (omite devDeps) y hace fallar los tests. Mientras exista:
  `npm install --include=dev` y `set NODE_ENV=test&& npm test`.

### Esta semana (15 min)

- [ ] **Smoke test en produccion de los 3 tenants** (checklist en ONBOARDING.md seccion 6):
  pedido guest con envio → verificar que la DIRECCION aparece en la tarjeta del admin.
  Hubo muchos cambios deployados hoy; ver con tus ojos antes que un cliente.
- [ ] **Usuarios admin de LNP**: ricardousa1313, rrodriguezs777 y danagonzalez2607
  perdieron acceso al panel (Sprint 1). Si alguno era empleado real, re-agregalo
  desde Mas → Usuarios (2 clicks).
- [ ] **`npx supabase login`** en tu maquina (una sola vez) para poder usar
  `node scripts/deploy-functions.mjs --all`.

### Cuando puedas

- [ ] **Iconos PWA** para la-nona-pato y mala-miga (solo cochi tiene set completo).
  Patron: `public/clients/<slug>/` con icon-192.png, icon-512.png, favicon.
- [ ] **GIF del 404 (cavernicola)**: es un hotlink a Dribbble (obra de un tercero).
  Puede caerse y es legalmente gris para un SaaS comercial. Hay fallback automatico
  a emoji si no carga, pero antes de vender conviene reemplazarlo por un asset
  propio o con licencia (ej: LottieFiles / IconScout).
- [ ] **Sentry sourcemaps**: crear token en Sentry → Settings → Auth Tokens
  (scope `project:releases`) y agregar a las env de Vercel de los 3 proyectos:
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. El build ya esta preparado —
  con el token, los errores llegan con stack trace legible y Seer sirve de verdad.
- [ ] Los 4 `.docx` ya no estan en GitHub pero siguen en la carpeta del repo
  (gitignoreados). Si queres, movelos a Documentos para tener el repo limpio.

---

## B. DECISIONES PENDIENTES (de negocio — sin esto no se puede avanzar en cada tema)

| # | Decision | Contexto | Desbloquea |
|---|----------|----------|------------|
| 1 | **Datos de contacto de Hermes** (WhatsApp, email, Instagram) | El footer del catalogo tiene el boton "Hermes para tu negocio" sin contactos (los placeholder falsos se ocultaron) | Captacion de clientes desde los catalogos de tus propios tenants |
| 2 | **AFIP / facturacion electronica**: ¿implementar WSAA real o eliminar el stub? | Requiere certificado AFIP del cliente + ~2-3 dias de dev. Flag E_INVOICE OFF, stub no deployado | Sprint facturacion |
| 3 | **Roles finos staff vs owner**: ¿que NO puede ver un empleado? (propuesta: staff sin Finanzas, CRM export, Settings ni Usuarios) | La infraestructura ya esta (admin_users.role); falta gatear la UI y las policies finas | Sprint 5 |
| 4 | **WhatsApp automatico al completar pedido**: ¿API de WhatsApp Business (paga, ~USD por conversacion) o seguir manual con wa.me? | Hoy el admin manda el mensaje a mano con un click | Sprint 5 |
| 5 | **Stock server-side**: cuando un producto esta "Agotado", ¿submit-order RECHAZA el pedido o solo lo avisa al admin? | Hoy el catalogo bloquea en UI (fail-open); un cliente con la pagina abierta de antes podria pedirlo igual | Sprint 5 |
| 6 | **Dominios custom** por tenant (hoy *.vercel.app) | ~USD 10-15/anio por dominio; se configura en Vercel → Domains | Imagen profesional para vender |
| 7 | **Pricing del SaaS**: costo base actual por tenant ≈ USD 10/mes (Supabase) + Vercel free tier | Definir cuanto cobras por mes y que incluye | Vender al cliente 4 |
| 8 | **Hermes Dashboard** (alta de clientes self-service, Fase 7 del viejo plan): ¿lo hacemos antes o despues del cliente 4? | Con ONBOARDING.md el alta manual ya es <30 min; el dashboard vale la pena recien con volumen | Escala |

---

## C. PENDIENTES TECNICOS (los hago yo — proxima sesion de desarrollo)

Herencia del plan que quedo sin ejecutar (lo digo explicito para que no se pierda):

- [ ] **Cupones atomicos + idempotencia de pedidos** (era Sprint 1.5): el cupon se
  quema antes de insertar items (si falla, se pierde) y un retry tras timeout puede
  duplicar pedido. Fix: RPC transaccional + idempotency key.
- [ ] **user_id del JWT** en submit-order (era 1.6): hoy se acepta del body (spoofeable
  a nombre de otro usuario logueado; impacto bajo, pero esta abierto).
- [ ] **Firma x-signature de MercadoPago** en mp-webhook (era 1.7): riesgo bajo
  (re-consulta la API de MP) pero conviene cerrarlo.
- [ ] **Selectores viejos en E2E**: order-flow.spec (`.prod-card`, `cart-add`) y
  admin-flow.spec (`.hd`) no matchean la UI nueva — la suite de CI esta roja por
  drift, no por bugs. Reescribir con data-testid actuales.
- [ ] **Subir coverage threshold** de 35 → 45 (la suite ya esta verde).
- [ ] **rate_limits policy USING(true)** y **recipe_sale_counts expuesta a anon**
  (advisors): mover a acceso via RPC/revocar de la Data API.
- [ ] Refactor check-schema-sync para leer supabase-schema.json directo (3er lugar
  duplicado de columnas) + pre-commit UTF-8 strict.
- [ ] Consolidar shims adminService/catalogService → imports directos (Sprint 5).

---

*Al completar un item: tachalo aca y avisame en la proxima sesion para mantener
CLAUDE.md y el plan al dia.*
