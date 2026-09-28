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

## 28/sep/2026 — El reporte de la mañana en verde de punta a punta (Claude)

Cierra los pendientes 1 y 2 y los dos primeros bloqueos de la sección del
27-28/sep: Ricky cargó `SMOKE_TENANTS` y los secrets, y el reporte corre
entero por primera vez.

### Hecho
- **#20 (incluye el #19)**:
  - `DEFINER_APROBADAS` suma las 11 definer de caja, salón y facturación
    (0067, 0069, 0070). Otra sesión aplicó esas migraciones el 27/sep sin
    aprobarlas y el reporte dio "RLS ABIERTO". Antes de aprobarlas se leyó el
    cuerpo desplegado de cada una (todas validan tenant y rol adentro) y sus
    policies.
  - `scripts/check-definer-aprobadas.mjs` (`npm run check:definer`): lee las
    migraciones y frena, en el pre-commit y en el job Lint del CI, toda
    definer de `public` llamable desde el front que no esté aprobada. Por qué:
    check-rls mira la base y se entera al día siguiente; esto frena en el
    commit y sin credenciales. Da los mismos 41 nombres que producción.
    Límite: un revoke armado con `execute format(...)` no lo ve.
  - Sentry en `morning-health`: `trim` de las tres variables, prueba la región
    US y después la europea, y explica el 404 (org o proyecto mal escritos) y
    el 401/403 (token sin permiso).
- **Sentry configurado**: org `grupo-divianco`, proyecto `hermes-gastro`,
  región US. El conector MCP de Sentry quedó conectado a las sesiones.
- **#21**: la consulta de Sentry cuenta solo lo visto en las últimas 24 h
  (`lastSeen:-24h`), porque `statsPeriod` arma estadísticas pero no filtra.
  Salió de un falso positivo: HERMES-GASTRO-N, un evento único del deploy
  legacy de mala-miga visto dos días antes; se marcó resuelto.
- **Merge sin preguntar: descartado.** Se propuso que los PR de solo docs,
  tests o scripts de chequeo se mergearan sin el OK de Ricky. El clasificador
  de permisos bloqueó que el agente escribiera esa regla en `CLAUDE.md` (la
  cuenta como ampliarse sus propios permisos), aun con el pedido explícito, y
  Ricky decidió dejarlo como está: **todo merge sigue pidiendo su OK**. No
  volver a intentarlo por el `CLAUDE.md`; si se retoma, es un ruleset de
  GitHub sobre `main` que arma él.

