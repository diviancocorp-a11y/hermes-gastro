# Informe Qaja R vs hermes-gastro — solo gaps

> Analisis del 3/jul/2026 sobre https://www.qajar.app/app/ (cuenta Malamiga, sin datos cargados).
> Solo se listan funciones que Qaja R tiene y hermes-gastro NO. Lo que ya tenes (AFIP invoicing,
> exports CSV/XLSX/PDF, Menu Engineering ~ matriz BCG, P&L real, CRM, push, cupones, referidos,
> tienda online multi-tenant) quedo verificado en el repo y NO se repite aca.

## Como esta construido (analisis tecnico)

- **Frontend:** Flutter Web compilado a CanvasKit/WASM (main.dart.js + canvaskit.wasm). Una sola
  base de codigo sirve web, PWA y movil. Todo se renderiza a canvas: cero HTML semantico.
- **Backend:** API REST separada en Render.com (`qaja-r-api.onrender.com`), rutas estilo
  Django/DRF: `/auth/me/`, `/branches/`, `/dashboard/`, `/subscription/status/`, `/feedbacks/`,
  `/user/lists/`, `/health`.
- **Multi-tenant logico:** una sola API/DB para todos los comercios (branches + subscription por
  usuario). Contraste con tu modelo: 1 Supabase + 1 Vercel por tenant. El suyo tiene costo
  marginal ~0 por cliente nuevo y self-service signup; el tuyo aisla datos y da dominio propio.
- **Monetizacion:** suscripcion por planes con gating de features (badge "EMPRESARIAL" en
  Sucursales) + 1% de comision sobre ventas de la tienda online.
