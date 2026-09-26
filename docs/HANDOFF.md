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

## 12/sep/2026 — La comandera: el sector que despacha en papel (Claude)

### Lo que pidio Ricky

*"Dale comandera, termina todo lo pendiente en esta pantalla para cerrar
proceso hasta aca."* Es la otra mitad de su pregunta del dia anterior: si el
KDS obliga a tener pantallas, que hace el que no las tiene.

### FALTA APLICAR LA MIGRACION AL EDIFICIO

`platform/migrations/0075_la_comanda_sale_por_papel.sql` esta en el repo y
**no** esta aplicada: el clasificador bloqueo `apply_migration`. Hasta que
Ricky la corra por el SQL Editor, en produccion un sector en comandera muestra
la pantalla vacia. Esta en `docs/TAREAS-MANUALES.md`, arriba de todo.

Lo que NO se rompe mientras tanto: cerrar el ticket entero desde el KDS sigue
mandando dos argumentos, no tres con null, justamente para eso.

### La restriccion que definio el diseño

Una termica USB imprime desde la maquina donde esta enchufada y el navegador
solo puede mandarle a la PREDETERMINADA de ese equipo. De ahi sale que la
comandera sea una pantalla: no es para mirar, es la pagina que queda abierta en
la computadora que tiene la impresora del sector. Dos sectores en papel son dos
equipos. Una termica de red saca la restriccion sin tocar el modelo.

**Y Chrome pide confirmacion salvo que se le diga.** `print()` abre la vista
previa y espera. El equipo del sector tiene que abrir Chrome con
`--kiosk-printing`. Esto se descubrio probando: al tocar Imprimir, el navegador
quedo colgado en el dialogo. Es lo que decide si la funcion sirve en una cocina
o es una demo, asi que lo dice la propia pantalla.

### Hecho

- **0075**: `production_dispatches` (una fila por pedido y sector),
  `comandas_por_imprimir`, `comandas_abiertas`, `marcar_comanda_impresa` y
  `cerrar_ticket_de_cocina` con sector opcional.
- **`ComanderaPanel`**: cola de impresion, papel sin cerrar, ancho 58/80 mm,
  impresion automatica que se enciende a mano una vez.
- **Salon**: la ficha de la mesa muestra que le debe cada sector. El de papel
  trae "Entregado"; el de pantalla se muestra y no se toca.
- `npm run pantalla -- comandera` y la barra del demo de QA Lite pasa a papel.
- `docs/plataforma/COMANDERA.md` con el circuito y el armado del equipo.

### Lo que se arreglo de paso

`cerrar_ticket_de_cocina` marcaba listos TODOS los platos del pedido. El
cocinero que tocaba "Ticket listo" estaba diciendo que la barra ya sirvio los
tragos. Ahora cierra solo su sector y el pedido se sella cuando no queda nada.

### Verificado a mano en QA Lite

Con la barra en papel: la cola trajo 4 comandas, el mozo cerro la de Mesa QA 5
desde Salon, la cola bajo a 3 y la cocina mantuvo sus 3 platos. Las tres RPC
se probaron con un JWT de usuario real: imprimir marca 1, repetir sin pedirlo
deja 1, y la reimpresion explicita lleva a 2.

### Estado

Suite 100 archivos / 1432 tests, gates, typecheck y build en cero.

### Sigue pendiente

Expedicion (1c): el armado de bandejas y el pasador. El modelo ya lo sostiene
con `orders.ready_at`.

---

## 12/sep/2026 — Ejemplos vivos en QA Lite, y dos defectos que destaparon (Claude)

### Lo que pidio Ricky

*"Coloca ejemplos vivos en qa lite y pasame credenciales para ver la pantalla."*

### Como se mira

```bash
npm run qa:lite:setup                              # Docker + reset + seed
node scripts/qa-lite/cargar-productos-demo.mjs     # el catalogo, 17 productos
node scripts/qa-lite/cargar-salon-demo.mjs         # mesas y mozo
node scripts/qa-lite/cargar-produccion-demo.mjs    # sectores, estaciones y cocina
node scripts/qa-lite/revision-phase4.mjs           # dev server en :5273
```

`http://127.0.0.1:5273/admin`, usuario `owner.qa-lite@local.test`. La clave
esta en `.qa-lite/revision-phase4.txt` (gitignoreado) y en
`~/.dico-qa-lite/owner-pass.txt`. No se imprime en ningun log.

### Hecho: `cargar-produccion-demo.mjs`

Dos sectores con sus estaciones, estacion para los 21 productos y seis tickets
en cocina. Lo que la carga demuestra y no se puede ver de otra forma:

- **Tickets mixtos.** El mismo pedido aparece en las dos pantallas con platos
  distintos. Uno de un solo sector no probaria la separacion.
- **El umbral es del sector.** Un ticket de 8 minutos esta tranquilo en cocina
  (18) y en rojo en la barra (5).
- **Un ticket a medio hacer**, con platos marcados y pendientes conviviendo.

Los minutos son **relativos a ahora**, no fijos como en el seed: volver a
correrla reinicia el servicio. No toca el fixture; `qa:lite:setup` lo devuelve.

### Los dos defectos que solo se veian abriendo la pantalla

1. **Cocina y Produccion no estaban en la navegacion de nadie.** La matriz de
   `src/modules/roles.js` declara solo lo que cada rol ve, y lo que no figura
   es `nada`. Las dos pantallas estaban publicadas, funcionaban, y no las
   alcanzaba ni el dueño. Ningun test, build ni gate lo nota: el unico sintoma
   es un boton que no esta. Hay un test nuevo que exige que el dueño llegue a
   todo modulo implementado de todos los rubros.
2. **`retiro` contaba como delivery.** `orders.delivery` es NOT NULL con
   default `'retiro'`, asi que "tiene delivery cargado" era cierto para todos
   los pedidos: cada ticket de mesa salia rotulado Delivery y el nombre de la
   mesa no aparecia nunca. El fixture del test no ponia la columna, que en la
   base no puede faltar.

Ademas, Stock y Produccion escribian su titulo dos veces: el chrome ya dibuja
el nombre de la seccion.

### Estado

`e8a9084` en `main`. Suite 99 archivos / 1405 tests en verde, gates y build en
cero. La cocina abre ahora en `kds` y ya no en Pedidos.

### Sigue pendiente

La **comandera**: imprimir una comanda por sector en papel al bajar el pedido
a cocina, y el boton de cerrar desde Salon. El modo ya vive en el sector y se
elige en la pantalla; falta disparar la impresion.

---