### Verificado
- Producción: deploy `READY` de `f67c5ad` (merge del #21) en `hermes-platform`.
- `morning-health` programado del lunes 28/sep (corrida 119, sobre `f67c5ad`),
  leído del log: 3 negocios (43, 10 y 8 productos), schema al día, funciones
  coinciden, RLS cerrado, Sentry sin errores en 24 h; enviado a Telegram.
- Smoke programado del 28/sep: 5 pasan (la landing y los 3 catálogos) y 4 se
  saltean a propósito (fotos de productos y admin, hasta que haya fotos y
  usuario de prueba).
- `check:definer` sobre `main` sin el #19 reproducía exactamente las 11.

### Pendiente inmediato
1. **Los cron de GitHub corrieron unas 8 h tarde**: `morning-health` está a las
   10:00 UTC y corrió 17:57; el smoke, de 10:30 a 18:13. Si se repite, el
   reporte "de la mañana" llega a la tarde. Mirar la corrida del martes antes
   de tocar nada; si sigue, dispararlo desde afuera (una Routine o un cron
   externo que llame a `workflow_dispatch`).
2. `e2e/delivery-persistence.spec.ts` habla con el schema legacy y se saltea
   siempre: reescribirlo contra el edificio o borrarlo. E2E da verde sin
   probar nada.
3. La `0075` no figura en la historia de migraciones de producción, pero sus
   funciones existen: comparar lo desplegado con el archivo antes de tocarla.
4. El panel legacy (`business.platform: false`) no lo sirve ningún build: es
   código muerto, candidato a borrarse.
5. Dependabot: PRs de versiones mayores #3 a #11. Revisar
   `.github/dependabot.yml` (la idea era solo parches de seguridad). Los
   workflows ya avisan que `actions/checkout@v4` y `setup-node@v4` corren
   forzados en Node 24.
6. Expedición (1c), que venía de la sección del 12/sep: el armado de bandejas
   y el pasador. El modelo ya lo sostiene con `orders.ready_at`.
7. Ideas sin hacer: una alerta de Sentry que avise a Telegram en el momento, y
   que la lista de negocios vigilados salga de la base y no de una variable.

### Bloqueado por Ricky
Todo está en `docs/TAREAS-MANUALES.md`, sección "Despues de la recarga":
ubicación de cada sucursal (`branches.lat/lng`, hoy el envío cotiza desde el
centro de Buenos Aires), fotos de los 64 productos, logo, horarios, tarifas y
MercadoPago por negocio, secrets `SMOKE_ADMIN_*` para el test de admin, y
sectores y estaciones para que el KDS y la comandera muestren algo.

---

## 27-28/sep/2026 — Sin legacy: el edificio es Dico, los 3 negocios recargados y el guard de RLS (Claude)

### Hecho
- **Datos del edificio vaciados y recargados.** Se borraron todos los tenants
  (la-nona-pato, cochi, mala-miga y los demos) para rehacer la carga. Antes se
  exporto el catalogo a un CSV (64 productos) que se le paso a Ricky; no esta
  en el repo porque el repo es publico. Despues se recrearon `la-nona-pato`,
  `cochi` y `mala-miga` con un bloque SQL atomico que hace lo mismo que
  `signup_tenant` (tenant, settings y medios de pago por trigger, sucursal
  Principal, owner en `tenant_members`) y cargo los 64 productos.
  - Duena de los tres: `ricardo.r@grupodivianco.com`, que ademas es el
    **owner de la plataforma** (`platform_admins`). Consecuencia: entrando por
    `divianco.app` va a `/consola`; a cada negocio se entra por
    `<slug>.divianco.app/admin`. Una sola contrasena controla plataforma y
    negocios: lo decidio Ricky sabiendolo.
  - No se uso `create-owner` porque crea un usuario nuevo y falla si el mail
    existe, ni `provision_owner` porque inserta el profile y ese ya existia.
- **#1 check-rls** (`npm run check:rls`): tablas sin RLS, policies abiertas,
  vistas sin `security_invoker`, `SECURITY DEFINER` llamables sin aprobar.
  Migraciones `0077_rls_snapshot_rpc` y `0078_function_snapshot_con_permisos`
  (eran 0076/0077; se renumeraron porque main tomo la 0076). Aplicadas.
- **#12 E2E**: qa-lite fuera del config general, specs legacy borrados, job
  E2E duplicado fuera de `ci.yml`. Verde por primera vez desde mayo, pero
  **con 0 tests que corran** (ver pendientes).
- **#13 sin clientes legacy**: `clients/hermes-cochi` pasa a `clients/edificio`
  (default de vite); se borraron `clients/cochi`, `la-nona-pato`, `mala-miga`.
  El build se presenta como Dico: antes `<title>` y manifest decian "Cochi" en
  todos los tenants y los iconos del PWA daban 404.
- **#14 smoke del edificio** (`smoke/edificio.spec.ts`, `npm run test:smoke`,
  `.github/workflows/smoke-edificio.yml`): abre produccion como un cliente
  despues de cada deploy y una vez por dia. Solo lectura.
- **#15**: fuera la traduccion `CLIENT=hermes-cochi`. Ricky borro la variable
  `CLIENT` del panel de Vercel; el build toma `edificio` por defecto.
- **#16 y #17**: `morning-health` lee los negocios de `SMOKE_TENANTS` (la
  misma variable que el smoke); vacia la marca como problema. El #17 arregla
  un bug que meti en el #16: el aviso llevaba un `_` sin escapar, Telegram
  rechazaba el Markdown (400) y el reporte no llegaba. Ahora se escapa y, si
  Telegram rechaza igual, reintenta en texto plano.
