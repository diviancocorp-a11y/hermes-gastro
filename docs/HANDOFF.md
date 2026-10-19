# HANDOFF — Dico, plataforma multi-rubro (para seguir en code)

> Punto de entrada para continuar. **Las secciones van de mas nueva a mas
> vieja: leer la primera.** Docs largos: `PLAN-ERP.md` (el plan vivo del ERP),
> `docs/plataforma/PLAN-MULTI-RUBRO.md`, `docs/plataforma/ARQUITECTURA-MODULAR.md`. SQL en `platform/`.
>
> Para retomar en un chat nuevo: **`/dico`**. Para cerrar: **`/cerrardico`**.
>
> Quedan las ultimas 5 secciones. Las anteriores estan en
> `historico/HANDOFF-anterior.md`; las mueve `npm run handoff:archivar`.

---

## 17-19/oct/2026 — Prueba de carga con k6, skill /carga cada 15 días (Claude)

**Publicado.** PR #33 (`prueba/k6`, merge `fe95296`) y PR #32 (regla del
orquestador, merge `693fb2f`), los mergeó Ricky el 19/oct. Producción `READY`
en `fe95296` = `HEAD`. El CI se mide sobre el commit de este HANDOFF, que viene encima de `fe95296` (el push cancela la corrida anterior de `main`). No toca `src/`, la base
ni edge functions.

### Hecho

- **`scripts/carga/catalogo.js`** (k6) + **`scripts/carga/correr.mjs`** +
  `npm run carga:catalogo`. Repite una visita real al catálogo, medida en el
  navegador sobre crazy-miga: `get_catalog` + `mp-status` en paralelo.
  **Solo lecturas**, porque un pedido de prueba es un pedido real (comandera,
  push, Telegram, stock). El front no se prueba: es CDN de Vercel y no dice
  nada del sistema. El wrapper lee la key publicable del `.env` del edificio y
  corta si la URL no es `wwwzdgprsooyjgkuyoav`. `--sin-mp` simula la visita sin
  `mp-status`; `visita_ms` es lo que espera la visita.
- **Resultados** (detalle e historial en `docs/operacion/CARGA-K6.md`): con 20,
  50 y 100 usuarios, 0 errores; `get_catalog` med ~112 ms, p95 204 → 261 ms.
  En Postgres 2,6–3 ms por llamada y el máximo no se movió: **hasta 100
  usuarios la base no es el cuello de botella**, el tiempo es red + PostgREST.
  Picos aislados de 3,6 y 6,7 s que no salen de la base (comprobado); que sean
  red o gateway es deducción.
- **Incidente de red el 17/oct:** una corrida dio 19% de visitas rotas por
  TCP cortado contra las IPs de Cloudflare de Supabase (no 429 ni 5xx). La
  siguiente y la repetición dieron 0. Documentado; la skill sabe clasificarlo.
- **`mp-status` en cada visita** (`src/pages/Catalog.jsx:304`): es una edge
  function por visita y `mpConnected` solo lo usa el paso de pago. Medido con
  100 usuarios: con él 1736 requests / 868 invocaciones / visita p95 340 ms;
  sin él 880 / 0 / 183 ms. **Ojo:** la home no espera a `mp-status`, así que
  lo que se gana es cuota y una conexión menos, no render. Propuesta A
  (pedirlo con el primer producto en el carrito) escrita en el chat del 17/oct,
  **sin aplicar**: Ricky dijo "lo vemos después".
- **Skill `/carga`** (`.claude/skills/carga/SKILL.md`): 20/50/100 usuarios,
  cruce con `pg_stat_statements`, clasificación de errores, comparación
  contra `## Historial` y commit de la fila nueva solo si el checkout está en
  `main` sin cambios ajenos en el doc.
- **Tarea programada `dico-prueba-de-carga`** de la app de Claude: días 1 y 16
  a las 10:00, primera el **1/nov**. Vive fuera del repo, en
  `C:\Users\ricar\.claude\scheduled-tasks\dico-prueba-de-carga\SKILL.md`.