- **Otros:** Google Sign-In, Facebook Pixel (marketing), verificacion de suscripcion al boot.
- **Debilidades observables (honestidad):** cold start notorio en Render ("Verificando
  suscripcion..." varios segundos), Flutter Web implica SEO nulo y accesibilidad pobre — para un
  storefront publico tu stack React+Vite es objetivamente mejor. El esta optimizado para el panel
  interno; vos para el catalogo publico.

## Gaps funcionales

### 1. POS presencial + Caja (el core de Qajar, ausente en hermes)
- POS con carrito lateral, busqueda por nombre/codigo de barras, y "venta rapida": tipear
  `$importe` o F4 cobra un monto suelto sin producto. Atajo Space = checkout.
- Caja: apertura/cierre con arqueo, historial de cajas, **cajas secundarias** (ej. caja
  proveedores que no recibe ventas), **cierre de caja por email**.
- Reglas de operacion: exigir caja abierta para vender, permitir venta sin stock (stock
  negativo), redondeo sin decimales (balanzas).
- **MercadoPago QR dinamico** desde el POS (cobro presencial).
- Registro de datos de posnet al cobrar con tarjeta (compania, ultimos 4, cuotas).
- Impresion termica: tickets, etiquetas, formato configurable.
- *Relevancia dark kitchen:* media. Util si Mala Miga/LNP venden en mostrador; si no, solo
  interesan venta rapida y QR MP presencial.

### 2. Metodos de pago avanzados
- Recargos por tarjeta y descuento por efectivo, configurables.
- Metodos de pago custom (renombrar/agregar).
- **Pago mixto** (split entre metodos).
- **Cuenta corriente de clientes** (fiado) con filtro "Con Deuda" en Clientes.
- *Relevancia:* cta. cte. + pago mixto son los mas aplicables (clientes B2B/catering).

### 3. Presupuestos (cotizaciones)
- Estados: pendiente / aceptado / rechazado / vencido / **convertido a venta**.
- *Relevancia:* alta si haces catering (Qajar hasta trae "Catering" como categoria default).

### 4. Compras con estado de pago
- Ordenes de compra con estado pendiente / **parcial** / pagada = deuda a proveedores visible.
- Tu modulo de compras registra el gasto pero no trackea cuanto debes.

### 5. Stock multi-ubicacion
- Stock Local vs Stock Deposito por producto, **transferencias** entre ubicaciones y tab de
  movimientos (auditoria por producto). Hermes: una sola ubicacion, ajustes sin ubicacion.
- Productos pesables + codigo PLU de balanza (prefijo 7700) + lookup por codigo de barras.
- *Relevancia:* transferencias/deposito util si algun dia centralizas compras; PLU/pesables no
  aplica a delivery.

### 6. IA operativa (su mayor diferencial)
- **"Sebas", asistente conversacional** que ejecuta acciones: consulta ventas, sugiere
  reposicion, cambia precios/stock y **carga facturas de compra desde una foto** (OCR + IA).
- **Comercio Inteligente**: meta de venta del dia editable con progreso en vivo, hoy-vs-ayer
  (ventas/transacciones/ticket promedio), racha de ventas (gamificacion), proyeccion de la
  proxima semana, prediccion de ventas, optimizacion de precios por margen y demanda,
  asistente de compras (reposicion inteligente).
- **Capital y Rentabilidad**: capital inmovilizado a costo vs valor potencial de venta, markup
  promedio con semaforo, rotacion de capital ("vendes 0.0x tu inventario cada 30 dias"),
  insights automaticos. Rotacion de stock alta/baja por producto.
- Tenes Menu Engineering y P&L real (mas fino que lo suyo en costos), pero nada de forecast,
  metas, ni reposicion sugerida.

### 7. Reporte IVA por alicuota
- Neto + IVA + total agrupado por alicuota (0/10.5/21/27), informativo, por periodo. Facturas
  AFIP pero no tenes esta vista fiscal agregada.

### 8. Permisos granulares por empleado
- Permisos por accion (ej. deshabilitar venta rapida a un empleado especifico), rol "tecnicos".
  Hermes: owner/staff binario.

### 9. Producto/SaaS (relevante para tu Sprint "vendible")
- Suscripcion con planes y feature-gating visible en la UI.
- Onboarding con checklist de progreso (% completado) al primer login.
- "Mis solicitudes": feedback y reporte de errores in-app **con seguimiento de estado**.
- Configuracion buscable (searchbar dentro de Config).
- **Formulario de producto configurable** (activar/desactivar campos desde Config).
- Grilla de cambio masivo de precios; markup por defecto + hasta 5 markups rapidos + redondeo
  de precio automatico al cargar costo.
- Widget de chat de soporte + boton "Asistente IA" flotante global.

### 10. Economia negocio/personal
- Cuentas (Efectivo/MP/Banco/Tarjeta) con saldo, ingresos/egresos del mes y toggle
  Negocio/Personal. Vos tenes cuentas de pago en Finanzas pero no saldos por cuenta ni
  movimientos manuales.

## Storefront publico (Tienda R — analizado en mala-miga.qajar.app)

**Stack distinto al panel:** Next.js App Router con **SSR** — el producto viene renderizado en el
HTML (title por producto: "cocacola - $ 2.000 | mala miga", URLs `/producto/{slug}`, meta OG por
tienda). Subdominio automatico `{slug}.qajar.app` por comercio, self-service. El dueno separo
bien: Flutter para el panel interno, Next.js para lo publico que necesita SEO.

Gaps del storefront vs tu catalogo-pro:

- **SSR/SEO**: tu catalogo Vite es SPA client-side; Google indexa peor tus productos que los de
  el. Es el unico gap tecnico serio del lado publico. Opciones: prerender de rutas de producto en
  build (vite-plugin-ssr/prerender), o meta tags dinamicos via edge function para bots.
- **Cotizador de envio por codigo postal** (en ficha de producto y en checkout, con "no se mi
  codigo postal"). Envio nacional cotizado, no solo zonas locales como tu delivery.
- **Compartir por WhatsApp** la tienda y cada producto individual (boton nativo con link directo).
- **Loop viral en footer**: "Crea tu propia tienda online conectada al stock de tu local en
  qajar.app" — cada tienda de un cliente le hace marketing. Aplicable a hermes cuando sea vendible.

Donde tu catalogo es superior (no gaps de ellos, contexto): cupones, referidos, regalo de
cumpleanos, tracking de pedido, push, temas, paginas de info, checkout guest equivalente.
El checkout de Tienda R (nombre + telefono/WhatsApp + email opcional, retiro/envio,
MP redirect / transferencia / efectivo) es esencialmente lo que ya tenes.

## Que aplicaria primero (opinion, priorizado por esfuerzo/retorno)

1. **Meta del dia + hoy-vs-ayer en Home del admin** — ya tenes todos los datos; es solo UI.
2. **Estado de pago en compras (deuda a proveedores)** — una columna + filtro; mejora cash-flow real.
3. **Carga de factura de compra por foto** (edge function + LLM vision → prellenar compra) — el
   feature de mayor diferencial y encaja perfecto con tu modulo de compras existente.
4. **Presupuestos convertibles a pedido** — si el canal catering existe, es plata que hoy se
   gestiona por WhatsApp sin trazabilidad.
5. **Cta. cte. de clientes** — solo si hay clientes B2B recurrentes.
6. **Asistente de reposicion** (stock bajo x velocidad de venta) — tenes stock + ventas + merma;
   es un query, no un modelo.
7. Recargo/descuento por metodo de pago en checkout — menor, pero pedido tipico de comercio AR.
8. **SEO del catalogo publico** (prerender o meta dinamicos para bots) — unico gap tecnico real
   del lado publico; importa si los tenants buscan trafico organico.

## Pendiente de este analisis

- La cuenta esta vacia: reportes, graficos y el flujo completo de venta/cierre de caja no se
  vieron con datos reales.
- Storefront analizado sobre mala-miga.qajar.app (tienda demo con 1 producto). No se confirmo
  ningun pedido; el flujo post-compra (notificacion al comercio, gestion del pedido en el panel,
  aviso por WhatsApp al cliente) quedo sin ver.