- **No es de esta sesion, pero esta en main:** `9ba3d34` (Ricky, otra sesion)
  con la migracion `0080`: `get_catalog` devuelve el origen del envio desde la
  sucursal por defecto. No hay `0079`.

### Verificado
- Produccion: deploys `READY` de #12 a #17; el ultimo es `f677c58`. El
  manifest de produccion dice Dico y el build sale sin `CLIENT`.
- `get_catalog` de los tres: 43, 10 y 8 productos (en mala-miga hay 3
  inactivos, igual que en el export).
- El smoke se dispara solo tras cada deploy de produccion (landing en verde).
  **Los catalogos no se miraron nunca en CI**: `SMOKE_TENANTS` llega vacia.
- `morning-health` corrido a mano el 27/sep 23:39: armo el mensaje y
  Telegram lo rechazo (el bug del #17). El arreglo solo se probo contra un
  Telegram simulado; **el primer envio real es el del lunes 28/sep 10:00 UTC**.

### Pendiente inmediato
1. Mirar si el reporte del 28/sep llego a Telegram y con que lista corrio.
2. Con `SMOKE_TENANTS` bien cargada, correr el smoke a mano
   (Actions → Smoke del edificio → Run workflow) y ver los 3 catalogos verdes.
3. `e2e/delivery-persistence.spec.ts` habla con el schema legacy (`recipes`,
   `orders.customer`) y se saltea siempre: reescribirlo contra el edificio o
   borrarlo. Hoy E2E da verde sin probar nada.
4. La `0075_la_comanda_sale_por_papel` no figura en la historia de
   migraciones de produccion, pero sus funciones existen: se aplico sin
   quedar registrada. Comparar lo desplegado con el archivo antes de tocarla.
5. El panel legacy (`business.platform: false`) ya no lo sirve ningun build:
   es codigo muerto, candidato a borrarse.
6. Dependabot abrio PRs de versiones mayores (#3 a #11: vitest 5,
   actions/checkout 7, etc.). Revisar `.github/dependabot.yml`: la idea era
   solo parches de seguridad.
7. Ideas que quedaron sin hacer: que la lista de negocios vigilados salga de
   la base y no de una variable, y que `morning-health` marque en amarillo
   las credenciales faltantes en vez de "salteado".

### Bloqueado por Ricky
- **`SMOKE_TENANTS` llega vacia a los dos workflows** (corridas del 27/sep
  23:38 y 23:39). Tiene que estar en GitHub → Settings → Secrets and
  variables → Actions → **Variables** (no Secrets), a nivel Repository, con
  ese nombre exacto. Valor: `la-nona-pato,cochi,mala-miga`.
- **Secrets de `morning-health`**: `PLATFORM_SUPABASE_URL` y
  `PLATFORM_SUPABASE_SERVICE_ROLE_KEY`. Sin ellos no corren los chequeos de
  schema, funciones ni **RLS** (el de #1 nunca corrio todavia). Opcionales:
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- **Ubicacion de la sucursal de cada negocio** (`branches.lat/lng`): hoy
  estan vacias y la `0080` cae al centro de Buenos Aires para cotizar envios.
- **Fotos de los 64 productos**: se perdieron con los Supabase legacy.
- Por negocio: logo, horarios, tarifas de envio y cuentas de MercadoPago.
- Secrets `SMOKE_ADMIN_SLUG/EMAIL/PASSWORD` (un usuario de prueba) para el
  test de admin del smoke.

## 26/sep/2026 (b) — Del codigo a la base en un comando, y el HANDOFF recortado (Claude)

### Lo que pidio Ricky

Implementar graphify *"asi aliviamos la recorrida de los datos"*. Se probo
antes de decidir y **no se implemento**. En su lugar entraron dos cosas mas
chicas que atacan lo que de verdad cuesta recorrer en este repo.

### Por que no graphify

Se corrio en una copia, solo codigo, local y sin API key: 9 segundos, 3923
nodos. No sirve aca por algo estructural, no de configuracion:

- **No une el codigo con la base.** Aca ese cruce pasa por strings,
  `.rpc('x')` y `.from('t')`, y ningun analizador de AST los ve. Cero aristas
  entre `platformKds.js` y `cerrar_ticket_de_cocina`.
- **Cada version de una funcion es un nodo aparte** (la de la 0072 y la de la
  0075) y no dice cual es la vigente: la trampa de `signup_tenant` en formato
  grafo.
- Busqueda con ruido, grupos sin nombre si no hay un modelo que los nombre, y
  un reporte de 47 KB (~12k tokens) que su hook hace leer al empezar.
- Para los docs necesita API key. Sus hooks escriben en `.git/hooks`, que con
  husky no corre, y `graphify claude install` edita CLAUDE.md.
- Dejo `graphify-out/` adentro del repo aunque se le paso `--out`.

Si vuelve a aparecer la idea: el costo de este repo esta en el cruce
codigo-base, y eso se resuelve leyendo los strings, no con un grafo de AST.

### Hecho

- **`npm run mapa -- <rpc o tabla>`** (`scripts/mapa.mjs`). Que migraciones la
  crean, alteran o borran, separadas por base (edificio `platform/migrations`,
  legacy `supabase/migrations`); que firma queda viva despues de los `drop`; y
  que codigo la llama por `.rpc()`, `/rest/v1/rpc/` o `.from()`, con los tests
  marcados aparte. `.storage.from()` no cuenta como tabla. Sin argumentos lista
  lo que el repo no cierra: RPC que ninguna migracion define y funciones con
  mas de una firma viva (hoy cero). Lee archivos en el momento: no hay indice
  que regenerar ni que quede viejo, y responde en ~0,2 s.
- **`npm run handoff:archivar`** (`scripts/archivar-handoff.mjs`). Deja las
  ultimas 5 secciones y baja el resto, intacto, a
  `docs/historico/HANDOFF-anterior.md`. Es un script y no una edicion a mano
  por los bugs 1 y 2 de CLAUDE.md: decodifica UTF-8 estricto y verifica
  titulos y contenido de los dos lados antes de escribir. `/cerrardico` lo
  corre, en la copia de Claude y en la de Codex.
- **El HANDOFF paso de 5577 a 356 lineas.** Las 59 secciones del 11/sep para
  atras estan en `historico/HANDOFF-anterior.md`.
- **Antes de archivar se revisaron sus pendientes contra el codigo.** Siguen
  abiertos y subieron a `docs/TAREAS-MANUALES.md`: destildar Sensitive en las
  dos `VITE_*` (A), la pantalla de Expedicion y los trazos de la landing (C).
  Ya resueltos, no subieron: el orden de estaciones (la 0074 agrego `orden`),
  la estacion en el editor de producto, y la rama `feat/dico-panorama-v2`,
  que no tiene ni un commit fuera de `main`: se puede borrar.
- `CLAUDE.md` y `AGENTS.md` mencionan el mapa en "Comandos utiles" y en
  "Antes de razonar sobre una RPC".

### Hallazgos que NO se tocaron

- **`increment_qr_visit`** (`src/services/qrs.js`) y **`upsert_customer`**
  (`src/services/catalog.js`, `src/services/phoneAuth.js`): el codigo las
  llama y ninguna migracion de ninguna de las dos bases las define. Son del
  flujo legacy y el codigo se traga sus errores, asi que no rompen nada
  visible. Si ese flujo pasa al edificio, hay que escribirlas.
- El comentario de `overloadsDe` en `scripts/check-functions-drift.mjs` dice
  que `sumar_staff` tiene dos firmas en produccion. Segun el repo, la 0062
  dropeo la de un argumento. **No se verifico contra la base.**
- `docs/TAREAS-MANUALES.md` tiene partes muertas: se titula "Hermes Gastro" y
  pide un smoke de "los 3 tenants" legacy, que ya no existen como proyectos.

### Verificado

- Suite completa: 101 archivos / 1446 tests (eran 99 / 1418; los 28 nuevos son
  del mapa y del archivador). Pre-commit completo, con typecheck y build, en
  cada uno de los cuatro commits.
- El mapa contra casos reales: `cerrar_ticket_de_cocina` da la 0075 de tres
  argumentos como vigente, que coincide con lo que se verifico en la base el
  26/sep; `sumar_staff` y `orders` (esta ultima en las dos bases).
- El archivado: el HANDOFF original se reconstruye byte a byte juntando las
  dos partes (chequeado aparte, con Python). Correrlo dos veces no hace nada.
- `819d1d3` en `main`, deployment de produccion de `hermes-platform` READY.
  **No cambia nada que vea un cliente**: solo scripts, tests y docs.

### Como se trabajo

La sesion corrio en la rama `claude/dico-vijxdj` y se llevo a `main` con un
fast-forward cuando Ricky lo pidio. `main` no se habia movido, asi que no
hubo nada que resolver.

### Pendiente inmediato

1. **Lo de la seccion de abajo no cambio**: configurar produccion en `cochi`
   es lo primero cuando se retome el desarrollo.
2. **Propuesta sin respuesta de Ricky: que un push de solo docs no publique.**
   El merge de hoy compilo y publico los cuatro proyectos Vercel para cambiar
   scripts y markdown. Un "Ignored Build Step" que compare contra
   `VERCEL_GIT_PREVIOUS_SHA` y saltee si no se toco `src/`, `public/`, `api/`,
   `middleware.js` ni la config de build lo evita. Como `vercel.json` es uno
   solo para los cuatro, alcanza tambien a los legacy, que es lo que se quiere.
3. Revisar `docs/TAREAS-MANUALES.md` item por item contra el codigo, con el
   mismo criterio que se uso para archivar, y bajar lo muerto a `historico/`.

### Bloqueado por Ricky

Nada nuevo. Siguen los de antes, ahora todos en `docs/TAREAS-MANUALES.md`:
desconectar los 3 Vercel legacy (el push de hoy los volvio a redeployar),
borrar `prueba-disco` y `tienda-nueva`, leaked password protection, y
destildar Sensitive en las `VITE_*` de `hermes-platform`.

---

## 26/sep/2026 — Cierre: el modelo esta entero y sin estrenar (Claude)

**Ricky paro el desarrollo aca a proposito.** Sus palabras: *"cuando tenga el
primer cliente con mesas termino de desarrollar"*. No es un bloqueo tecnico ni
algo a medias: es que lo que falta no se puede decidir sin un local de verdad
adentro.

### Donde quedo todo

`d796c45` en `main`, READY en produccion, arbol limpio, nada sin pushear, una
sola worktree.

La **0075 ya esta aplicada al edificio**. La corrio Ricky y se verifico contra
la base, no contra el archivo: existe `production_dispatches` con sus nueve
columnas en el mismo orden que el snapshot, RLS activa, su policy y tres
indices; estan las tres RPC nuevas; y `cerrar_ticket_de_cocina` quedo en UNA
sola version de tres argumentos. Eso ultimo era lo riesgoso: con las dos vivas,
una llamada de dos argumentos falla en runtime y no al desplegar.

Se trajo ademas el cuerpo desplegado con `pg_get_functiondef` en vez de confiar
en la migracion. Es el nuevo: cierra por sector, anota la comanda y sella el
pedido recien cuando no queda nada pendiente.

### EL NUMERO QUE IMPORTA PARA LA PROXIMA SESION

**Los siete tenants tienen CERO sectores y CERO productos con estacion, y
ningun pedido bajo nunca a cocina.**

| tenant | productos | con estacion |
|---|---|---|
| la-nona-pato | 43 | 0 |
| mala-miga | 11 | 0 |
| cochi | 10 | 0 |

El modelo de produccion esta completo —sectores, estaciones, KDS por sector,
comandera en papel, cierre desde Salon— y **nadie lo uso todavia**. El KDS y la
comandera se ven vacios en produccion, y eso es correcto: falta configurar, no
falta codigo. No reportarlo como roto.

### Lo primero al retomar

1. **Configurar produccion en UN cliente, y que sea `cochi`.** Tiene diez
   productos: alcanza para recorrer el circuito entero en una sentada y
   descubrir ahi lo que no cierre, en vez de con 43 ya cargados.
2. Asignar estacion a esos productos. La pantalla avisa cuantos faltan.
3. Bajar un pedido a cocina y mirar el KDS.
4. Poner la barra en comandera y probar la termica que Ricky tiene.
   **Chrome va con `--kiosk-printing`** o alguien confirma un dialogo por cada
   comanda: ver `docs/plataforma/COMANDERA.md`.

### Lo que sigue pendiente de Ricky, sin urgencia

- Desconectar los 3 proyectos Vercel legacy del repo. Cada push a `main` los
  redeploya.
- Borrar los tenants de prueba `prueba-disco` y `tienda-nueva`. Siguen ahi.
- Leaked password protection en Supabase.

### Una cosa abierta de diseño, chica

Dico 3D ahora tiene piernas, asi que sale mas alto de la ranura: paso de unos
127px a 188px de alto. La moneda conserva su tamanio exacto, 139,8px medidos en
pantalla. Ricky lo vio en QA Lite y no lo objeto, pero no lo dio por bueno
tampoco. Si molesta, se corrige con `--pose-ancho` en `dico-slot.css`.

---

## 25/sep/2026 — Dico queda en dos versiones: la marca y el pet (Claude)

### Lo que pidio Ricky

Trajo un pet 3D generado con ChatGPT —`~/OneDrive/dico-pet-final/`— y pregunto
si servia para reemplazar al Dico 3D y mantener una sola identidad. Despues de
ver la comparacion: *"reemplaza el physical por esta version pet, dejemos solo
2 versiones la pet y la marca, las otras 3 son cosas que fueron pruebas, van
para afuera"*.

### Lo que habia, y es el hallazgo

**Cuatro cuerpos de Dico conviviendo, y tres NO reproducian la marca.**

- la marca 2D: oro, aro azul, dos ovalos negros. La identidad.
- el cuerpo Core (`poses/moneda.webp` + `CaraDeTinta`): perdio el aro azul, y
  la cara de tinta tenia esclerotica, parpados y cejas.
- el pack 3D de ocho poses: mostaza, ojos de dibujo con pestanias, nariz y
  boca. **Era el que veian los clientes en el panel.**
- siete escenas heredadas con galera y bigote.

El pet es el unico 3D que reproduce la marca. Sumarlo no agrego un Dico mas:
reemplazo al que mas se alejaba.

### Hecho

- `platform/brand/dico-pet-masters/` con el atlas y su QA. Master inmutable,
  verificado por sha256; derivado lossless a `public/brand/dico/pet/`.
- `platform/brand/dico-pet-assets.mjs` es la **unica fuente** de la geometria:
  lo leen el derivador, el componente y el test.
- `DicoPhysical` pasa de cruzar ocho WebP a animar el atlas por
  `background-position`. Setenta y tres cuadros contra ocho imagenes fijas.
- Afuera: `DicoCara`, `CaraDeTinta`, `DicoCoreEscena`, `DicoEscena`,
  `poses/`, el pack 3D, sus scripts y `dico.css` entero (436 lineas muertas,
  con cinco animaciones infinitas adentro).
- `docs/marca/BRIEF-DICO-CUERPO.md` reescrito.

### Dos cosas que hay que saber antes de tocar esto

**Mirar no es senalar.** `pointUp` y `pointDown` no levantan el guante: el
pack no tiene esa pose. Resuelven a una de las dieciseis direcciones de
mirada. Por eso el Slot dejo de anclarse por la punta del dedo y ahora se
centra sobre el objetivo.

**La geometria del Slot se volvio a medir.** El pack viejo era un canvas de
1600x1136 con el personaje ocupando el 40%; la celda del pet es 192x208 y la
llena. La moneda pasa de 31,19% a 73,96% del ancho, asi que `--pose-ancho`
baja de 448px a 189px para que la moneda quede del mismo tamanio en pantalla.

### Verificado

Hoja de contacto de las once filas recortadas con la misma formula del
componente: el encuadre cae exacto en las 88 celdas y el mapa de poses se lee
solo —`worried` es el cuadro de la lupa, `error` el de los ojos cerrados—.
Suite 99 archivos / 1418 tests, gates, typecheck y build en cero.

### Estado

`831600d` en `main`. Sigue pendiente de Ricky la migracion 0075 de la
comandera, que no esta aplicada al edificio.

---
