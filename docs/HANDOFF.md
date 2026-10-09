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

## 7-9/oct/2026 — Crazy Miga: del alta a vender por Telegram (Claude)

Crazy Miga es una dark kitchen (cookies) que cobra por alias o efectivo, sin la
API de MercadoPago. Su dueno es `@Crazymiga` en Telegram; el bot es
`@Crazymigabot`. Plan gratis. Detalle tecnico de Telegram en
`docs/plataforma/TELEGRAM.md`.

### Hecho

**El negocio.** No se creo un tenant: se **reutilizo el de `mala-miga`**
(`eb7a0184-bb22-4f70-a87f-abd7fa81f08d`) y se renombro. El nombre vive en TRES
lugares (`tenants.name`, `tenants.settings.biz_name`, `settings.biz_name`);
`get_tenant_brand` lee la tercera, y por eso la pestana del panel siguio
diciendo "Mala Miga" despues del primer renombre. Ahora lo hace
`rename_tenant(slug, nombre, slug_nuevo)` (0084, solo service role). Quedo en
modo `virtual`, canales `delivery/pickup/whatsapp`, slug `crazy-miga`. La URL
vieja `mala-miga.divianco.app` ya no resuelve (sin redireccion).

**El catalogo** (cargado por SQL, no por la UI): 7 productos activos (3 sabores
x grande y pack x4 de minis, mas **La Nave Crazy**, 16 minis: 5 choco, 5 blanco,
6 dulce de leche, $59.000), 19 insumos, recetas y costos tomados de la planilla
de costeo de Ricky (Drive, 8/oct). Los 11 productos viejos de Mala Miga quedaron
**archivados, no borrados**. Decisiones que no se deducen del codigo:
- La receta manda la **planilla**, no el JSON de recetas que paso primero
  (manteca 120 g por tanda, **sin melaza**, y las flores).
- **Flores a $10.000 por gramo**: Ricky confirmo que son caras. Bajaron de 2 g a
  **1,5 g cada 50 g de manteca** (3,6 g por tanda) para aliviar el costo.
- **Cookie grande de 35 g** (antes 45): una tanda rinde 19 grandes, no 15. El
  precio ($9.000) no se toco; deja ~$3.700 de margen vs ~$2.050 de la planilla.
- **Packaging como insumos** (categoria Packaging) dentro de cada receta, con
  la **merma del 10% aplicada a las cantidades** (una grande descuenta 1,1
  cajas), asi el costo coincide con la planilla y el stock cuenta las roturas.
- Papel parafinado 25x40 ($66,53) unifico el de las grandes y el del combo; la
  faja es $299,68 (papel kraft $49,68 + impresion $250 de Diseniobar, del
  propio relevamiento); caja del combo microcorrugada 20x17x5 ($266,99).
- La planilla da la cookie grande al 77% de costo con 45 g y flores a 2 g; hoy
  da ~58%. Los packs de minis estan en ~28%; **empujar packs y combo**.

**Telegram, tres etapas** (ver TELEGRAM.md):
1. Boton de menu del bot -> `https://crazy-miga.divianco.app` (sin codigo).
2. `src/lib/telegram.js` + `useTelegramMiniApp`: expandida, colores del negocio,
   Atras nativo (apoyado en `history.back()` y el evento `hg-layers` que emite
   `useAndroidBack`). El SDK se carga solo si se abrio desde Telegram.
3. Avisos: trigger `tg_avisar_pedido` en `orders` (0085) -> pg_net ->
   `tg-notificar`. **Se eligio el trigger y no tocar `submit-order`/`mp-webhook`**
   porque cubre cualquier origen del cambio de estado (checkout, panel, bot) y
   no exige redeployar la function critica. Nunca bloquea un pedido (todo en
   EXCEPTION) y no llama a nadie si el negocio no tiene chats activos.
   `tg-webhook` recibe `/start` y los botones Aceptar/Rechazar; `tg-vincular`
   valida el HMAC del `initData` y ata el chat al **telefono** (ultimos 10
   digitos). **El dueno nunca se auto-asigna**: `kind='owner'` se marca a mano.
   Rechazar un pedido pagado por MP desde el bot esta bloqueado; por
   transferencia se deja y se recuerda devolver a mano.
   Cada function lleva **su copia de `validar.ts`** (se despliegan solas y no ven
   la carpeta de otra); hay un test que falla si las copias difieren.

