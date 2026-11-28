# Espacio del disenador de Cochi

Este archivo es para vos y para tu IA (Antigravity). Si sos la IA: lee todo
antes de tocar nada y segui las reglas al pie de la letra; el PR se revisa
solo y se rechaza si las rompe.

## Que es y que NO es tu espacio

- **Es** la portada (la home) del catalogo de Cochi: todo lo que esta en esta
  carpeta, `src/catalog-pro/plantillas/cochi/`.
- **No es** la logica del checkout, la ficha de producto, el carrito ni el
  panel de administracion. Eso no se toca, ni "un poquito". Como se **ven** las
  pantallas del pedido si podes cambiarlo: ver "Otras pantallas (solo estetica)".
- Hoy la portada de Cochi es la plantilla `pop` con otro nombre: no cambia
  nada hasta que registres tus propios componentes.

## Arranque (la IA lo hace sola)

1. En la raiz del repo, crear `.env.local` con estas dos variables. Son
   publicas (ya viajan en el sitio publicado, no son secretos):

   ```
   VITE_SUPABASE_URL=https://wwwzdgprsooyjgkuyoav.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_8gMlo42jYdK8epcD-Zr9TQ_eKmY2nW-
   ```

   `.env.local` no se sube al repo (esta en `.gitignore`).
2. `npm install --include=dev`
3. `npm run dev`
4. Abrir `http://localhost:5173/?tenant=cochi`

El `?tenant=cochi` es lo que hace que se vea Cochi. En esta vista previa **los
pedidos no se envian**: si probas el checkout, vas a ver el aviso "Esto es una
vista previa". Es a proposito.

## Como cambiar una seccion

La portada se arma con estas secciones: `Intro`, `Header`, `Hero`, `Cinta`,
`Favoritos`, `Flyers`, `Menu`, `Submarca`, `Banda`, `Testimonios`, `Historia`,
`Footer`. Sus archivos originales estan en `../` y se llaman `Pop<Seccion>.jsx`
(por ejemplo `../PopHero.jsx`).

1. Copia `../Pop<Seccion>.jsx` a esta carpeta con el nombre `Cochi<Seccion>.jsx`
   (por ejemplo `CochiHero.jsx`) y arreglale los imports relativos.
2. Registralo en `COMPONENTES` dentro de `PlantillaCochi.jsx`:

   ```jsx
   import CochiHero from "./CochiHero";
   const COMPONENTES = { Hero: CochiHero };
   ```
3. **Nunca edites los archivos `Pop*.jsx`**: son de otros negocios tambien.

Lo que no registras sigue siendo `pop`.

## Reglas (si se rompen, el PR se rechaza solo)

- **Solo esta carpeta.** Si el PR toca cualquier otro archivo, un chequeo
  automatico lo rechaza y lista cuales fueron.
- **Nada de fetch, supabase ni services.** Los datos llegan por props y por
  `config`; ESLint prohibe importar `lib/supabase`, `services/` o `@supabase/*`
  y usar `fetch`, `XMLHttpRequest`, `WebSocket` o `EventSource`.
- **CSS bajo `.plantilla-cochi`.** Todo selector empieza con `.plantilla-cochi`.
  Los `@keyframes` llevan prefijo `cochi-` (ej. `cochi-flota`). Los estilos van
  en `cochi.css` (o en archivos CSS de esta carpeta importados desde ahi).
- **Respetar "reducir movimiento".** Toda animacion tiene que apagarse con
  `prefers-reduced-motion` y con el boton de pausar de la portada. Usa el hook
  `../usePausarAnimaciones` (devuelve `quieto`) o `@media (prefers-reduced-motion: reduce)`.
- **Imagenes en `cochi/assets/`**, livianas: webp, menos de 300 KB cada una.
- La raiz del catalogo ya trae la clase `cp-root` y los tokens de color
  (`--ac`, `--bg`, `--tx`, `--t2`, `--line`...): usalos en vez de colores fijos.

## Otras pantallas (solo estetica)

Ademas de la portada podes cambiar **como se ven** la ficha de producto, el
carrito, el checkout, la animacion de "confirmando", el pedido recibido y el
seguimiento. **No podes cambiar lo que hacen**: ni los pasos, ni los datos que
se escriben, ni los botones, ni las conexiones. Las pantallas siguen siendo de
Divianco; vos solo aportas CSS y capas decorativas desde esta carpeta
(`pantallas.css` y `pantallas.js`).

Cuando estas en Cochi, `<html>` lleva `data-plantilla="cochi"` y cada pantalla
lleva `data-pantalla`. Algunas partes llevan ademas `data-parte`:

| `data-pantalla` | Partes (`data-parte`) | Notas |
|---|---|---|
| `ficha` | `foto`, `titulo`, `descripcion`, `opciones`, `agregar` | |
| `carrito` | `lista`, `subtotal`, `continuar` | tambien el carrito vacio |
| `checkout` | `encabezado`, `indicador`, `siguiente`, `error`, `completar` | `data-paso="datos"`, `"entrega"` o `"pago"`; el paso activo del indicador lleva `aria-current="step"` |
| `confirmando` | | la animacion de 2,5 s tras enviar. **No trae tokens** (el verde y el blanco estan escritos en la pantalla): para cambiarlos hace falta `!important` |
| `pedido-recibido` | `titulo`, `codigo`, `total`, `seguimiento` | `total` solo aparece con doble moneda o envio a confirmar |
| `seguimiento` | `estado` | `data-estado="new"`, `"preparing"`, `"active"`, `"completed"` o `"cancelled"`; ademas las clases `tracker-*` |

