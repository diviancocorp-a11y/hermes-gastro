# Runbooks Operativos — Hermes Gastro

Procedimientos para los problemas más comunes. Cada runbook tiene síntoma → diagnóstico rápido → acción.

> Aplica a los 3 clientes: **La Nona Pato**, **Cochi**, **Mala Miga**.

---

## 1) Cliente reporta que no le aparece un pedido en admin

**Síntoma:** Cliente acaba de hacer un pedido, no se ve en el tab "Nuevos" del admin.

**Diagnóstico rápido:**
1. Refrescar el admin (F5). ¿Aparece?
   - **Sí**: era un realtime que no se actualizó. Anotar fecha/hora. Si pasa seguido, mirar runbook 2.
   - **No**: el pedido no llegó al DB.
2. Abrir Supabase → Table Editor → `orders` → buscar por `customer` o `phone` del cliente.
   - **Aparece**: el INSERT está OK, problema solo del realtime. Pedirle al cliente código del pedido.
   - **No aparece**: el edge function `submit-order` falló. Ver logs de la function.

**Acción:**
- Si está en DB pero no en realtime: ver runbook 2.
- Si no está en DB: pedir captura del error que vio el cliente. Revisar logs de Supabase `Edge Functions → submit-order`.

---

## 2) Realtime no funciona / pedidos no llegan en vivo

**Síntoma:** Tenés que refrescar el admin para ver pedidos nuevos. La alarma no suena.

**Diagnóstico rápido (3 minutos):**
1. Abrí DevTools (F12) → Console del admin.
2. Buscá `[realtime] SUBSCRIBED` → debería aparecer al cargar.
3. Si en su lugar ves `CHANNEL_ERROR`, `CLOSED` o `TIMED_OUT`: el WS está roto.

**Acciones por causa:**

| Causa probable | Fix |
|---|---|
| Token expirado (cambió `storageKey` reciente) | Re-login manual una sola vez |
| Pedidos anónimos (sin user logueado) no llegan | Verificar que `useRealtimeInvalidation.js` llame `realtime.setAuth(access_token)` (FASE 6) |
| Realtime tenant degradado en Supabase | Supabase Dashboard → Settings → Pause project → esperar 2 min → Restore (último recurso, downtime ~5 min) |
| Las tablas no están en publication | SQL: `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime'`. Si falta `orders`/`order_items`: `ALTER PUBLICATION supabase_realtime ADD TABLE public.orders, public.order_items;` |

**Health check diario:** el workflow `morning-health.yml` corre L-S 7am y avisa por Telegram si esto se rompe.

---

## 3) Catálogo público no carga / pantalla en blanco

**Síntoma:** Cliente abre `<cliente>.vercel.app` y ve pantalla blanca o loading infinito.

**Diagnóstico:**
1. DevTools → Console. Buscar errores rojos.
2. Network tab → reload → ver si las requests a Supabase devuelven 200.

**Causas frecuentes:**

| Síntoma en console | Causa | Fix |
|---|---|---|
| `Failed to fetch ... settings` | Supabase pausado o down | Verificar status en Supabase Dashboard |
| `CORS error` en alguna edge function | Edge function crasheada al loadear | Logs de la function en Supabase |
| 401 / "Invalid API key" | Anon key cambió y `.env` no se actualizó en Vercel | Vercel → Settings → Environment Variables → actualizar `VITE_SUPABASE_ANON_KEY` y redeploy |
| Pantalla blanca sin errores | Build de Vercel roto | Vercel → Deployments → último deploy → ver logs |

---

## 4) Pagos por transferencia: cómo verificar un comprobante

**Flujo normal:**
1. Cliente sube comprobante en checkout → se guarda en bucket `receipts/`
2. Admin recibe pedido con estado `NEW` y nota "comprobante subido"
3. Admin abre el pedido → ve la imagen del comprobante en el modal
4. Verifica el monto en Mercado Pago / banco
5. Si está OK → click "Marcar pagado" → estado pasa a `PREPARING`
6. Si no → click "Rechazar" + WhatsApp al cliente para que vuelva a subirlo

**Bucket privado:** los comprobantes NO son públicos. Solo el admin logueado los puede ver vía signed URL del bucket `receipts`.

---

## 5) Agregar un producto nuevo

1. Admin → tab `Recetas`
2. Click `+` arriba a la derecha
3. Llenar:
   - **Nombre** (visible para el cliente)
   - **Categoría** (debe coincidir con una existente — sino crearla primero en Settings)
   - **Precio de venta**
   - **Imagen** (cuadrada, mínimo 600×600)
   - **Descripción** opcional
   - **Ingredientes**: agregar uno por uno con cantidad para calcular costo
