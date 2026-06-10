# Onboarding de cliente nuevo — runbook

> Meta: cliente operativo en menos de 30 minutos. Segui los pasos EN ORDEN.
> Todo lo que es copy-paste te lo imprime `npm run create-client` al final.

## 0. Generar archivos del tenant (2 min)

```bash
npm run create-client
```

Responde los prompts (nombre, slug, colores, rubro). Crea SOLO:
- `clients/<slug>/business.js`
- `.env.<slug>` (completar keys despues del paso 1)

No toca nada compartido — los demas tenants no se enteran.

## 1. Supabase (8 min)

1. https://supabase.com/dashboard → New project. Region: `sa-east-1`. Anota el project-ref.
2. SQL Editor → pegar TODO `supabase/migrations/000_initial_schema.sql` → Run (~5 seg).
   Es idempotente e incluye: 23 tablas, RLS con roles, funciones, views, buckets, realtime, seeds.
3. Verificar: `SELECT count(*) FROM information_schema.tables WHERE table_schema='public';` → 23.
4. Authentication → Settings → habilitar **Leaked password protection**.
5. Project Settings → API → copiar URL y `sb_publishable_...` key a `.env.<slug>`.

## 2. Primer admin (2 min)

1. Authentication → Users → Add user (email del dueno, auto-confirm, password fuerte).
2. SQL Editor:
   ```sql
   INSERT INTO public.admin_users (user_id, role)
   SELECT id, 'owner' FROM auth.users WHERE email = '<email-del-dueno>';
   ```
3. Los demas usuarios del equipo se crean despues desde el panel (Mas → Usuarios).

## 3. Edge functions (5 min)

```bash
npx supabase login          # una sola vez por maquina
node scripts/deploy-functions.mjs --project-ref <ref>
```

El script deploya las 12 functions identicas, con `verify_jwt=false` en las publicas
(las keys `sb_publishable_` no son JWT — sin esto el guest checkout NO funciona).
`afip-invoice` se saltea solo (stub).

Despues, secrets (Dashboard → Edge Functions → Secrets, o `npx supabase secrets set`):

| Secret | Para que | Obligatorio |
|---|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Push notifications | Si usa push |
| `RESEND_API_KEY` / `EXPORT_EMAIL` | Reportes por email | Opcional |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` / `SENTRY_CLIENT_SECRET` | Alertas de errores | Opcional |

## 4. Vercel (5 min)

1. https://vercel.com/new → Import `hermes-gastro` → Project Name: `<slug>`.
2. Framework: **Vite** (build/output default).
3. Environment Variables:
   ```
   CLIENT=<slug>
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   VITE_VAPID_PUBLIC_KEY=...        (si usa push)
   ```
4. Deploy → queda en `<slug>.vercel.app`. Dominio custom: Settings → Domains.

## 5. Identidad y catalogo (8 min)

1. Entrar a `https://<slug>.vercel.app/admin` con el owner.
2. Avatar → Personalizacion: nombre, logo, colores, horarios, **costo de envio por
   distancia**, minimo de pedido, medios de pago, redes.
3. Mas → Stock: cargar ingredientes. Recetas: cargar productos con foto y precio.
4. Ajustes opcionales por SQL (el create-client imprime los bloques exactos):
   feature flags, category_groups, `UPDATE settings SET store_name, app_url`.

## 6. Smoke test (3 min)

- [ ] Catalogo carga con la marca correcta (no "Hermes" ni otro tenant)
- [ ] Pedido guest de retiro → aparece en el admin con alarma
- [ ] Pedido con envio → la direccion se ve en la tarjeta del pedido
- [ ] Mover pedido nuevo → preparando descuenta stock
- [ ] Un usuario NO admin no puede entrar a /admin
- [ ] PWA instalable (manifest con nombre del negocio)

## Que NO hace falta tocar nunca

`public/sw.js`, `public/manifest.json`, `index.html`, `src/` — todo se genera
por tenant en build via `vite.config.js`. Si un paso te pide editar algo de eso,
el proceso esta mal: frenar y revisar.
