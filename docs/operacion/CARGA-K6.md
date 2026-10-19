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
npm run carga:catalogo -- --sin-mp           # la visita sin mp-status
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

## 50 y 100 usuarios (17/oct/2026, misma prueba)

Mismo escenario y mismos tenants: 1m de subida, 3m de meseta y 30s de bajada.

| Usuarios | Visitas | Visitas/s | Errores | `get_catalog` med / p95 / max | `mp-status` med / p95 / max |
|---|---|---|---|---|---|
| 20 | 239 | 0,8 | 0 | 116 / 204 / 444 ms | 273 / 375 / 704 ms |
| 50 | 576 | 2,0 | 0 | 112 / 250 / 3610 ms | 260 / 454 / 2730 ms |
| 100 | 1153 | 3,9 | 0 | 112 / 261 / 6690 ms | 253 / 462 / 6880 ms |

Cruzado con `pg_stat_statements` (la fila de `get_catalog` via PostgREST),
foto antes y despues de cada corrida:

| Usuarios | Llamadas nuevas | Tiempo en Postgres | Por llamada | Max en Postgres |
|---|---|---|---|---|
| 20 | 239 | ~0,66 s | ~3 ms | 185 ms (viejo, no se movio) |
| 50 | 576 | 1,58 s | 2,7 ms | 185 ms (no se movio) |
| 100 | 1153 | 3,02 s | 2,6 ms | 185 ms (no se movio) |

Las llamadas nuevas coinciden una a una con las visitas de k6: nadie mas
llamo a `get_catalog` en esas ventanas.

**Lectura:**

- **Hasta 100 usuarios la curva no se dobla.** La mediana queda clavada en
  ~112 ms, el p95 sube apenas (204 -> 261 ms) y no hubo ni un error en 2306
  requests. 100 usuarios con tiempo de persona real son unas 230 visitas por
  minuto, muy por encima del pico de cualquier tenant de hoy.
- **Postgres ni se entera:** el costo por llamada baja con la carga (cache
  caliente) y el maximo no se movio en ninguna corrida.
- **Los picos (3,6 s con 50, 6,7-6,9 s con 100) no salen de la base**, eso
  esta comprobado. Que en la corrida de 100 los dos maximos (`get_catalog` y
  `mp-status`) casi coincidan sugiere un mismo lote trabado en la red o en el
  gateway de Supabase, pero es una deduccion: k6 no guarda cada request y no
  esta medido. Son casos aislados: el p95 no los ve.
- **Cuota:** las cuatro corridas del dia sumaron ~1970 invocaciones de
  `mp-status`, nada contra la cuota mensual del free tier.
- Todo medido desde una sola PC en Argentina: la red de esa PC entra en los
  numeros de punta a punta.

## mp-status: antes y despues simulado (17/oct/2026)

`--sin-mp` corre la visita sin `mp-status`, como quedaria si se pide recien
cuando hay carrito. `visita_ms` es lo que espera la visita: el mas lento de
los pedidos que salen juntos. 100 usuarios, 2m de meseta, una corrida pegada a
la otra:

| | Requests | Invocaciones de edge | `visita_ms` med / p95 / max | Errores |
|---|---|---|---|---|
| Antes (con `mp-status`) | 1736 | 868 | 248 / 340 / 1780 ms | 0 |
| Despues (`--sin-mp`) | 880 | 0 | 111 / 183 / 1200 ms | 0 |

La mitad de los requests por visita y ninguna invocacion de edge function. Los
tiempos son de los pedidos de red: **el render de la home no espera a
`mp-status`** (es un `useEffect` aparte en `Catalog.jsx`), asi que lo que se
gana es cuota y una conexion menos compitiendo en el primer segundo (pesa en
datos moviles), no que la home pinte 130 ms antes.

**Incidente de red en la primera corrida "antes":** 19% de visitas rotas, p90
de 19 s. No fue la base ni un 429: fueron conexiones TCP que no se abrieron o
se cortaron (`connectex`, `EOF`) contra las IPs de Cloudflare que estan delante
de Supabase. La corrida siguiente dio 0 errores y la repeticion del "antes"
tambien. No se sabe si fue la red de la PC o el borde de Supabase. Si vuelve a
pasar, mirar si los clientes reales tuvieron errores en esa ventana (Sentry,
logs de la API).

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

- Buscar donde se dobla la curva por encima de 100 (200, 400). Desde una sola
  PC el limite puede ser la PC: si k6 avisa de CPU alta, el numero no vale.
- Guardar cada request (`--out csv=...` al temp) para ver si los picos de varios
  segundos caen todos en el mismo momento.
- Escenario de panel (logueado): ahi pegan las policies de los advisors.
- Escenario de checkout contra un tenant de prueba, a ritmo bajo.

## Historial

Lo corre la skill `/carga` (`.claude/skills/carga/SKILL.md`) cada 15 dias, los
dias 1 y 16 a las 10:00, desde una tarea programada de la app de Claude en la
PC de Ricky. Si la app esta cerrada a esa hora, corre al abrirla. Una fila por
corrida; se compara contra la anterior con los mismos usuarios.

| Fecha | Usuarios | Meseta | Visitas | Errores | `get_catalog` med / p95 | `mp-status` med / p95 | `visita_ms` p95 | Postgres por llamada |
|---|---|---|---|---|---|---|---|---|
| 2026-10-17 | 20 | 3m | 239 | 0 | 116 / 204 ms | 273 / 375 ms | - | ~3 ms |
| 2026-10-17 | 50 | 3m | 576 | 0 | 112 / 250 ms | 260 / 454 ms | - | 2,7 ms |
| 2026-10-17 | 100 | 3m | 1153 | 0 | 112 / 261 ms | 253 / 462 ms | - | 2,6 ms |
| 2026-10-17 | 100 | 2m | 868 | 0 | 111 / 175 ms | 248 / 337 ms | 340 ms | - |