- **Orquestador:** regla `carga` en `scripts/hooks/orquestador-reglas.json`
  ("prueba de carga", "k6", "cuántos usuarios aguanta"…) + 2 prompts de
  ejemplo en el test + fila en la tabla de rutas de `CLAUDE.md`/`AGENTS.md`.
- **k6 instalado** en `C:\Program Files\k6\k6.exe` (v2.2.0, winget; pidió
  UAC). Si una PC no tiene admin: zip del release + checksum + `K6_BIN`.
- Fila de k6 en la tabla de herramientas evaluadas ("en prueba").

### Verificado

- Las corridas son reales contra producción (lecturas). `get_catalog` es
  `stable` sin DML y `mp-status` solo hace selects: no ensuciaron datos.
- Las llamadas nuevas de `pg_stat_statements` coinciden una a una con las
  visitas de k6.
- Test del orquestador: 32 en verde. Pre-commit completo en verde en los
  commits.
- El hook del orquestador corre en la máquina de Ricky: inyectó su aviso en
  cada prompt de esta sesión (era el pendiente 1 del 15/oct).
- **NO verificado:** la tarea programada nunca corrió. Arranca en el modo de
  permisos por defecto y puede frenar a pedir permiso.

### Pendiente inmediato

1. **Ricky: "Run now" una vez** en la tarea "DICO: prueba de carga quincenal
   (k6)" para aprobar los permisos que pide; si no, el 1/nov puede quedar
   esperando una aprobación. Tarda ~12 min y commitea una fila en `main`.
2. **Decidir `mp-status`** (opción A, un archivo de `src/`). Pide ok de Ricky.
3. **Escenario de panel (logueado)**: los advisors marcan 15
   `auth_rls_initplan` y 54 `multiple_permissive_policies` en `orders`,
   `order_items`, `profiles`, `staff`. No pegan en el catálogo (`get_catalog`
   es SECURITY DEFINER) pero sí en el panel, y no está medido.
4. **CI en ramas de trabajo**: `ci.yml` solo escucha `main`,
   `platform/runtime-tenant` y PRs; una rama `claude/**` o `prueba/**` no pasa
   por ningún gate hasta el PR. Propuesto, no hecho.
5. **Worktree `cool-fermat-5ba418`**: su rama ya está mergeada, pero es el
   `cwd` de la sesión "Orquestador de skills por hooks en DICO" (sin archivar)
   y su `.codex/` es distinto al de `main`. No se borró: archivar esa sesión,
   revisar `.codex/` y recién ahí `git worktree remove` + `prune`.
6. **Heredado del 15/oct** (esa sección se archiva hoy):
   - `SkipToContent.jsx` usa blanco sobre `#C45D3E` (4.21:1) y DM Sans; el
     `<main>` de `App.jsx` debería salir por ruta.
   - Los 12 `side-tab` del panel son el siguiente bloque para `/diseno`.
   - Los cron de GitHub (`morning-health` y el smoke) corrían ~8 h tarde el
     28/sep; mirar las últimas corridas antes de tocar nada.

### Bloqueado por Ricky

- El "Run now" de la tarea programada (punto 1) y el ok de `mp-status`.
- **Heredado del 15/oct, sigue vigente:** los números de ejemplo de la landing
  son inconsistentes entre sí (bife $1.200 con $340 de insumos vs. costo $520
  y margen 14%) y no cierran con el plan de $59.000/mes; y el WhatsApp del CTA
  es de EE. UU. (+1 786) para un público argentino
  (`src/pages/PlatformLanding.jsx`). Son contenido y decisión suya.

---

## 17/oct/2026 (tarde) — GerenteDico etapa 3: memoria de la charla y "anotar" (Claude)