4. Toggle `Visible` → ON para que aparezca en el catálogo
5. Guardar

**Si el producto es combo:** marcar `Es combo` y agregar sub-recetas (otros productos que lo componen).

---

## 6) Cambiar horarios de tienda

1. Admin → menú hamburguesa → `Settings`
2. Sección `Horarios`
3. Por cada día configurar `Abre` / `Cierra` o marcar `Cerrado`
4. Guardar
5. **Hard refresh** en el catálogo público para ver el cambio inmediatamente (sino aparece después del próximo invalidate por Realtime)

**Atajo: cerrar la tienda temporalmente** sin tocar horarios:
- Settings → toggle `Store open` → OFF
- El catálogo muestra "Tienda cerrada" y bloquea pedidos para "ahora"
- Los clientes igual pueden "programar para después"

---

## 7) Crear un cupón

1. Admin → menú hamburguesa → `Cupones`
2. Click `+`
3. Llenar:
   - **Código** (ej. `MAMAS10` — case-insensitive)
   - **Descuento** % (1-100)
   - **Email** opcional → solo este email puede usarlo
   - **Vence** opcional → ISO datetime
4. Guardar
5. Compartir el código con el cliente (WhatsApp, redes, etc.)

**Cupones usados** se marcan automáticamente al aplicarse en un pedido. No se pueden reutilizar.

---

## 8) Agregar un cliente nuevo (onboarding)

**Manual hoy** (TODO: FASE 7 Dashboard automatizará esto):

1. **Supabase**: crear proyecto nuevo en sa-east-1
2. **Migration**: aplicar `supabase/migrations/000_initial_schema.sql` al nuevo proyecto
3. **Vercel**: crear proyecto nuevo apuntando al repo + branch main, con env var `CLIENT=<slug>`
4. **Variables de entorno en Vercel:**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `CLIENT=<slug>`
5. **Edge functions**: deployar las 5 (`submit-order`, `notify-whatsapp`, `notify-new-customer`, `admin-reset`, `validate-coupon`) con `supabase functions deploy`
6. **Realtime publication**: SQL `ALTER PUBLICATION supabase_realtime ADD TABLE public.orders, public.order_items, ...` (11 tablas)
7. **Primer admin user**: Authentication → Add user con email/password
8. **Branding**: crear `clients/<slug>/business.js` + `.env.<slug>` en el repo
9. **Settings iniciales**: login en el admin nuevo → cargar logo, dirección, horarios

El script `npm run create-client` está retirado y bloquea el flujo legacy. Para dar de alta un tenant en el edificio usar `npm run create-owner`; ver `platform/scripts/README.md`.

---

## 9) Supabase está caído / proyecto pausado

**Síntoma:** todos los queries fallan con timeout o 5xx.

1. Ir a status.supabase.com → confirmar si es problema global
2. Si es solo este proyecto: Dashboard → Project status
   - **Paused**: clickear `Restore project` (proyecto free se pausa tras 7 días sin actividad)
   - **Inactive**: contactar a Supabase support
3. Mientras está caído: poner banner en el catálogo (manual o vía feature flag `MAINTENANCE_MODE`)

---

## 10) Vercel está caído

**Síntoma:** `<cliente>.vercel.app` devuelve 5xx.

1. Status: vercel-status.com
2. Si es global: nada que hacer, esperar
3. Si es solo nuestro deploy: Vercel Dashboard → Deployments → último → "Redeploy"
4. Si redeploy también falla: revisar logs del build
   - Errores típicos: lint fail (CI ya lo atrapó antes), env var faltante, version de Node distinta

---

## 11) Necesito ver logs de una edge function

1. Supabase Dashboard → Project → Edge Functions → `<nombre>`
2. Tab "Logs"
3. Filtrar por tiempo o nivel
4. **Tip:** los logs solo se guardan ~24h en free tier. Si necesitás más, descargar.

---

## 12) Cliente quiere recibir notificación push de su pedido

**Estado actual:** infraestructura lista, en testing.

1. Admin → tab `Push`
2. Verificar que el cliente tenga `subscribed=true` en `push_subscriptions`
3. Cambiar el estado del pedido → debería disparar push automáticamente (vía edge function)
4. Si no llega: ver logs de `notify-push` (si existe) o el handler de status change

---

## Contactos rápidos

- **Supabase status**: https://status.supabase.com
- **Vercel status**: https://www.vercel-status.com
- **Health check Telegram**: cada día L-S 7am AR vía GitHub Actions
- **Repo**: https://github.com/diviancocorp-a11y/hermes-gastro
