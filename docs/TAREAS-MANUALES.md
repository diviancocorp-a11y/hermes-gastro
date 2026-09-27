# Tablero de pendientes — Hermes Gastro

> Fuente unica de pendientes post-Sprints 0-4 (10 jun 2026).
> Tres secciones: lo MANUAL tuyo, las DECISIONES que solo vos podes tomar,
> y lo TECNICO que sigue en la proxima sesion de desarrollo.

---

## A. TAREAS MANUALES (las haces vos, ~30 min total)

### Hecho — la migracion 0075 (25/sep/2026)

- [x] **`0075_la_comanda_sale_por_papel.sql` aplicada al edificio.** Verificado
  contra la base: existe `production_dispatches` con sus nueve columnas, RLS y
  tres indices; estan las tres RPC nuevas; `cerrar_ticket_de_cocina` quedo en
  UNA sola version de tres argumentos, asi que no hay ambiguedad de firma. El
  cuerpo desplegado es el nuevo, no solo la firma: cierra por sector, anota la
  comanda y sella el pedido recien cuando no queda nada pendiente.

  Lo que sigue **no es tecnico, es configuracion por cliente**: hoy los siete
  tenants tienen CERO sectores y CERO productos con estacion, asi que el KDS y
  la comandera se ven vacios aunque el modelo este completo. Los tres gastro
  suman 64 productos por asignar: la-nona-pato 43, mala-miga 11, cochi 10.

### Urgente — seguridad (10 min)

- [ ] **Leaked password protection** en el edificio Supabase `hermes-platform`:
  Dashboard → Authentication → Settings → "Leaked password protection" → ON.
  Los tres proyectos legacy estan pausados y fuera de servicio.
- [ ] **Sacar `NODE_ENV=production` de las variables de entorno de Windows**:
  Configuracion → Sistema → Variables de entorno → eliminar NODE_ENV.
  Rompe `npm install` (omite devDeps) y hace fallar los tests. Mientras exista:
  `npm install --include=dev` y `set NODE_ENV=test&& npm test`.

### Esta semana (15 min)

- [ ] **Homologar facturacion ARCA** antes de activar emision automatica:
  generar el certificado WSAA del contribuyente, asociar el servicio `wsfe`,
  crear un punto de venta exclusivo para Dico y cargar el certificado + clave
  privada como secret `ARCA_CREDENTIALS_JSON` en Supabase. No guardar ni pegar
  esas credenciales en Git, la base, el panel o un chat. Primero emitir y
  consultar una Factura C de prueba en homologacion; produccion queda apagada
  hasta validar el circuito con el contador.

- [ ] **Smoke test en produccion de los 3 tenants** (checklist en docs/plataforma/ONBOARDING.md seccion 6):
  pedido guest con envio → verificar que la DIRECCION aparece en la tarjeta del admin.
  Hubo muchos cambios deployados hoy; ver con tus ojos antes que un cliente.
- [ ] **Usuarios admin de LNP**: ricardousa1313, rrodriguezs777 y danagonzalez2607
  perdieron acceso al panel (Sprint 1). Si alguno era empleado real, re-agregalo
  desde Mas → Usuarios (2 clicks).
- [ ] **`npx supabase login`** en tu maquina (una sola vez) para poder usar
  `npm run deploy:functions`.

### Cuando puedas

- [x] ~~**Secrets de Telegram en Mala Miga y Cochi**~~ — HECHO 12/jun
  (en Supabase Edge Functions Secrets, verificado 200 ok en los 3 tenants).

- [ ] **Iconos PWA** para la-nona-pato y mala-miga (solo cochi tiene set completo).
  Patron: `public/clients/<slug>/` con icon-192.png, icon-512.png, favicon.
- [ ] **GIF del 404 (cavernicola)**: es un hotlink a Dribbble (obra de un tercero).
  Puede caerse y es legalmente gris para un SaaS comercial. Hay fallback automatico
  a emoji si no carga, pero antes de vender conviene reemplazarlo por un asset
  propio o con licencia (ej: LottieFiles / IconScout).
- [x] ~~**Sentry sourcemaps**~~ — HECHO 12/jun (vars en Vercel ×3 con token
  Sensitive, stack traces legibles verificados, MCP conectado, Session Replay
  solo-en-error + tags de contexto activos).