**Publicado y verificado.** `2aadfe3` a `b119081`, CI verde en `b119081`.
Ricky cargó `GERENTE_GITHUB_TOKEN`, redeployó `gerente-webhook` e hizo la
prueba del paso D el 17/oct. El front no cambió.

### Hecho

- **0099 `gerente_memoria_y_notas`**, aplicada por MCP con ok de Ricky. Crea
  `gerente_mensajes` (la charla) y `gerente_notas` (los issues propuestos).
  Son tablas de plataforma, **sin `tenant_id`**: es la charla de Ricky con el
  bot, no datos de un negocio. RLS activa, cero policies y sin grants para
  anon/authenticated (verificado en la base). Snapshot del edificio al día
  hasta 0099.
- **Memoria:** a OpenAI le llegan los últimos 10 mensajes de las últimas 12 h.
  Se guarda solo el texto de Ricky y la respuesta final, nunca los resultados
  de las herramientas. Se borra lo de más de 30 días. `/olvidar` borra la
  charla.
- **Herramienta `anotar`** (`platform/functions/gerente-webhook/anotar.ts`):
  el modelo no crea el issue. Deja una nota `pendiente` y el código muestra el
  título y el cuerpo exactos, con el pedido de "Contestá SI". El SI lo revisa
  el código (`esSi`), no el modelo. La nota vence a los 15 min y cualquier
  otro mensaje la descarta. El paso `pendiente` → `creando` es un update
  condicionado, así un SI repetido no crea dos issues. El issue lleva el label
  `gerentedico` (si GitHub lo rechaza, se crea sin label). **El repo es
  público**: el prompt prohíbe montos y datos de clientes, y la vista previa
  muestra todo antes del SI.
- Tests: `src/test/gerenteWebhook.test.js` (25, con historia, SI, cuerpo del
  issue y `crearIssue` con fetch simulado).

### Lo que tiene que hacer Ricky (en este orden)

**A. Crear el token de GitHub** (permisos mínimos, solo issues de este repo)

1. Entrá a https://github.com/settings/personal-access-tokens/new (es
   **Settings** → **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**).
2. **Token name:** `GerenteDico issues`
3. **Resource owner:** `diviancocorp-a11y`
4. **Expiration:** **Custom** y elegí una fecha a un año. Anotala en el
   calendario: cuando vence, el bot contesta "GitHub rechazó el token".
5. **Repository access:** **Only select repositories** → elegí `hermes-gastro`.
6. **Permissions** → **Repository permissions** → **Issues** → **Access:
   Read and write**. *Metadata: Read-only* aparece solo; no toques nada más.
7. **Generate token** y copiá el valor (empieza con `github_pat_`). GitHub lo
   muestra **una sola vez**.

> Ojo: un token **no se edita**. Si se vence o se pierde, se crea otro y se
> reemplaza el secret. Si `diviancocorp-a11y` es una organización, puede
> quedar "pending approval": se aprueba en la organización → **Settings** →
> **Personal access tokens** → **Pending requests**.

**B. Cargarlo en Supabase**

1. Entrá a
   https://supabase.com/dashboard/project/wwwzdgprsooyjgkuyoav/functions/secrets
   (**Edge Functions** → **Secrets**).
2. En **Add new secret**:
   - **Name:** `GERENTE_GITHUB_TOKEN`
   - **Value:** el token del paso A
3. **Save**. Tiene que aparecer en la lista `GERENTE_GITHUB_TOKEN`, al lado de
   `GERENTEDICOBOT` y `DICO_BRAIN`.

**C. Redeployar la function** (en la terminal del repo, en `main` actualizado)

```bash
node platform/scripts/deploy-functions.mjs --only gerente-webhook
```

Tiene que terminar con `gerente-webhook (no-verify-jwt) ... ok`. **No** hace
falta volver a registrar el webhook: sigue recibiendo los mismos mensajes.

**D. Probarlo en Telegram, con GerenteDico**

