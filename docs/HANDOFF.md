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

## 12/sep/2026 — La barra se separa de la cocina (Claude)

### Lo que pidio Ricky

Dos cosas: que la barra tenga su gestion y su KDS aparte, y que el KDS no
obligue a comprar pantallas — *"si no tienen, hay forma de darles una opcion
de comandera clasica?"*.

Las dos entran por el mismo cambio de modelo. En esta pasada esta la primera
entera y la base de la segunda.

### Hecho: migracion 0074

- **`production_sectors`** — lo que tiene pantalla propia o impresora propia.
  Cocina, Barra. Lleva su `mode` (`pantalla` o `papel`) y su `umbral_min`.
- **`production_stations`** — donde se hace el plato dentro del sector.
  Parrilla, Plancha. Lleva `short_name` y `orden`.
- `products.station_id`, `order_items.station_id` y `order_items.sector_id`.
- Un **trigger** copia la estacion del producto al item al insertarlo.
- `crear_sectores_tipicos()` deja cocina con cuatro estaciones y barra con una.

**Dos niveles y no uno.** El sector es la unidad de DESPACHO y la estacion la
de TRABAJO. Con un solo nivel hay que elegir cual de las dos representa, y
cualquiera de las dos elecciones rompe la otra.

**El umbral es del sector.** Un gin tonic sale en tres minutos y un asado en
veinticinco: con un umbral comun, o la barra vive en rojo o la cocina nunca
avisa. Cocina queda en 18 y Barra en 5.

**El modo tambien es del sector.** Cocina con monitor y barra con comandera es
una configuracion normal, no un caso raro.

### Hecho: la pantalla

- **`Producción`** (`SectoresPanel.jsx`), modulo nuevo en la nav. Es la que
  desbloquea todo: sin ella los platos caen en "sin estacion" y el KDS no
  sirve. Avisa cuantos productos quedaron sin asignar, que es el modo de
  fallar mas caro del circuito — el plato no sale y no hay error en ningun
  lado.
- **El KDS pasa a ser uno por sector.** Los tickets llegan recortados: el
  barman no ve la milanesa. El selector de sector aparece recien con mas de
  uno.
- **El riel sale de lo CONFIGURADO**, en el orden del circuito, y una estacion
  sin trabajo se muestra en cero en vez de esconderse. Antes se deducia de los
  platos: se ordenaba alfabeticamente y cambiaba de largo durante el servicio.
- **El editor de producto elige la estacion.** `toRow` la escribe explicita.

### Por que se pudo cambiar el modelo sin migrar nada

Cero productos tenian estacion y cero pedidos habian bajado a cocina: el KDS
estaba publicado pero no se habia usado. En un mes habria habido que reescribir
comandas historicas.

### Lo que falta: la comandera

Decidido con Ricky y **sin implementar todavia**:

- **La impresora que tiene para probar es USB.** Eso define la arquitectura:
  desde el navegador se imprime a la impresora PREDETERMINADA del equipo, asi
  que con una sola computadora y dos impresoras no se puede elegir destino sin
  abrir el dialogo, que en servicio es inviable. **Un equipo por sector**, cada
  uno con su impresora predeterminada. El camino de red —una termica con IP y
  ePOS-Print por HTTP— permitiria varios destinos desde un solo equipo y queda
  anotado para cuando haya una.
- **En modo papel el pedido lo cierra el mozo desde Salon**, cuando la cocina
  le canta el plato. No hace falta hardware nuevo y los tiempos se siguen
  midiendo, que es lo que despues dice si la cocina va bien.
- Falta: disparar la impresion de la comanda al bajar el pedido a cocina, una
  por sector en papel, y el boton de cerrar en Salon.

`src/lib/impresionDePasador.js` ya resuelve la mitad: imprime texto plano por
el navegador con el ancho de 58 mm.

### Pendientes de antes que siguen

- **1c, Expedicion**: la lista de armando, el pasador y la etiqueta en
  pantalla. El modelo lo soporta (`orders.ready_at`).
- Los 66 productos del edificio no tienen estacion. Hasta que la tengan, el
  KDS se ve vacio aunque haya pedidos.

---
