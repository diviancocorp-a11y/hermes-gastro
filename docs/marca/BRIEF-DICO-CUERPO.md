# Brief — el cuerpo de Dico

> **Vigente desde el 25/sep/2026.** Reemplaza al brief del cuerpo Core, que
> pedía un disco liso sin cara para montarle una capa de tinta SVG encima.
> Ese camino se abandonó: ver "Lo que se dio de baja".

---

## Dico tiene DOS versiones y nada más

| | Qué es | Dónde vive | Quién la dibuja |
|---|---|---|---|
| **La marca** | El disco 2D. Oro, aro azul, dos óvalos negros. Sin boca ni nariz. | `public/brand/dico/dico-2d-*.png` | `DicoNative` |
| **El pet** | El personaje 3D completo, con brazos, guantes, piernas y botas. | `public/brand/dico/pet/dico-pet-atlas.webp` | `DicoPhysical` |

Las dos comparten la identidad: mismo oro, mismo aro azul, mismos dos óvalos
negros como ojos. **Esa es la prueba de que son el mismo personaje**, y es lo
único que no se negocia. Todo lo demás —piernas, guantes, animación— es
vocabulario que la marca no necesita y el pet sí.

Hay un contrato que lo sostiene: `src/test/dicoIdentidad.test.jsx` camina el
grafo de imports real desde `src/main.jsx` y falla si aparece un tercer cuerpo.

---

## La marca

Siete estados, uno por `nativeState`: `neutral`, `curious`, `happy`,
`celebrate`, `alert`, `concerned`, `question`. Comunica con **cejas y ojos**,
sin boca.

Se generan desde `platform/brand/dico-2d-masters/` y **no se editan a mano**:

```bash
node scripts/dico-2d-derivar.mjs --check
```

Es la versión que se usa cuando Dico tiene que estar **presente y chico**: la
barra lateral, un aviso, cualquier lugar donde entre a 30 o 40 píxeles. A ese
tamaño un render 3D se empasta y la tinta plana se lee.

---

## El pet

Un solo archivo: un atlas de **1536×2288**, ocho columnas por once filas,
**celda de 192×208**, setenta y tres cuadros dibujados.

```bash
npm run dico:pet:derive    # master PNG -> runtime WebP lossless
npm run dico:pet:check     # falla si el master cambió o el derivado difiere
```

El master es inmutable y se comprueba **por sha256**. Un atlas reexportado
"igual pero mejor" corre las celdas medio píxel y Dico empieza a temblar en
pantalla sin que falle nada más.

El derivado es **lossless a propósito**. Con pérdida, los bordes de cada celda
se manchan, y al recortar por `background-position` esa mugre aparece como un
halo del cuadro de al lado. No es una preferencia de calidad: es la diferencia
entre que el recorte funcione o no.

### Las once filas

| Fila | Cuadros | fps | Para qué |
|---|---|---|---|
| `idle` | 6 | 8 | reposo |
| `correDerecha` · `correIzquierda` · `corre` | 8 · 8 · 6 | 14 | sin uso todavía |
| `saluda` | 4 | 10 | `explain` |
| `salta` | 5 | 12 | `success` |
| `falla` | 8 | 10 | `error` |
| `espera` | 6 | 7 | `thinking` |
| `revisa` | 6 | 8 | `worried` |
| `miradaA` · `miradaB` | 8 + 8 | — | dieciséis direcciones fijas |

Las filas se llenan de izquierda a derecha y el resto queda transparente. Por
eso `cuadros` no es siempre ocho: animar las ocho columnas de `idle` haría
desaparecer a Dico dos veces por vuelta.

### Mirar no es señalar

`pointUp` y `pointDown` **no levantan el guante**: el pack no tiene esa pose.
Resuelven a una de las dieciséis direcciones de mirada, que dan la misma
instrucción con los ojos. Cero grados es **arriba**, en sentido horario.

Inventar un brazo levantado recortando otro cuadro habría sido dibujar una
anatomía que el personaje no tiene.

### El vocabulario de arriba no cambió

`physicalPose` sigue teniendo los mismos ocho valores. Lo que cambió es a qué
resuelven: antes a un archivo, ahora a una fila del atlas. Cambiar el
vocabulario habría obligado a tocar `DicoPresence`, `DicoAvisos` y cada llamada
del panel para no ganar nada.

---

## Cómo pedir arte nuevo

**Lo primero es la referencia.** Cualquier render nuevo se genera con
`public/brand/dico/dico-2d-neutral.png` a la vista. Los tres cuerpos que se
dieron de baja fallaron todos en lo mismo: se generaron sin ella y salió otro
personaje.

Lo que tiene que cumplir un render de Dico:

- **Oro pulido con aro azul.** El aro no es un adorno, es la mitad de la marca.
- **Dos óvalos negros como ojos. Sin boca, sin nariz, sin cejas, sin pestañas.**
  En cuanto aparece una boca deja de ser Dico y pasa a ser una moneda con cara.
- **Sin galera y sin bigote.** Se retiraron el 25/ago para darle identidad
  propia; volvieron dos veces por inercia del generador.
- **Fondo transparente de verdad**, sin halo. El error más común, y sólo se ve
  sobre negro.
- **Registro constante**: el personaje centrado en su celda y los pies a la
  misma altura en todos los cuadros. Sin eso el sprite tiembla.

Un sprite nuevo entra por `platform/brand/dico-pet-masters/`, se declara en
`platform/brand/dico-pet-assets.mjs` y se deriva con `npm run dico:pet:derive`.
El manifiesto es **la única fuente** de la geometría: lo leen el derivador, el
componente y el test. Repetir el tamaño de celda en dos lugares es exactamente
como el recorte termina corrido.

---

## Lo que se dio de baja el 25/sep/2026

Llegaron a convivir cuatro cuerpos y tres de ellos no reproducían la marca.

**El cuerpo Core** (`poses/moneda.webp` + `brazos.webp` + `CaraDeTinta.jsx`).
Un disco liso con la cara dibujada en SVG encima. La idea era buena —una
expresión nueva costaba dos curvas en vez de un render— pero el disco perdió
el aro azul, y la cara de tinta tenía esclerótica, párpados y cejas que la
marca no tiene. Con él se fueron `DicoCara`, `CaraDeTinta`, `DicoCoreEscena` y
`dico.css` entero: 436 líneas que ya no dibujaban nada.

**El pack 3D de ocho poses** (`platform/brand/dico-3d-masters/`). Mostaza en
vez de oro, ojos de dibujo con pestañas, nariz y boca. Era el que veían los
clientes cuando Dico aparecía en el panel.

**Las siete escenas heredadas** (`poses/escena-*.webp`). Galera y bigote. Ya
estaban marcadas como retiradas y los archivos seguían en el repo; sólo las
alcanzaban los tests.

Ninguno de los tres está más en el repo. El contrato anterior era más débil
—vivían ahí y sólo se prohibía alcanzarlos desde el bundle— y eso duró hasta
que alguien los volvió a importar.
