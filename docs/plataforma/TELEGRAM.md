# Telegram: mini app y avisos por el bot

> Estado al 8/oct/2026: etapas 1 y 2 publicadas. Etapa 3 (avisos) escrita,
> migracion 0085 aplicada, functions pendientes de desplegar. Primer negocio:
> **Crazy Miga** (`@Crazymigabot`).

## Que es

El catalogo del negocio, abierto dentro de Telegram, mas un bot que avisa:

- **Al dueno**: "pedido nuevo" con botones Aceptar / Rechazar.
- **Al cliente**: "estamos preparando tu pedido", "esta listo", "cancelado".

No hay una app aparte: el menu del bot abre `https://<slug>.divianco.app`, el
mismo catalogo de siempre.

## Las tres etapas

| Etapa | Que | Donde |
|---|---|---|
| 1 | Boton de menu del bot -> URL del catalogo | BotFather, sin codigo |
| 2 | Expandida, barra con el color del negocio, Atras nativo | `src/lib/telegram.js`, `src/hooks/useTelegramMiniApp.js` |
| 3 | Avisos por el bot | migracion 0085, `platform/functions/tg-*` |

El SDK de Telegram se carga **solo** si la pagina se abrio desde Telegram (hash
`tgWebAppData`). Fuera de Telegram el codigo no hace nada.

## Como viaja un aviso

```
orders (insert / update status)
   -> trigger tg_avisar_pedido (0085)        no bloquea el pedido: todo en EXCEPTION
   -> pg_net -> tg-notificar                 firma compartida en Vault
   -> api.telegram.org/sendMessage
```

El trigger sale sin hacer nada si el negocio no tiene ningun chat activo en
`telegram_chats`. Cubre cualquier origen del cambio (checkout, MercadoPago,
panel, el propio bot) sin tocar `submit-order` ni `mp-webhook`.

| Cambio de estado | Dueno | Cliente |
|---|---|---|
| entra en `new` | pedido nuevo + botones | - |
| `preparing` | - | "estamos preparando" |
| `active` | - | "esta listo" |
| `cancelled` | aviso | "fue cancelado" |
| `completed` | - | - (ruido) |

## Las tres functions (todas `verify_jwt=false`)

| Function | La llama | Como se protege |
|---|---|---|
| `tg-notificar` | el trigger, por pg_net | header `x-dico-aviso` vs `tg_secreto_de_aviso()` (Vault), tiempo constante |
| `tg-webhook` | Telegram | `X-Telegram-Bot-Api-Secret-Token`, derivado del token del bot (`firma.ts`) |
| `tg-vincular` | el front, tras un pedido | firma HMAC del `initData` con el token del bot + rate limit |

**Cada function lleva su copia de `validar.ts`.** Una edge function se despliega
sola y no ve la carpeta de otra. Hay un test que falla si las copias difieren:
si arreglas una, copiala a las otras dos.

## Quien es quien: `telegram_chats`

- `kind = 'customer'`: lo registra `/start` o la mini app. Se vincula por
  **telefono** (`phone_tail` = ultimos 10 digitos), porque el catalogo no exige
  cuenta.
- `kind = 'owner'`: **no se auto-asigna nunca.** Lo decide el negocio, a mano:
  ```sql
  update public.telegram_chats set kind = 'owner'
   where tenant_id = (select id from public.tenants where slug = '<slug>')
     and chat_id = <chat_id del dueno>;
  ```
  Sin esto cualquiera que escribiera `/start` podria aprobar pedidos.
- Un 403 de Telegram (el usuario bloqueo al bot) marca el chat `active = false`.

## Secretos

- `TELEGRAM_BOT_TOKEN_<SLUG>` en Supabase -> Edge Functions -> Secrets. El slug
  sin guiones y en mayusculas: `crazy-miga` -> `TELEGRAM_BOT_TOKEN_CRAZYMIGA`.
- La firma de los avisos vive en Vault (`tg_aviso`), la genera la migracion.
- Nada de esto se pega en un chat.

## Alta de un bot nuevo

1. BotFather: `/newbot`; `/mybots` -> Menu Button -> la URL del catalogo.
2. Cargar `TELEGRAM_BOT_TOKEN_<SLUG>` en los secrets de Supabase.
3. Registrar el webhook (desde una terminal con el token):
   ```powershell
   $env:TELEGRAM_BOT_TOKEN_CRAZYMIGA = "<token>"
   node platform/scripts/telegram-webhook.mjs --slug crazy-miga
   node platform/scripts/telegram-webhook.mjs --slug crazy-miga --info
   ```
4. El dueno escribe `/start` al bot. Marcar su chat como `owner` (SQL de arriba).

## Limites conocidos

- **Telegram Web no abre la mini app**: `vercel.json` manda
  `X-Frame-Options: SAMEORIGIN` y `frame-ancestors 'self'`, y la version web
  embebe la pagina en un iframe. Celular y escritorio no se ven afectados.
- **Rechazar un pedido ya pagado por MercadoPago** desde el bot esta bloqueado a
  proposito: cancelarlo no devuelve la plata. Se hace desde el panel. Los
  negocios que cobran solo por alias o efectivo (Crazy Miga) no pasan por ahi:
  el sistema no ve la transferencia, asi que deja rechazar y le recuerda al
  dueno que coordine la devolucion a mano.
- **Un negocio no toma pedidos sin la ubicacion del local** (migracion 0083) ni
  sin medios de pago cargados. Revisar las dos cosas antes de abrir el bot.
- Un cliente solo recibe avisos si vinculo su Telegram **despues** de un pedido
  hecho desde la mini app y autorizo al bot a escribirle.