**Catalogo y envio** (migraciones 0083 a 0088; todas reescriben `get_catalog` y
cada una es identica a la anterior mas una linea):
- **0083 aplicada hoy** (ver "Correccion" abajo).
- **0086** emite `has_physical_store` (el checkout solo oculta el retiro con
  `=== false` y la funcion nunca lo mandaba: `undefined` contaba como "tiene
  local"). Default `true`: nadie mas cambia. Crazy Miga solo entrega.
- **0087** emite `free_delivery_over`; envio gratis si el subtotal **supera**
  $60.000 (los $60.000 justos no). `esEnvioGratis` en `origenDelEnvio.js`.
- **0088** emite `delivery_zone = {partidos, notice}`. `evaluarZona` mira
  `county`, `state_district` y `municipality` (Nominatim no es consistente: San
  Isidro lo trae en county, Pilar en state_district) y la Capital por
  `state`/`ISO3166-2-lvl4 = AR-C`. **Solo 'fuera' bloquea**; si Nominatim no da
  un partido reconocible se deja pasar (fail-open), porque un geocodificador
  incompleto no puede dejar sin venta a quien si esta en zona. Cubre texto, GPS
  y direcciones guardadas (antes dos de los tres caminos se saltaban la regla).
- Datos de Crazy Miga: punto base **San Fernando** (-34.4420, -58.5590, centro
  aproximado), **$3.700 cada 10 km** en bloques (10/20/30/40 km y "el resto"
  $18.500), partidos Vicente Lopez, San Isidro, San Fernando, Tigre y Pilar, y
  un aviso visible ("de General Paz a Pilar, no dentro de villas").

### Correccion: la 0083 nunca se habia aplicado

Afirme que "la base rechaza los pedidos sin ubicacion" leyendo el comentario de
la 0083. **No estaba aplicada** (no existia `private.tiene_ubicacion` ni el
trigger) y, peor, el front publicado exige `catalogo_activo === true` y
`get_catalog` no lo devolvia: **ningun negocio podia tomar pedidos en
produccion**, no solo Crazy Miga. La aplique tal cual estaba en el repo. Efecto:
**cochi y la-nona-pato siguen sin poder pedir hasta cargar su ubicacion**, y
ahora tambien lo impide la base. Dos rarezas del registro de migraciones: la
0083 figura con version posterior a la 0085 (se aplico despues), y la base
tiene aplicada la **0079** cuyo archivo **no esta en `main`**: vive en la
worktree paralela `claude/recursing-gauss-acdbb9` (commit `08f82ba`, sin
mergear). No se toco.

### Verificado

- **En produccion, con un pedido real** (envio, efectivo, $12.700 con $3.700 de
  envio): el trigger llamo a `tg-notificar` tres veces, las tres **HTTP 200 con
  `enviados: 1`** (nuevo -> dueno; preparando y listo -> cliente). Ricky reporto
  que pasaron las tres pruebas de checkout: direccion de Pilar (pasa), de
  Palermo (frena) y pedido de mas de $60.000 (envio gratis).
- Tests: 26 de Telegram, 6 de envio gratis/tramos, 10 de zona; typecheck, build
  y los 87 de humo del pre-commit en verde en cada commit.
- **NO verificado**: que Ricky haya visto llegar los mensajes en el celular
  (Telegram los acepto, nada mas); una transferencia por alias; el boton
  **Rechazar**; el Atras nativo y el color de la barra dentro de Telegram; nada
  se vio en el navegador (no hay tests que rendericen el checkout).
- **Rojos que ya estaban**: 7 tests fallan igual sobre `HEAD` limpio (se
  comprobo con un stash): `origenDelEnvio` (5, esperan un campo `propio` que el
  codigo no devuelve), `dicoPanel` (1) y `dicoIdentidad` (1). No se tocaron.

### Pendiente inmediato

1. **`SMOKE_TENANTS` (variable de GitHub) todavia dice `mala-miga`**: el smoke y
   el reporte de la manana dan 404 en ese negocio. Hay que cambiarla a
   `crazy-miga` (esta en `TAREAS-MANUALES.md`). `smoke-pedido.yml` ya se
   corrigio. Ojo: el `slug` por defecto de ese workflow es `cochi`, que **hoy no
   puede pedir** (sin ubicacion); y si se corre contra `crazy-miga`, el pedido
   de prueba dispara los avisos de Telegram al dueno.
2. **`submit-order` no revalida zona, retiro ni envio gratis**: el costo y la
   zona se deciden en el cliente (el geocoding es client-side) y la function solo
   acota el costo al escalon mas caro. Alguien que la llame a mano se los
   saltea. Cerrarlo exige tocarla y redeployarla.
3. **El numero de ticket sale vacio en los mensajes** (`ticket_number` es null en
   pedidos del catalogo): dicen "Pedido nuevo " sin numero. Cosmetico; usar los
   ultimos caracteres del id como respaldo.
4. **Telegram Web no abre la mini app**: `vercel.json` manda
   `X-Frame-Options: SAMEORIGIN` y `frame-ancestors 'self'`. Celular y
   escritorio no se ven afectados. Relajarlo toca la seguridad de todos los
   negocios; no se decidio.
5. Las villas no se excluyen por geografia (no hay poligonos): solo el aviso y el
   criterio del dueno al aceptar. Si se quiere, una lista de barrios por nombre.
6. Los 7 tests rojos de arriba.
7. **Heredados de secciones archivadas que no se revisaron hoy**:
   `e2e/delivery-persistence.spec.ts` habla con el schema legacy y se saltea
   siempre; la `0075_la_comanda_sale_por_papel` no figura en las migraciones
   aplicadas pero sus funciones existen; el panel legacy es codigo muerto;
   Dependabot abrio PRs de versiones mayores (#3 a #11) y la idea era solo
   parches de seguridad; la propuesta (sin respuesta) de que un push de solo
   docs no publique (Ignored Build Step).

### Bloqueado por Ricky

- **Variable `SMOKE_TENANTS`** en GitHub: `la-nona-pato,cochi,crazy-miga`.
- **Confirmar que le llegaron los mensajes** del bot, con el texto y los botones
  bien, y probar **Rechazar** y una **transferencia por alias**.
- **Fotos de los 7 productos y stock inicial de los 19 insumos.**
- **Usuario `ricardoars13@gmail.com`** (Menu → Usuarios): crearlo requiere la
  service role o el panel; no se hizo.
- **Confirmar la lista de partidos** (hoy 5; quiza San Martin, Malvinas
  Argentinas, Escobar, Tres de Febrero) y el punto exacto de San Fernando.
- **Ubicacion de cochi y la-nona-pato**, o no pueden tomar pedidos.
- Las **credenciales** (token del bot, service role) las cargo siempre Ricky;
  el alias/CBU tambien: es un dato bancario y no se ingresa desde aca. El deploy
  de las edge functions (`node platform/scripts/deploy-functions.mjs --only ...`)
  y el registro del webhook (`platform/scripts/telegram-webhook.mjs`) los corre
  el, porque el clasificador bloquea el primero.

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

- Tests dirigidos del panel y Equipo: 23/23 en verde con Vitest y
  `--pool=threads`.
- El hook de cierre pasó typecheck, 87 smoke tests, build de Vite, integridad,
  schema sync y `git diff --check`; commit local `84cddb3` creado.
- La migración local de ubicación quedó renumerada como `0083` porque `origin`
  ya usa `0081` y `0082` para seguimiento y cancelación de pedidos.
- QA Lite no quedó verificado en navegador en este cierre: Docker no está
  disponible en el PATH, por lo que no se pudo bootstrapear la membresía local.

### Pendiente inmediato

1. Iniciar Docker Desktop y ejecutar `node scripts/qa-lite/revision-phase4.mjs`
   para abrir una sesión local con acceso a QA Lite y validar visualmente
   `Habla con Dico` y `Equipo`.
2. Revisar el merge resultante y publicar a `origin/main` cuando QA Lite esté
   disponible; no se hizo deploy desde este cierre.

### Bloqueado por Ricky

Docker Desktop no está instalado o no está en el PATH. Sin el Supabase local
de QA Lite no se puede generar una sesión autenticada de navegador ni hacer
la verificación visual final. La clave, si el bootstrap vuelve a ejecutarse,
seguirá quedando sólo en `.qa-lite/revision-phase4.txt` y
`~/.dico-qa-lite/owner-pass.txt`; no se copia al chat.

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
