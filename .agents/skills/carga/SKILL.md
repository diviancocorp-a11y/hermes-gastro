---
name: carga
description: Prueba de carga del catalogo publico de DICO con k6 (solo lecturas) con 20, 50 y 100 usuarios, cruzada con pg_stat_statements, comparada contra el historial de docs/operacion/CARGA-K6.md. Usar cada 15 dias (la corre una tarea programada), antes de un pico o de sumar tenants, o cuando Ricky pide prueba de carga, k6, estres, cuantos usuarios aguanta o si el sistema esta lento bajo carga.
---

# Prueba de carga del catalogo (k6)

Mide si el edificio sigue aguantando la carga del catalogo y si algo empeoro
desde la corrida anterior. La referencia es `docs/operacion/CARGA-K6.md`:
leerla entera antes de empezar (que mide, que no, la linea base, el historial
y los incidentes conocidos).

## Reglas que no se negocian

- **Solo lecturas.** Nunca correr un escenario que cree pedidos contra un
  tenant real. No hay escenario de checkout todavia.
- **Solo el edificio** (`wwwzdgprsooyjgkuyoav`). El wrapper corta si la URL es
  otra; no saltearlo.
- **Corridas cortas**: meseta de 2 minutos. Nada de subir a mas de 100 usuarios
  sin que Ricky lo pida (gasta cuota del free tier y la PC puede ser el limite).
- **No tocar el rate limit** de `submit-order` ni ninguna config para que la
  prueba "pase".
- Un numero que no se midio no se reporta: si algo es deduccion, decirlo.

## Pasos

### 1. Precondiciones

- `scripts/carga/catalogo.js` existe en el checkout. Si no esta, la rama
  `prueba/k6` todavia no se mergeo: frenar y reportarlo, no improvisar otro
  script.
- `k6 version` responde (o `C:\Program Files\k6\k6.exe`, o `K6_BIN`). Si no,
  frenar y decir como instalarlo (`winget install k6 --source winget`, acepta
  el permiso de administrador).
- MCP de Supabase: `get_project` del edificio. Si esta `INACTIVE`, no probar:
  reportarlo (una prueba contra una base recien restaurada no mide nada).

### 2. Foto de la base antes

```sql
select calls, round(total_exec_time::numeric,1) total_ms, round(max_exec_time::numeric,1) max_ms
from extensions.pg_stat_statements
where query ilike 'WITH pgrst_source AS (SELECT pgrst_call.pgrst_scalar%'
  and query ilike '%get_catalog%'
order by calls desc limit 1;
```

### 3. Tres corridas, una detras de la otra

```bash
npm run carga:catalogo -- --vus=20 --meseta=2m
npm run carga:catalogo -- --vus=50 --meseta=2m
npm run carga:catalogo -- --vus=100 --meseta=2m
```

Cada una tarda ~3,5 min: correrlas en segundo plano y esperar el final. Leer
el **exit code** (0 verde, 99 se paso un umbral) y no filtrarlo con `tail`.
Despues de cada una, repetir la consulta del paso 2: la diferencia de `calls`
tiene que coincidir con las visitas de k6, y `total_ms` nuevo / `calls` nuevas
es el costo por llamada en Postgres.

De cada corrida anotar: visitas, errores, `get_catalog` med/p95/max,
`mp-status` med/p95/max, `visita_ms` p95, ms por llamada en Postgres y si el
maximo de Postgres se movio.

### 4. Si hubo errores

Clasificarlos por el mensaje de k6 (`Request Failed`), no por el porcentaje:

- `connectex`, `EOF`, `wsarecv`: red o borde de Cloudflare. Ya paso el 17/oct.
  Esperar 2 minutos y repetir esa corrida una vez. Si se repite, mirar Sentry
  y los logs de la API de Supabase en esa ventana para ver si clientes reales
  tambien fallaron.
- `429`: rate limit. No deberia pasar con lecturas: investigar que limita.
- `5xx`: el sistema fallo de verdad. Logs de Postgres y de la API con el MCP.

### 5. Comparar contra el historial

La tabla `## Historial` de `CARGA-K6.md` tiene una fila por corrida. Senial de
alarma, cualquiera de estas contra la corrida anterior con los mismos usuarios:

- errores > 0 que no sean de red;
- p95 de `get_catalog` 50% mas alto;
- ms por llamada en Postgres el doble.

Si hay alarma: `get_advisors` (performance) y las consultas mas caras de
`pg_stat_statements` para encontrar la causa. Proponer el arreglo; no
aplicarlo sin el ok de Ricky (es base o `src/`).

### 6. Escribir y commitear

- Sumar las filas nuevas a `## Historial` en `docs/operacion/CARGA-K6.md`, con
  la fecha absoluta. Si hubo incidente, una linea abajo de la tabla.
- Commit chico a `main` con **ruta explicita** (nunca `git add -A`: Codex y
  otras sesiones trabajan en el mismo repo). Si `CARGA-K6.md` tiene cambios
  ajenos sin commitear, no commitear y reportarlo. Push y `npm run ci:esperar`.

### 7. Reporte para Ricky

Breve, en espanol argentino:

- veredicto en una linea: **verde**, **empeoro** (que y cuanto) o **rojo**;
- la tabla de las tres corridas contra la anterior;
- el SHA del commit;
- una mejora concreta al sistema o al proceso que salga de los numeros.