- [ ] Los 4 `.docx` ya no estan en GitHub pero siguen en la carpeta del repo
  (gitignoreados). Si queres, movelos a Documentos para tener el repo limpio.
- [x] ~~**Desconectar del repo los 3 Vercel legacy**~~ — HECHO 27/sep/2026: se
  borraron los proyectos (y los Supabase legacy). Era: (`la-nona-pato`, `cochi`,
  `mala-miga`): Project Settings > Git > Disconnect, uno por uno. Cada push a
  `main` los vuelve a deployar. Pausarlos no alcanza (no corta los builds de
  git) y `vercel.json` tampoco sirve: es el mismo archivo para los cuatro
  proyectos y se llevaria puesto al edificio. (Venia del HANDOFF del 10/sep.)
- [x] ~~**Borrar los tenants de prueba**~~ — HECHO 27/sep/2026, junto con
  todos los demas tenants del edificio. Era: `prueba-disco` y `tienda-nueva`. Al
  10/sep estaban vacios (0 productos, 0 pedidos, 0 pagos): contalo de nuevo
  antes del delete. Las FK a `tenants` son `ON DELETE CASCADE`
  salvo `profiles` y `consola_log`, que quedan en null:
  `delete from tenants where slug in ('prueba-disco','tienda-nueva') returning slug;`
  Deja sin tenant a dos cuentas de prueba del signup del 15/ago; borrarlas es
  aparte. (Venia del HANDOFF del 10/sep.)