1. `/ayuda` → la bienvenida ahora menciona "anotar" y `/olvidar`.
2. `como viene crazy-miga?` y después `y cuantos productos tiene?` → la segunda
   respuesta tiene que hablar de crazy-miga sin que lo repitas (memoria).
3. `anota que hay que probar el anotar de GerenteDico` → te muestra
   "Issue para anotar en GitHub", el título, el cuerpo y "Contesta SI…".
4. `SI` → contesta `Anotado: issue #N` con el link. En GitHub, el issue tiene
   el label `gerentedico`. Cerralo: era de prueba.
5. `/olvidar` → "Listo, me olvide de la charla".

Si en el paso 3 dice "falta el secret GERENTE_GITHUB_TOKEN", el paso B no
quedó guardado. Si en el 4 dice "no tiene permiso de Issues", el paso A.6 o
A.5 quedaron mal: hay que crear un token nuevo.

### Verificado (en producción)

- `gerente_notas`: una nota `creada`, "Probar la función anotar", con
  `issue_number` 29. El issue #29 existe en GitHub con el label `gerentedico`
  y el cuerpo esperado (detalle, pedido original citado, pie con la fecha).
- `gerente_mensajes` vacía después del `/olvidar` del final, como corresponde.
  La memoria (paso D.2) no se puede ver en la base por eso; Ricky la probó en
  el chat.
- `function_logs` de 04:56 a 05:01 UTC: solo boot/shutdown, ningún warning de
  guardado ni error de OpenAI o GitHub.

### Pendiente

1. Cerrar el issue #29 (era de prueba).
2. Próxima etapa: que un issue `gerentedico` se convierta en PR y preview sin
   pasar por una sesión a mano.

## 17/oct/2026 — GerenteDico conversa (etapa 2), policies de roles comparadas y limpieza (Claude)

**Publicado y verificado.** `4324c38` a `b77d083`, CI verde en `f03e231`. El
front no cambio. `gerente-webhook` la deployo Ricky el 17/oct y el webhook
quedo registrado (run `39001644500`: "Coincide con la esperada: si").

### Hecho

- `4324c38` — **`ci:esperar`**: un run cancelado por un push posterior
  (`cancel-in-progress` de ci.yml) ya no sale rojo (exit 1), sale 2 y dice que
  mire el CI del ultimo commit. Escribe una linea por consulta con el tiempo.
  No estaba colgado: un `timeout 100 | tail` escondia que el CI seguia
  corriendo. CLAUDE.md/AGENTS.md lo dicen.
- `2dd1636` — **policies de `roles_y_alcance_policies` y
  `roles_barrido_de_policies_viejas`**: las 28 policies vivas de expenses,
  suppliers, sales, settings, staff, audit_log, cash_sessions y tenant_members
  coinciden una por una con la 0050 (`cash_sessions_select` con la 0070). RLS
  activa en las 8. La fila vieja dejaba a cashier/attendant insertar `sales`;
  la base no. Veredicto en `scripts/migraciones-sin-archivo.json`.
- **Crazy Miga** (ok de Ricky en el chat): se borraron los 11 productos de la
  epoca Mala Miga (todos `active=false`, `is_archived=true`, del 27/sep, sin
  pedidos, ventas, variantes, recetas ni favoritos). Quedan los 8 activos.
- **Worktree `recursing-gauss-acdbb9`** borrada, y su rama local
  `claude/beautiful-bun-4a9817`. Su unico commit (`6288f29`) es la 0096 con
  otros comentarios; el SQL es el mismo. La rama sigue en origin como respaldo.
- `b77d083` — **`gerente-webhook`** (etapa 2 de GerenteDico). Ricky le
  escribe al bot y contesta OpenAI (`DICO_BRAIN`, `gpt-4o-mini`) con tres
  herramientas de solo lectura: `negocios`, `pedidos`, `productos`. Sin datos
  personales de clientes. Solo el chat `TELEGRAM_CHAT_ID`, secret_token
  derivado del token. Si se contesta a un mensaje (un aviso de Sentry), ese
  texto va de contexto. No guarda historia: cada mensaje es una charla nueva.
  Se registra con el workflow **GerenteDico webhook** (secret `GERENTEDICOBOT`
  de GitHub). La key de Anthropic ya no hace falta para esta etapa.

