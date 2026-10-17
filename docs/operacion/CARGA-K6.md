# Pruebas de carga con k6

Herramienta en prueba (rama `prueba/k6`, 17/oct/2026). k6 es de Grafana, open
source, y los escenarios se escriben en JS.

## Que se prueba y que no

- **Si: Supabase**, que es free tier y lo comparten todos los tenants.
- **No: el front.** Es un bundle estatico en la CDN de Vercel; cargarlo no
  dice nada del sistema.
- **No: pedidos contra tenants reales.** Un pedido crea un pedido de verdad,
  avisa a la comandera (push y Telegram) y descuenta stock. El escenario de
  checkout necesita un tenant de prueba propio, y crearlo pide el ok de Ricky.
- `submit-order` corta a los **10 pedidos por minuto por IP** (`check_rate_limit`).
  Desde una sola maquina, un 429 a partir del pedido 11 es la proteccion
  andando, no un bug.

## Escenario `catalogo` (solo lecturas)

`scripts/carga/catalogo.js` repite lo que hace una visita real al catalogo,
medido en el navegador sobre crazy-miga.divianco.app:

| Llamada | Que es | Escribe en la base |
|---|---|---|
| `POST /rest/v1/rpc/get_catalog` | settings + productos | No (`stable`, sin DML) |
| `POST /functions/v1/mp-status` | si el negocio ofrece MercadoPago | No (solo selects) |
| imagenes de Storage | opcional (`--imagenes`): gasta egress | No |

Cada usuario virtual hace una visita y espera entre 10 y 30 s, como una persona
que mira el catalogo. Por eso 20 usuarios virtuales son unas 0,8 visitas por
segundo, no 20 por segundo.

Umbrales (si alguno se pasa, k6 sale con codigo distinto de 0, como un gate):
`get_catalog` p95 < 800 ms, `mp-status` p95 < 1500 ms, menos del 1% de visitas
rotas.

## Como se corre

```bash
npm run carga:catalogo
npm run carga:catalogo -- --vus=50 --meseta=5m
npm run carga:catalogo -- --tenants=crazy-miga --imagenes
```

El wrapper (`scripts/carga/correr.mjs`) lee la URL y la key publicable del
`.env` del edificio y corta si la URL no es la del edificio. El resumen JSON
queda en el temp del sistema.

**k6 sin permisos de admin:** `winget install k6 --source winget` pide UAC. Si
no se puede, bajar el zip del release (`k6-vX.Y.Z-windows-amd64.zip`),
verificar el checksum contra `k6-vX.Y.Z-checksums.txt` y apuntar
`K6_BIN=<ruta a k6.exe>`.

Mantener las corridas cortas (minutos): `mp-status` es una invocacion de edge
function por visita y el free tier tiene cuota mensual.

## Linea base (17/oct/2026, 20 usuarios, 4m30s)

Tenants: la-nona-pato, crazy-miga y cochi. Desde la PC de Ricky.

| Metrica | med | p95 | max |
|---|---|---|---|
| `get_catalog` (k6, de punta a punta) | 116 ms | 204 ms | 444 ms |
| `mp-status` (k6, de punta a punta) | 273 ms | 375 ms | 704 ms |
| `get_catalog` dentro de Postgres | ~3 ms por llamada | | |

239 visitas, 478 requests, **0 errores**. ~12 KB por visita.

El tiempo de Postgres sale de `pg_stat_statements`: antes de la corrida, 968
llamadas y 19,5 s en total; despues, 1207 llamadas, o sea que las 239 de k6
sumaron ~0,66 s. **A 20 usuarios la base no es el cuello de botella**: casi
todo el tiempo es red y PostgREST.

## Lo que salio para mejorar

1. **`mp-status` en cada visita.** Es una edge function por visita (cuota del
   free tier) y es la llamada mas lenta. En el navegador, con la funcion
   fria, tardo 2,6 s. Solo hace falta para ofrecer MercadoPago en el checkout:
   se puede pedir al abrir el checkout, o sumar un `mp_conectado` a
   `get_catalog`. Cambia codigo de `src/`: pide ok de Ricky.
2. **Advisors de performance (17/oct):** 15 `auth_rls_initplan` y 54
   `multiple_permissive_policies`. **No tocan el catalogo** (`get_catalog` es
   SECURITY DEFINER) pero si el panel (`orders`, `order_items`, `profiles`,
   `staff`).

## Siguientes pasos

- Repetir con 50 y 100 usuarios para ver donde se dobla la curva.
- Escenario de panel (logueado): ahi pegan las policies de los advisors.
- Escenario de checkout contra un tenant de prueba, a ritmo bajo.