- [ ] **Destildar Sensitive** en `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
  del proyecto Vercel `hermes-platform` (Settings > Environment Variables).
  Son claves publicas que igual viajan al navegador dentro del bundle. Sin eso,
  `npm run deploy:web` no sirve de respaldo si la integracion de Git se vuelve
  a caer: `vercel pull` las baja como `[SENSITIVE]`. No es urgente mientras el
  push publique. (Venia del HANDOFF del 10/sep.)

---

## B. DECISIONES PENDIENTES (de negocio — sin esto no se puede avanzar en cada tema)

| # | Decision | Contexto | Desbloquea |
|---|----------|----------|------------|
| 1 | **Datos de contacto de Hermes** (WhatsApp, email, Instagram) | El footer del catalogo tiene el boton "Hermes para tu negocio" sin contactos (los placeholder falsos se ocultaron) | Captacion de clientes desde los catalogos de tus propios tenants |
| 2 | ~~**ARCA / facturacion electronica**: implementar WSAA + WSFE real~~ | **DECIDIDO 9/sep:** adaptador ARCA implementado en el edificio. Falta homologacion manual y validacion contable antes de produccion | Homologacion ARCA |
| 3 | **Roles finos staff vs owner**: ¿que NO puede ver un empleado? (propuesta: staff sin Finanzas, CRM export, Settings ni Usuarios) | La infraestructura ya esta (admin_users.role); falta gatear la UI y las policies finas | Sprint 5 |
| 4 | **WhatsApp automatico al completar pedido**: ¿API de WhatsApp Business (paga, ~USD por conversacion) o seguir manual con wa.me? | Hoy el admin manda el mensaje a mano con un click | Sprint 5 |
| 5 | **Stock server-side**: cuando un producto esta "Agotado", ¿submit-order RECHAZA el pedido o solo lo avisa al admin? | Hoy el catalogo bloquea en UI (fail-open); un cliente con la pagina abierta de antes podria pedirlo igual | Sprint 5 |
| 6 | **Dominios custom** por tenant (hoy *.vercel.app) | ~USD 10-15/anio por dominio; se configura en Vercel → Domains | Imagen profesional para vender |
| 7 | **Pricing del SaaS**: costo base actual por tenant ≈ USD 10/mes (Supabase) + Vercel free tier | Definir cuanto cobras por mes y que incluye | Vender al cliente 4 |
| 8 | **Hermes Dashboard** (alta de clientes self-service, Fase 7 del viejo plan): ¿lo hacemos antes o despues del cliente 4? | Con docs/plataforma/ONBOARDING.md el alta manual ya es <30 min; el dashboard vale la pena recien con volumen | Escala |

---

## C. PENDIENTES TECNICOS (los hago yo — proxima sesion de desarrollo)

Del edificio. Subieron del HANDOFF el 26/sep, al archivar las secciones del
11/sep para atras, y se verificaron contra el codigo ese dia:

- [ ] **Pantalla de Expedicion (1c)**: la lista de armado, el pasador y la
  etiqueta en pantalla. El modelo ya lo soporta (`orders.ready_at` marca el
  pase al pasador) y `src/lib/impresionDePasador.js` existe; falta la pantalla.
- [ ] **Trazos de la landing**: `scripts/generar-trazos.mjs` no existe y
  `src/components/landing/trazos.json` esta vacio (`{}`), asi que
  `PalabraEscrita` dibuja con la fuente en vez de trazar los contornos. Es el
  fallback previsto y no rompe nada, pero en la palabra que rota del titular se
  nota como un parpadeo.

Herencia del plan que quedo sin ejecutar (lo digo explicito para que no se pierda):

- [ ] **Cupones atomicos + idempotencia de pedidos** (era Sprint 1.5): el cupon se
  quema antes de insertar items (si falla, se pierde) y un retry tras timeout puede
  duplicar pedido. Fix: RPC transaccional + idempotency key.
- [ ] **user_id del JWT** en submit-order (era 1.6): hoy se acepta del body (spoofeable
  a nombre de otro usuario logueado; impacto bajo, pero esta abierto).
- [ ] **Firma x-signature de MercadoPago** en mp-webhook (era 1.7): riesgo bajo
  (re-consulta la API de MP) pero conviene cerrarlo.
- [x] **Selectores viejos en E2E** (cerrado 27/sep): no era drift de selectores.
  order-flow, admin-flow y multi-client le pegaban a los deploys legacy, que dan
  404, y se retiraron. Lo que falta ahora es un smoke E2E del edificio: hoy
  ningun E2E toca `<slug>.divianco.app`.
- [ ] **Subir coverage threshold** de 35 → 45 (la suite ya esta verde).
- [ ] **rate_limits policy USING(true)** y **recipe_sale_counts expuesta a anon**
  (advisors): mover a acceso via RPC/revocar de la Data API.
- [ ] Refactor check-schema-sync para leer supabase-schema.json directo (3er lugar
  duplicado de columnas) + pre-commit UTF-8 strict.
- [ ] Consolidar shims adminService/catalogService → imports directos (Sprint 5).
- [ ] **Push/WhatsApp proactivo de cumpleanos** (complemento de la tarjeta-regalo,
  11/jun): hoy el regalo solo aparece si el cliente ENTRA al catalogo ese dia y la
  app lo reconoce (login o sesion guest) — alcance bajo. Invertir la direccion:
  cron diario (pg_cron o scheduled function) que busque customers con cumple HOY
  y dispare push (`send-push` ya existe, target por phone) o WhatsApp
  "🎂 Tenes un regalo esperandote" con link al catalogo. La edge function
  `birthday-gift` ya genera el cupon idempotente; solo falta el disparador.
  Encaja con la decision B.4 (WhatsApp Business API, Sprint 5).
- [ ] **Ruleta de premios** (11/jun, pedida para el PromoCarousel): gira 1 vez por
  dia/semana por cliente, premio = cupon. Necesita backend: tabla de giros,
  probabilidades por premio, anti-abuso (idempotencia por cliente/periodo) y
  edge function que decida el premio server-side. Al existir, se agrega como
  slide del carrusel.
- [ ] **Pagina Conciliaciones bancarias** (11/jun, FASE 3 del plan de pagos —
  hacer con el local CERRADO): saldos por cuenta (ingresos de orders por
  payment_account_id - gastos por expenses.payment_account_id), tabla
  account_movements solo para transferencias entre cuentas propias y ajustes,
  lista filtrable con check de conciliado. La base ya esta: cuentas con scope
  + expenses.payment_account_id (commit e70657b).
- [ ] **Encuesta de nuevos sabores de cookies** (11/jun, idem): votacion 1 voto por
  cliente identificado. Necesita: tabla flavor_votes (+ opcion de sabores en
  settings o tabla propia), RPC de voto idempotente y slide en el carrusel con
  resultados en vivo. Decision de negocio previa: ¿que sabores van a la encuesta?

---

*Al completar un item: tachalo aca y avisame en la proxima sesion para mantener
CLAUDE.md y el plan al dia.*