### Verificado (en produccion)

- `/start` llego (POST 200, sin errores en `function_logs`) y Ricky recibio
  la bienvenida.
- "como viene crazy-miga": contesto 3 pedidos completados, $ 161.000, ultimo
  el 10/10 y los 8 productos con precio. Coincide con la base.

### Como se publico (por si hay que repetirlo)


1. En la terminal del repo: `npm run deploy:functions -- --only gerente-webhook`
   (o `node platform/scripts/deploy-functions.mjs --only gerente-webhook`).
   Tiene que terminar con `gerente-webhook (no-verify-jwt) ... ok`.
2. `gh workflow run gerente-webhook.yml -f accion=registrar` desde la terminal
   de Ricky (o GitHub → **Actions** → **GerenteDico webhook** → **Run
   workflow**, con sesion iniciada). Al final del log:
   `Coincide con la esperada: si`. El clasificador no deja que el agente lo
   dispare.
3. En Telegram, a GerenteDico: `/start`. Contesta con lo que sabe hacer.
   Despues: `como viene crazy-miga esta semana?`

Los secrets (`GERENTEDICOBOT`, `TELEGRAM_CHAT_ID`, `DICO_BRAIN`) ya estan en
Supabase desde `sentry-alerta`: no hay que cargar nada.

### Pendiente

1. Primer error real en Sentry: des-minificado y con `tenant` (Ricky: esperar).
2. GerenteDico etapa 3: "anota que hay que arreglar X" → issue → PR →
   preview. Y memoria de la charla (necesita tabla y migracion).
3. MiaEstudio sigue sin tenant en el edificio.

## 16-17/oct/2026 (noche) — Sentry vivo de punta a punta y alerta a GerenteDico (Claude)

**Publicado.** Todo en `main`, de `2e5957f` a `7962a7c`. Producción de
`hermes-platform` `READY` en `7962a7c` (redeploy de Ricky de las 02:28 UTC
del 17/oct, ya con las variables de Sentry). CI verde en el último push.

### Hecho

- **Ricky cargó todo lo de Sentry** (pasos en `docs/plataforma/SENTRY.md`):
  - en Vercel: `VITE_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` y
    `SENTRY_AUTH_TOKEN`;
  - la integración interna GerenteDico en Sentry y la regla "Error nuevo →
    Telegram";
  - los secrets de `sentry-alerta` en Supabase;
  - un token de Sentry nuevo con `event:write` en el secret de GitHub
    `SENTRY_AUTH_TOKEN`.
- `2e5957f` — **el tag `tenant` de Sentry sale del subdominio**
  (`tenantDelHost` en `src/lib/observability.js`; lo usan el reporter liviano
  y `sentryFull.js`). Antes decía `edificio` para todos y no se podía filtrar
  por negocio. En la landing vale `raiz`; fuera de `*.divianco.app`, el build.
  El build quedó en su propio tag `build` y se sacó `tenant_name`, que siempre
  decía "Dico".
- `5665c0f` — `checkSentryEnBuild` mira **todos** los chunks que nombra la
  landing. El DSN queda en `observability-*.js`, no en `index-*.js`: con todo
  bien cargado iba a seguir dando rojo.
- `8f7cae9` — **`probar_alerta`** (input de morning-health a mano, módulo
  `scripts/sentry-prueba.mjs`). Manda un error de prueba con el DSN del build
  publicado. Cada prueba lleva un fingerprint nuevo porque la regla avisa
  solo por issue nuevo; con el mismo fingerprint, la segunda prueba no
  avisaría. El tag `prueba:alerta` lo excluye del resumen diario.
