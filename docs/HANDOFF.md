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

## 28/sep/2026 — Sala de control Dico y launcher silencioso (Codex)

### Lo que pidio Ricky

Que la pose `thinking` deje de sentirse como un GIF rapido y que el HTML
`Dico PANTALLA.html` pase a ser una pantalla final dentro de Dico: un lugar
persistente para avisos y acciones recomendadas que no se resolvieron al
instante.

### Hecho

- Se agrego `DicoPanel` a la navegacion de `PlatformAdmin` como pantalla Sala
  de control. El nombre aparece una sola vez dentro del card; el pequeno Dico
  acompana la bienvenida del chat.
  Toma los avisos 2D de `avisosDe`, las oportunidades y las intervenciones
  3D, con el lenguaje visual del boceto: presencia 3D, chat y grupos de
  pendientes. Se retiro el selector "Con avisos / Al dia": eran estados del
  ejemplo, no una funcion de la pantalla final.
- Las decisiones viven en `localStorage` con la clave
  `dico:centro-decisiones:v1`: una intervencion cerrada queda pendiente en la
  pantalla hasta que se resuelve, se pasa a tarea, se pospone o se descarta.
  El historial de intervenciones 3D se conserva en
  `dico:intervenciones:v1` desde `PlatformAdmin`.
- El resumen superior dejo de mostrar ventas, margen, promedio y pedidos. Los
  KPIs de prioridad tambien se retiraron para dejar una lista unica de tareas,
  ordenada de prioridad alta a baja.
- La fila `espera` del atlas bajo de 7 a 4 fps y cada cuadro reinicia el
  crossfade de `physical.css`. En el panel, Dico permanece en `idle` y hace
  una rutina corta `idle -> thinking -> idle` con pausas largas; no queda
  trabado en thinking ni se muestra como un loop continuo.
- Se corrigio el titileo: los cuadros ya no recrean el nodo ni reinician su
  opacidad; solo cambia el recorte del atlas. El pequeno cambio de pose sigue
  teniendo transicion, pero el idle queda presente.
- Se abrio la referencia compartida `chatgpt.com/s/sharepet_...`: la Sala
  ahora usa Dico pequeno junto a "¿En que te puedo ayudar?" y la conversacion
  como foco. El chat usa una
  capsula oscura larga, boton circular y foco con pulso dorado, adaptado al
  stack JS/CSS del repo sin copiar el componente TypeScript del adjunto. Se
  agregaron botones Volt para archivos e imagenes, con seleccion local y chips
  removibles.
- La burbuja Dico 2D externa abre directamente la Sala de control: no muestra
  tarjeta ni contador y mantiene la cara neutral. Los avisos basicos quedan
  en la Sala; el caso de catalogo vacio dejo de disparar Dico 3D flotante.
- La composicion paso a una sola columna: el chat ocupa todo el ancho y las
  tareas quedan debajo, con el mismo orden en mobile.
- La segunda pasada de la Sala saco la descripcion bajo el titulo, los
  contadores redundantes, los chips de sugerencias y la recomendacion urgente
  del chat. El card conserva solo la bienvenida y el composer.
- Dico ya no tiene fondo propio en la bienvenida: al pasar el mouse por encima
  entra en la pose `explain` para saludar y al salir vuelve a su rutina.
- Las respuestas del composer aparecen con escritura incremental. Se elimino el
  desplazamiento de caminata: Dico tiene una sola presencia persistente dentro
  del chat, piensa mientras responde y queda idle al terminar. Al crecer el
  historial, esa presencia baja con el flujo sin crear mini Dicos por mensaje.
- El texto escrito es blanco y el focus del composer deja solo un contorno
  dorado exterior, sin recuadro interno ni glow. El boton de enviar conserva
  su foco circular, pero no agrega un segundo rectangulo al input.
- La caminata de respuesta usa las filas certificadas `correIzquierda` del
  atlas (ocho cuadros) y desplaza el contenedor en 1800 ms; despues Dico queda
  en idle al borde izquierdo. Durante la escritura queda en `thinking`. El
  primitive acepta una fila de animacion sin contaminar el vocabulario de
  poses publicas.
- La bienvenida no desaparece durante la respuesta. Arriba a la izquierda
  aparece `Nueva accion`, que corta la respuesta, limpia el composer y devuelve
  a Dico al centro. Se retiro de las tarjetas la metadata `Dico 2D`/`nuevo` y
  las acciones quedaron como burbujas redondeadas con simbolos: asignar,
  posponer y descartar; la pantalla de destino queda en dorado a la derecha.
