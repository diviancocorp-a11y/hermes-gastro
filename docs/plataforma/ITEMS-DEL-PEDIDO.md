# Forma del `items[]` que manda el catalogo a `submit-order`

Fase 4 de Cochi (opciones por producto y sugerencias al pedir). La toma la
fase 5 (carrito y checkout). Migracion: `0135`. Logica del servidor:
`platform/functions/submit-order/opciones.ts` (pura, con tests en
`src/test/opcionesPedido.test.js`).

## Item

```js
{
  recipeId: "<uuid del producto>",   // nombre historico; productId tambien se acepta
  qty: 2,                            // entero 1..999
  selection: [                       // opcional; solo si el producto tiene option_groups
    { groupId: "extras", choiceId: "queso", qty: 2 }   // qty opcional, default 1
  ],
  suggestionId: "<uuid de product_suggestions>",       // opcional
  note: "sin cebolla"                // opcional, una linea, se corta a 140
}
```

- **El cliente nunca manda el precio.** `unitPrice` (que el front viejo todavia
  manda) se ignora. El servidor lo recalcula de la base en cada pedido.
- **Item viejo `{recipeId, qty}`** (deploys anteriores, carritos en cache) sigue
  andando igual, y inserta exactamente las mismas columnas que antes. Excepcion
  honesta: un producto con grupos obligatorios no se puede pedir sin elegirlos
  (400, `"<producto>: Elegi al menos 1 en \"<grupo>\""`).
- Una linea por configuracion: el mismo producto con otras opciones o otra
  nota es OTRA linea. La clave de linea del carrito tiene que incluir
  `selection` + `note` + `suggestionId`.
- La sugerencia viaja como una linea del producto sugerido
  (`recipeId` = `add_product_id` de la regla) con `suggestionId`.

## Como se calcula (servidor)

```
unit = min(precio del dia, special_price si la sugerencia vale)   // no se acumulan
unit += sum(choice.price * qty)                                   // extras: el descuento NO los toca
subtotal = qty * unit        (redondeo a 2 decimales)
```

- Cada `groupId`/`choiceId` se busca en `products.option_groups` de la base
  (con `tenant_id`). Id inexistente, cantidad fuera de `max_qty`, grupo
  `single` con dos elecciones, `min`/`max` incumplidos: **400** y no se crea nada.
- Sugerencia valida si: la regla es del tenant y esta activa; esta dentro de
  fechas, dias y horas **en la zona horaria del tenant**; `add_product_id` es el
  producto de esa linea; y las unidades promo no superan
  `unidades de la categoria elegible x max_per_item`.
  Si algo falla **no se rechaza el pedido**: esa linea se cobra a precio normal.

## Respuesta

```js
{ ok, orderId, total, discount, tip, delivery_cost, review_status, risk_flags,
  warnings?: [{ code: "suggestion_expired" | "suggestion_invalid" | "suggestion_limit", productId }] }
```

`warnings` solo aparece si hay algo que avisar. El total que devuelve es el
verdadero: el front tiene que mostrarlo (si difiere del que mostro, es por esto).

## Que queda guardado en `order_items`

| Columna | Contenido |
|---|---|
| `unit_price`, `subtotal` | ya con extras y precio especial |
| `selection` (jsonb, null si no hay) | `[{group, choice, label, qty, price}]` congelado |
| `suggestion_id` | regla aplicada (null si no valio) |
| `note` | texto para cocina, **una linea**: opciones primero, nota del cliente despues |

Formato de `note`: `Alitas, Papas x2 | Nota: sin cebolla`. Sin nombre del grupo
(la comandera de 58 mm tiene 32 columnas). KDS, comandera y ticket de papel ya
imprimen `order_items.note`: no se tocaron.

## Catalogo (`get_catalog`)

Cada producto trae `option_groups`:
`[{id, name, type: 'single'|'multiple', required?, min?, max?, choices: [{id, label, price?, max_qty?}]}]`
(defaults: `min` = 1 si `required` si no 0; `max` = 1 si `single` si no la cantidad
de choices). Y el nivel raiz trae `suggestions[]` (solo activas):
`{id, title, body, when_categories, add_product_id, special_price, max_per_item, days, start_time, end_time, start_date, end_date}`.

## Orden de despliegue

1. Aplicar `0135`. 2. Publicar `submit-order`. 3. Publicar el front.
El front solo muestra opciones si `get_catalog` las trae, asi que mientras la
0135 no este aplicada no cambia nada.