- `7962a7c` — cada corrida de morning-health **cierra sola las pruebas
  viejas** (issues abiertos con `prueba:alerta`). Si el token no tiene
  `event:write`, lo dice en el reporte en vez de fallar.
- **Regla de Sentry** (MCP): se le sacó el disparador "issue resuelto", que
  mandaba "🚨 Error nuevo" al cerrar un error. Quedan tres: issue nuevo,
  reaparecido y regresión.

### Verificado (en producción)

- El bundle publicado trae el DSN y la función del tenant por subdominio.
  Release `dico@2e5957f1`, después `dico@7962a7cd`.
- Cadena entera, dos veces:
  - **16/oct:** error mandado desde la base por `pg_net` (`HERMES-GASTRO-Q`).
  - **17/oct:** con `probar_alerta`, run `38992938659` (`HERMES-GASTRO-R`).
  - El camino fue el mismo: Sentry lo recibió, la regla se disparó y
    `sentry-alerta` arrancó 2-3 s después. **Ricky confirmó que llegó a
    Telegram** las dos veces.
- Run `38995065906`: "pruebas de alerta: ✓ 1 cerrada(s)", así que el token
  nuevo escribe. El filtro `!prueba:alerta` se comprobó en Sentry: el issue
  de prueba aparece sin el filtro y desaparece con él.
- **Sourcemaps:** el build de las 02:28 corrió `sentry-vite-plugin`, Sentry
  registró el release `dico@7962a7cd` con deploy `vercel-production`, y los
  `.map` dan 404 en el sitio (se borran después de subirlos).
  - **No verificado:** cuántos archivos recibió el release, porque el log del
    build vino cortado. La prueba real es que el primer error real llegue con
    archivo y línea, no minificado.

### Pendiente inmediato

1. Cuando entre el primer error real: confirmar que llega des-minificado y
   con `tenant` = el negocio. Si llega minificado, revisar los artifacts del
   release en Sentry.
2. GerenteDico conversacional (sigue sin código). Etapa 2: edge function
   `gerente-webhook`, solo el chat de Ricky, herramientas de solo lectura.
   Etapa 3: "anotá que hay que arreglar X" → issue → PR → preview. Necesita
   el ok y la `ANTHROPIC_API_KEY` de Ricky.
3. Comparar una por una las policies que tocan `roles_y_alcance_policies` y
   `roles_barrido_de_policies_viejas`. Hoy solo se sabe que `check:rls` las da
   cerradas.
4. Por mirar, sin verificar en esta sesión: crazy-miga muestra 8 productos en
   el catálogo y en la base parecían 19; MiaEstudio no tiene tenant en el
   edificio.

### Bloqueado por Ricky

- Nada de Sentry. Los puntos 1 y 2 del "Bloqueado" del 16/oct (Telegram y
  `SMOKE_TENANTS`) quedaron resueltos ese mismo día.
- Lo de GerenteDico (punto 2 de arriba): el ok y la key.

## 16/oct/2026 — La base y el repo vuelven a decir lo mismo; morning-health vigila lo que no veía (Claude)

**Publicado.** Todo en `main`, de `b0c3416` a `cd82ca5`, en commits de un
solo tema. Producción de `hermes-platform` `READY` en `cd82ca5` (verificado
por MCP de Vercel).

### Hecho

- **Reglas nuevas en `CLAUDE.md`/`AGENTS.md`**:
  - "la escalera" antes de escribir código (adaptada de Ponytail);
  - criterio de entrada para skills/plugins/MCPs de terceros, con tabla de
    las 12 ya evaluadas (no reabrir sin motivo nuevo);
  - migraciones "expandir y después contraer" (Vercel ya es blue-green, la
    base no vuelve con el rollback) y patrón para sumar un argumento a una RPC
    (`drop` + `create` con `default`, como la 0068; **no** `create or replace`
    con otra firma: deja dos vivas);
  - "cómo se aplica una migración": archivo en el mismo commit; lo
    destructivo lo aplica Ricky desde el panel (por MCP el `drop` se cuelga a
    los 60s, pasó 3 veces);
  - "qué se hace sin preguntar" y qué pide el ok de Ricky.