- El composer tiene un saludo local para `hola`, con escritura progresiva
  blanca y sin fondo ni borde azul. Queda listo para reemplazar esa funcion por
  la respuesta de IA.
- La Sala conserva ahora el historial de la conversacion en
  `dico:sala-control:chat:v1`: mensajes del usuario alineados a la derecha y
  respuestas de Dico alineadas a la izquierda. Despues del primer mensaje, la
  presencia unica de Dico vive sobre el boton de enviar: queda idle esperando y
  pasa a thinking con pulso azul mientras responde.
- El composer ahora tiene solo un boton `+` a la izquierda; clip, camara y
  `Nuevo chat` viven en su menu, con microfono a la derecha y hasta cinco conversaciones archivadas como
  maximo en `dico:sala-control:conversaciones:v1`. Al crear un chat nuevo se
  archiva el actual y se reinicia la conversacion; si ya hay cinco archivadas,
  se descarta automaticamente la mas antigua. La camara usa
  `capture=environment` y el microfono aprovecha SpeechRecognition cuando el
  navegador lo soporta.
- El historial de Sala de control ahora guarda hasta 5 conversaciones en
  `dico:sala-control:conversaciones:v1`. Las conversaciones permanecen ocultas
  hasta abrir el boton `Historial de chats` y usan como titulo el primer
  mensaje del usuario.
- Cada montaje de Sala de control empieza un chat nuevo. Al salir se archiva
  la conversacion activa y se limpia el chat corriente; una recarga completa
  tambien recupera el chat pendiente antes de abrir el nuevo. Si el historial
  ya tiene 5 entradas, se descarta automaticamente la mas antigua al archivar
  otra.
- El chat queda por encima de las tareas. Se retiraron los KPIs y la lista de
  tareas se ordena de prioridad alta a baja. Cada tarea muestra la zona arriba
  del titulo y la descripcion a la izquierda; a la derecha queda la prioridad,
  el CTA y un menu de tres puntos con asignar, descartar y posponer. La
  prioridad alta usa un pulso rojo.
- Sala de control se ubica al final del sidebar, despues de los modulos del
  negocio; el mismo orden se conserva en la fuente compartida de navegacion.
- Se bajo el peso visual de los controles: `+`, microfono, iconos del menu y
  menu de acciones usan blanco; los tres puntos son verticales y sin burbuja.
  El bloque paso a llamarse `Tareas asignadas`, y se retiro el boton de
  historial del pie.
- La pantalla de Sala de control ahora se llama `Habla con Dico` y deja solo
  el chat y el bloque `Analisis Dico`. Las tareas asignadas viven en `Equipo`,
  con las vistas `Me asignaron` y `Asignadas por mi`; el mismo registro local
  conserva la jerarquia, el responsable directo, el estado del trabajo y la
  evaluacion, asi una recomendacion pasa a los empleados sin duplicar el
  flujo.
- `admin-dico.css` ahora sigue el boceto: fondo #09090B, superficies #18181B,
  borde #27272A, prioridades antes de la grilla y chat a la izquierda;
  mobile conserva el orden chat, prioridades, pendientes.
- Se agrego `src/test/dicoPanel.test.jsx` para validar el tablero, la tarea
  persistente y la intervencion historica.

### Verificado

- 77/77 tests dirigidos del panel, avisos, Presence, Physical y motion en verde con
  Vitest y `--pool=threads`.
- Build de Vite en verde.
- QA Lite abierto en `http://127.0.0.1:5273/admin`: la pantalla Sala de
  control muestra el chat ancho, la respuesta incremental, Dico idle a la
  izquierda y las tareas debajo.
- `git diff --check` limpio. ESLint queda con warnings preexistentes del panel
  grande y el warning nuevo de Fast Refresh por exportar el helper del panel;
  no hay errores.

### Pendiente inmediato

1. QA visual con una intervencion 3D real en desktop y mobile para calibrar el
   destino flotante y el pulso dorado; QA Lite ya confirma el estado idle de
   Dico en la pantalla nueva.
2. Si se quiere publicar, destrabar la escritura de `.git/index.lock` y hacer
   un commit chico de este tema; no se hizo `git add -A` porque el arbol tiene
   cambios concurrentes.

## 27/sep/2026 — Dico 3D sale del Slot y queda flotante (Codex)

### Lo que pidio Ricky