### Cambiar colores y tipografia: primero los tokens

Casi todo se pinta con los tokens (`--bg --tx --t2 --t3 --ac --line --b2 --b3
--err --ok --font-heading --font-body --rs`). Se cambian por pantalla en
`pantallas.css`, sin tocar cada elemento:

```css
html[data-plantilla="cochi"] [data-pantalla="pedido-recibido"] {
  --bg: #d4120a;
  --tx: #fff;
  --font-heading: "Bebas Neue", sans-serif;
}
```

`!important` solo cuando un estilo escrito en la pantalla no usa token. Todo
selector empieza con `html[data-plantilla="cochi"]`, los `@keyframes` llevan
prefijo `cochi-` y las animaciones se apagan con `prefers-reduced-motion`.

### Sumar una decoracion (el cerdito, una animacion de fondo)

En `pantallas.js` registra un componente por lugar en `DECORACIONES`. Recibe
`{ datos }`, que son solo valores para mostrar (texto, numeros), congelados:

```jsx
import CochiPedidoRecibido from "./CochiPedidoRecibido";
export const DECORACIONES = { "pedido-recibido": CochiPedidoRecibido };

export default function CochiPedidoRecibido({ datos }) {
  // datos.codigo, datos.entrega ("retiro" | "envio"), datos.nombreLocal
  return <img src={cerdito} alt="" className="cochi-cerdito" />;
}
```

| Lugar | `datos` |
|---|---|
| `ficha` | `{ nombre, categoria }` |
| `carrito` | `{ cantidad }` |
| `checkout` | `{ paso }` |
| `confirmando` | `{}` |
| `pedido-recibido` | `{ codigo, entrega, nombreLocal }` |
| `seguimiento` | `{ estado, entrega }` |

La capa ocupa toda la pantalla y va **detras** del contenido: no recibe clics,
no se lee con lector de pantalla y si tu componente tira un error, la pantalla
sigue funcionando sin la capa. Los fondos opacos de la pantalla (barra de abajo,
tarjetas) la tapan: usa los tokens o `[data-parte]` para dejar pasar el fondo.

### Como verlas

- Ficha, carrito y checkout: `http://localhost:5173/?tenant=cochi`, agregando un
  producto como cualquier cliente.
- Las que necesitan un pedido enviado (en vista previa los pedidos no se
  envian) tienen una ruta con **datos de ejemplo**:
  - `/vista-previa/pedido-recibido?tenant=cochi`
  - `/vista-previa/confirmando?tenant=cochi`
  - `/vista-previa/seguimiento?tenant=cochi` (con `&estado=new|preparing|active|completed|cancelled`)

### Prohibido (si se rompe, el PR se rechaza en la revision)

Nada de ocultar ni tapar campos, botones, precios, totales, codigos o pasos:
`display: none`, `visibility: hidden`, `opacity: 0`, tamano 0, mover fuera de
pantalla o poner una capa encima. Tampoco se cambia el orden de los pasos ni lo
que se escribe en ellos.

## Datos que YA existen (revisalo antes de pedir datos nuevos)

El menu completo de datos disponibles esta en
[`docs/plataforma/PLANTILLAS-CATALOGO.md`](../../../../docs/plataforma/PLANTILLAS-CATALOGO.md).
En resumen, `config` puede traer (claves fijas, no se inventan otras):

- `secciones` (orden y visibilidad), `marca` (colores, fuentes, radio, logos,
  isotipo), `textos` (titulos, bajadas, botones de cada seccion), `anuncios`,
  `cinta`, `intro`, `flyers` (con fechas), `testimonios`, `submarca`.
- Por props: `products`, `categories`, `store`, `settings` (moneda, horario,
  eslogan), `cart`, `onAddToCart` y compania.

Si lo que queres mostrar cabe en eso, no necesitas nada mas.

## Datos nuevos (`necesita.md`)

Si tu idea necesita un dato que no existe (por ejemplo, un banner con fecha
limite), **esta bien que la sumes**, pero el dato tiene que existir en el
backend y eso lo cablea Divianco. Para que tu diseno se vea igual:

1. En el componente usa `conEjemplo(valorReal, ejemplo)` de
   `src/lib/vistaPrevia.js`. Muestra el ejemplo **solo en vista previa**; en
   produccion, si no hay dato real, no renderiza nada (devuelve `null`):

   ```jsx
   import { conEjemplo } from "../../../lib/vistaPrevia";
   const banner = conEjemplo(config.banner, { texto: "2x1 los martes", hasta: "2026-12-31" });
   if (!banner) return null;
   ```
2. En esta carpeta crea o actualiza `necesita.md`. Por cada pedido:

   ```
   ## <Titulo del pedido>
   **Donde se ve:** <seccion y pantalla>

   | Campo | Tipo | Ejemplo | Obligatorio |
   |---|---|---|---|
   | texto | texto (hasta 80) | 2x1 los martes | si |

   **Quien lo carga:** el duenio desde el panel (por defecto), u otro si aplica.
   ```

Con eso Ricky ve tu diseno en el preview y sabemos exactamente que hay que
conectar.

## El PR

- **Titulo** corto.
- **Descripcion** con tres partes:
  1. **Que cambie**: que se ve distinto.
  2. **Como lo hice**: la tecnica de animacion o diseno, para que Divianco la
     pueda reusar en otras plantillas.
  3. **Necesita datos nuevos?**: si es que si, apunta a `necesita.md`.
- Vercel deja el link del preview en el PR: ahi lo revisa Ricky. Si falta
  algo, te lo pide en el PR.