- `/cerrardico` suma un paso: proponer reglas a partir de correcciones
  repetidas (adaptado de Task Observer).
- **`check:expandir`** (`scripts/check-migraciones-compatibles.mjs`,
  pre-commit + CI): frena drop/rename/`set not null`/cambio de tipo desde la
  0096 salvo `-- contraer: <motivo>`; reconoce solo el cambio de firma
  compatible buscando la firma vieja en las migraciones anteriores.
- **`check-functions-drift.mjs`** ahora compara cuerpo **y** firma de las 83
  funciones de `public`, no solo las críticas. `CRITICAS` (9) quedan como las
  que no pueden faltar. Encuentra también `create function` sin `or replace`.
- **`check-migraciones-sin-archivo.mjs`** (nuevo, en morning-health): toda
  fila de `supabase_migrations.schema_migrations` tiene que tener archivo.
  Lee vía el RPC `migrations_snapshot` (**0097**, definer, solo
  `service_role`). Lo histórico que no coincide por nombre (24) está en
  `scripts/migraciones-sin-archivo.json` con el veredicto de cada una.
- **Base**:
  - **0062** aplicada por Ricky desde el panel: queda una sola
    `sumar_staff(text,text)`.
  - **0097** aplicada por MCP.
- **Rescatadas al repo** (lo que corría en la base sin archivo, copiado de
  `schema_migrations`):
  - **0096**: `provision_owner`/`attach_owner` escriben `roles`. La versión
    del repo fallaba por `roles` NOT NULL desde la 0050.
  - **0018**: el cron `release-dormant-tenants`.
  - **0079**: `schema_snapshot` con vistas. El original vive en la worktree
    `claude/recursing-gauss-acdbb9` (`08f82ba`): si se mergea, tiene que ser
    igual; si difiere, vale el del repo.
  - **0098**: `register_waste`/`register_purchase` que asientan en el libro.
    El repo decía que corría la de la 0040.
- `_migrations_through` en `0098`.

### Verificado

- Contra producción (MCP, solo lectura): las 83 firmas de `public` coinciden
  con el repo. Los 83 cuerpos también: el único que daba distinto
  (`crear_sectores_tipicos`) es idéntico con el normalizador real. Era un
  artefacto de normalizar en Postgres, donde `[a-z]` incluye letras con tilde.
- Coinciden con el repo: constraint `entry_time_valid`, índices
  `inv_mov_client_request_uniq` y `suppliers_tenant_name_uniq`, policies de
  `sales`/`expenses`/`suppliers`.
- **No** se compararon una por una las policies del resto de las tablas que
  tocan las `roles_*`: solo se sabe que `check:rls` las da cerradas.
- Tests de los checks (103) y pre-commit completo con build en cada commit.
- **CI entero en verde desde `6e055c8`** (los 5 jobs). *Security Audit*
  daba rojo desde antes de esta sesión: se arregló con `npm audit fix` y
  `lint-staged` 15 → 16.4.0 (pide node ≥ 20.17). Verificado: suite completa
  (116 archivos, 1594 tests), build, y lint-staged 16 corriendo eslint e
  integridad en el pre-commit.
- Los checks nuevos de morning-health **no corrieron todavía contra la base**
  desde CI: ver bloqueado.

### Resuelto al final del 16/oct (verificado con un morning-health manual)

- Token del bot en el secret **`GERENTEDICOBOT`** (el workflow lo toma de ahí,
  `TELEGRAM_BOT_TOKEN` de respaldo) y `TELEGRAM_CHAT_ID` cargado; el script
  recorta espacios (el chat id traía un salto de línea).
- **Los negocios a mirar salen de la base** (`scripts/tenants-vivos.mjs`):
  `active` se mira, `trial` sale como "en carga" sin rojo. Lo usan
  morning-health y el smoke. `SMOKE_TENANTS` queda de respaldo sin service role.