Sacar Dico 3D de la sidebar porque el Slot provocaba ciclos infinitos de
apertura y cierre; hacerlo aparecer centrado, moverlo para guiar acciones,
reusar la burbuja de Dico 2D, marcar objetivos con un pulso dorado y evitar
que la pose `thinking` se repita para siempre.

### Hecho

- `DicoPresence` ya no monta `DicoSlot` ni comparte el layout de la sidebar.
  `DicoFloatingPhysical` porta Physical a `document.body`, entra desde el
  centro y viaja hacia el nodo real de `objetivo` cuando la intervencion lo
  publica. Esto elimina la cadena hover -> resize de sidebar -> desplazamiento.
- `DicoFloatingPhysical` usa `MensajeDico`, el mismo componente de mensaje de
  Dico 2D. Los objetivos reales y los CTA reciben `.dico-guia-target` o
  `.dico-mensaje-accion--guiado`, con contorno y pulso dorado.
- `DicoPhysical` respeta `bucle: false`; la fila `espera` del atlas termina en
  su ultimo cuadro. El 3D no convive con Native durante una intervencion.
- `PlatformAdmin` dejo de suprimir Physical en mobile y dejo de reservar
  espacio para el Slot. Se retiraron las reglas de `.ag-sidebar .dico-slot`.

### Verificado

- 41/41 tests de Physical, Presence y expresiones.
- 67/67 tests Dico adicionales, incluyendo avisos, intervenciones, Slot y
  machineSoul.
- Build de Vite en verde.
- No se pudo inspeccionar el MP4 adjunto desde el sandbox; se implemento el
  cambio a partir del comportamiento y el codigo existentes.

### Pendiente inmediato

1. QA visual en QA Lite con una intervencion `catalogo-vacio` y otra de Caja,
   en desktop y mobile, para calibrar el destino y el tamano del conjunto.
2. Confirmar en navegador que el pulso dorado no tapa botones en pantallas
   chicas; si molesta, ajustar solo el offset del outline.

### Bloqueado por Ricky

El commit/push queda pendiente: el entorno rechazo la escritura de
`.git/index.lock`. El arbol sigue compartido con cambios concurrentes ajenos;
no se hizo `git add -A`, reset ni limpieza destructiva.

## 27/sep/2026 — El pet Dico tiene una rutina ambiental (Codex)

### Lo que pidio Ricky

Retomar el chat **Visualize Pet Lineup** y llevar la mascota a un punto donde
se sienta viva dentro de la app, con mas acciones y transiciones suaves.

### Hecho

- `platform/brand/dico-pet-assets.mjs` ahora declara acciones cortas y una
  rutina viva: respira, mira arriba, pausa, mira abajo y piensa. No se
  agregaron assets nuevos: se compone sobre el atlas oficial para mantener una
  sola fuente de verdad de la geometria.
- `src/components/dico/useDicoPetMotion.js` reproduce esa rutina solo cuando
  el pet esta libre. Una intervencion con pose explicita conserva prioridad;
  `prefers-reduced-motion` detiene la rutina.
- `DicoSlot` y `DicoCuadro` usan el movimiento ambiental. Cambiar de pose
  reinicia el cuadro y monta una entrada de 220ms en `physical.css`, para que
  el cambio entre acciones no sea un corte seco.
- `src/test/dicoPetMotion.test.jsx` cubre la secuencia, la prioridad de una
  pose controlada y reduced motion.

### Verificado

- 13 archivos de tests Dico / 177 tests en verde con Vitest y
  `--pool=threads`.
- Build de Vite en verde.
- ESLint sin warnings en el hook y el test nuevos. `git diff --check` limpio.
- La suite completa se intento, pero se detuvo despues de mas de dos minutos
  sin progreso y con el worker por encima de 1,5 GB; no se declara como verde.

### Pendiente inmediato

1. Hacer QA visual en QA Lite con el Physical abierto y confirmar el ritmo en
   desktop y mobile; las duraciones actuales son una primera calibracion.
2. Si el ritmo se siente bien, agregar acciones semanticas nuevas solo cuando
   haya nuevos cuadros del atlas, en vez de inventar anatomia con recortes.
3. Repetir la suite completa cuando el repo no este compartiendo recursos con
   otra corrida o agente.

### Bloqueado por Ricky

Nada para esta iteracion. Quedaron cambios sin commitear de otro agente en
`Catalog`, `origenDelEnvio`, una migracion y el snapshot de plataforma; no se
mezclaron con esta tarea.

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
