# Sentry en el edificio

Proyecto `grupo-divianco/hermes-gastro` (región US). Release `dico@<BUILD_ID>`
(`src/lib/release.js`). El SDK completo (`src/lib/sentryFull.js`) carga
diferido después del `load`; el reporter liviano (`src/lib/observability.js`)
cubre el arranque.

## Lo que encontró la verificación del 16/oct/2026

- **El build de producción no tenía Sentry.** El bundle publicado no contenía
  ni la palabra "sentry": `hermes-platform` compila sin `VITE_SENTRY_DSN`, y
  Vite saca el código de Sentry entero cuando la variable falta. Desde el
  27/sep (la mudanza al edificio) llegó **0** eventos; el último es del 26/sep.
  Sentry tampoco descartó nada (`find_dropped_events`): no llegaba nada.
- Morning-health decía "✓ sin errores en 24h": era verde porque no llegaba
  nada. Ahora además revisa que el bundle publicado tenga el DSN
  (`checkSentryEnBuild`) y da rojo si no está.

## 1. Que la app reporte (Vercel → hermes-platform → Settings → Environment Variables, Production)

| Variable | Valor | Para qué |
|---|---|---|
| `VITE_SENTRY_DSN` | el DSN "Default" del proyecto (Sentry → Settings → Projects → hermes-gastro → Client Keys) | que la app mande los errores |
| `SENTRY_AUTH_TOKEN` | token de Sentry con `project:releases` | subir los sourcemaps (sin esto los stack traces llegan minificados) |
| `SENTRY_ORG` | `grupo-divianco` | idem |
| `SENTRY_PROJECT` | `hermes-gastro` | idem |

El DSN no es secreto (viaja en el bundle de cualquier cliente). Después:
**Redeploy** de producción. Para confirmar, correr morning-health a mano: la
línea de Sentry tiene que decir "✓ en el build".

## 2. La alerta a GerenteDico (edge function `sentry-alerta`)

Un error nuevo → Sentry → `sentry-alerta` → Telegram, con el negocio sacado
del subdominio y la explicación de DICO_BRAIN.

1. **Sentry → Settings → Developer Settings → Custom Integrations → Create
   New Integration → Internal Integration.**
   - Name: `GerenteDico`
   - Webhook URL: `https://wwwzdgprsooyjgkuyoav.supabase.co/functions/v1/sentry-alerta`
   - Activar **Alert Rule Action**.
   - Permissions: Issue & Event → Read.
   - Guardar y copiar el **Client Secret**.
2. **Supabase → Edge Functions → Secrets** (proyecto `wwwzdgprsooyjgkuyoav`):
   - `SENTRY_ALERTA_SECRET` = el Client Secret
   - `GERENTEDICOBOT` = token del bot
   - `TELEGRAM_CHAT_ID` = tu chat id
   - `DICO_BRAIN` = la API key de OpenAI (opcional)
3. **Sentry → Alerts → Create Alert → Issues.** When: *A new issue is
   created* (y, si querés, *The issue changes state from resolved to
   unresolved*). Then: *Send a notification via GerenteDico*. Action interval:
   5 minutos.
4. En esa misma regla, **Send Test Notification**: tiene que llegar a
   Telegram.

Sin `SENTRY_ALERTA_SECRET` la function contesta 401 a todo: no hay forma de
que alguien sin el secreto le mande alertas falsas.