- **DICO_BRAIN** (API key de OpenAI, secret de GitHub): si hay problemas, los
  explica en castellano. `workflow_dispatch` con `probar_cerebro` lo prueba.
- Run `38962476797`: todo en verde (cochi, crazy-miga, la-nona-pato; monare
  en carga), los 3 checks nuevos en verde contra la base, la prueba del
  cerebro respondió y **llegó a Telegram**.
- `/dico` ahora arranca mirando el CI de `main` y el último morning-health.

### Sentry (16/oct, tarde)

- **El build de producción no tiene Sentry**: el bundle publicado no contiene
  ni la palabra (falta `VITE_SENTRY_DSN` en Vercel `hermes-platform`). Desde
  el 27/sep llegaron **0** eventos y Sentry no descartó nada: no llega nada.
  Confirmado con un build local con el DSN, que sí lo incluye. Detalle y pasos
  en `docs/plataforma/SENTRY.md`.
- morning-health ahora lo detecta (`checkSentryEnBuild`): da rojo y deja de
  decir "sin errores en 24h". Run manual `38964529421`: rojo por Sentry,
  explicado por DICO_BRAIN, llegó a Telegram.
- **`sentry-alerta` desplegada** (versión 1, `verify_jwt=false`). Probada desde
  la base con `pg_net`: sin firma válida contesta 401. Falta el alta en Sentry
  y los secrets (pasos en `SENTRY.md`).
- Pendiente con ok de Ricky (toca `src/`): el tag `tenant` de Sentry sale de
  `__CLIENT__`, que en el edificio siempre vale `edificio`. Tendría que salir
  del hostname. Mientras tanto, `sentry-alerta` saca el negocio de la URL del
  error.

**Bloqueado por Ricky (Sentry):** cargar en Vercel `VITE_SENTRY_DSN`,
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` y redeployar; crear la
integración interna GerenteDico en Sentry; cargar en Supabase
`SENTRY_ALERTA_SECRET`, `GERENTEDICOBOT`, `TELEGRAM_CHAT_ID` y `DICO_BRAIN`;
crear la regla de alerta y mandar la notificación de prueba.

Lo de abajo quedó como estaba escrito al cerrar; los puntos 1 y 2 ya no
aplican.

### Bloqueado por Ricky

1. **Morning-health falla desde el 14/oct y no manda nada a Telegram**:
   `Telegram API error: 401 Unauthorized`. El `TELEGRAM_BOT_TOKEN` de los
   secrets de GitHub ya no es válido. Cargar el token del bot nuevo
   (GerenteDico) y su `TELEGRAM_CHAT_ID` en Settings → Secrets → Actions.
2. **`SMOKE_TENANTS`** (variable de Actions) dice
   `la-nona-pato,cochi,mala-miga`: `mala-miga` ya no existe (da "catálogo
   VACÍO" todos los días). Cambiar por los tenants vivos (al menos
   `crazy-miga`).
3. Ok y `ANTHROPIC_API_KEY` (la carga él) para el bot GerenteDico.

### Pendiente inmediato

1. Después de 1 y 2: correr morning-health a mano (`workflow_dispatch`) y
   confirmar que llega y que los 3 checks nuevos dan verde.
2. GerenteDico (propuesta en el chat del 16/oct, no hay código):
   - etapa 1, el resumen de la mañana con los errores de Sentry explicados en
     castellano;
   - etapa 2, edge function `gerente-webhook` (solo el chat de Ricky,
     herramientas de solo lectura, Claude API);
   - etapa 3, "anotá que hay que arreglar X" → issue de GitHub → Claude Code
     abre el PR → link del preview para aprobar desde el teléfono.
3. Comparar una por una las policies de las tablas que tocan
   `roles_y_alcance_policies` / `roles_barrido_de_policies_viejas`.
