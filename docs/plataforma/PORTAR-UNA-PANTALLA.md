# Portar una pantalla al edificio

> Ricky pasa un render, se rehace la pantalla. Este documento es el orden en
> que conviene hacerlo, y existe porque la primera vez salió mal de una forma
> que nada detectó.

## Lo que pasó con Stock

Se portó la lista y **se olvidó el alta y la edición de insumos**, que el
componente viejo sí tenía. Quedó publicado así. El build pasaba, los 1338 tests
pasaban y la pantalla se veía igual al render: no había nada que lo delatara
salvo intentar usarla.

La lección: **portar una pantalla es portar lo que HACE, no lo que muestra.** Un
test de render no nota la diferencia, y una captura tampoco.

Además, tres defectos visuales salieron sólo de mirar la pantalla armada. Un
`180% del mínimo` sin topear, la etiqueta del buscador saliendo como título y un
nombre de insumo cortado justo donde hay que saber qué se está contando. Ninguno
rompe un test.

## El orden

### 1. Inventariar lo que hace la pantalla vieja

```bash
npm run pantalla:acciones -- src/components/admin/Stock.jsx
```

Devuelve botones, callbacks, aperturas y escrituras. Esa lista es el contrato:
todo lo que está ahí o se porta, o se decide sacar **a propósito**.

### 2. Mirar los datos reales antes de diseñar

La referencia siempre muestra la pantalla llena y andando. La base casi nunca
está así. Antes de escribir nada, contar lo que hay:

```sql
select count(*), count(*) filter (where min_stock > 0) from ingredients;
```

En Stock eso cambió el diseño entero: ningún insumo tenía mínimo cargado, y toda
la pantalla se apoyaba en comparar contra el mínimo. De ahí salió el estado
`sin-minimo`, que no estaba en el render.

### 3. Escribir la pantalla

Reusar el vocabulario que ya existe: `ag-salon-*` y `ag-caja-*` fijaron el
idioma —superficie con borde, filete de acento arriba de lo que manda, números
en tabular, el detalle al costado y no en un modal—. Una pantalla nueva no
inventa el suyo.

Los tokens semánticos (`--ag-ok`, `--ag-warn`, `--ag-bad`) pintan estado. **El
oro no pinta estados**: marca la selección y la acción principal.

### 4. Mirarla

```bash
npm run pantalla -- stock
```

Arma `.preview/pantallas.html` con la pantalla a los anchos que de verdad
cambian su layout. **Abrirlo en Chrome**: el panel de preview interno lo achica
y a veces lo pinta en blanco.

Las muestras se declaran en `scripts/pantalla/muestras.mjs`. Una muestra buena
incluye, además de lo bonito:

- el caso vacío o sin dato, que en el edificio suele ser el normal
- el nombre largo que no entra
- el número grande que desborda la celda

Si la pantalla tiene un panel de detalle, la muestra tiene que abrirlo. Un
render sin selección muestra la ficha vacía y deja la mitad sin revisar.

### 5. Comparar contra la vieja antes de darla por terminada

```bash
npm run pantalla:acciones -- src/components/admin/Stock.jsx src/components/admin/platform/StockPanel.jsx
```

Lo que aparece como faltante **es una pregunta, no un error**: ¿se movió a otro
lado, se decidió sacarla, o se olvidó? Las que se portan merecen un test; las
que se sacan, una línea en el commit explicando por qué.

### 6. Tests de lo que hace, no de lo que muestra

Un test por acción del inventario. En Stock, el que agarró un bug real fue el
que verificaba que la merma llegara **con su cantidad y su motivo**: el panel
los estaba descartando y la pantalla se veía perfecta.

## Lo que estas herramientas no son

`pantalla:acciones` lee texto. No entiende indirecciones, handlers armados en
runtime ni acciones que viven en otro archivo. Por eso **no está en el
pre-commit**: un gate que se equivoca a veces se termina salteando siempre.

`pantalla` renderiza el primer pintado, sin efectos y sin base. Si una pantalla
se ve rota con las listas vacías, está rota de verdad; pero que se vea bien no
prueba que funcione.

Ninguna de las dos reemplaza abrir el panel y usarlo.
