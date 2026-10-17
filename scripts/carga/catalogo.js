// scripts/carga/catalogo.js — prueba de carga del catalogo publico (k6).
//
// Solo lecturas: hace lo mismo que una visita real al catalogo y NO crea
// pedidos. Medido en el navegador el 17/oct sobre crazy-miga.divianco.app,
// una visita le pide a Supabase:
//   - POST /rest/v1/rpc/get_catalog  { p_tenant_slug }  (settings + productos)
//   - POST /functions/v1/mp-status   { tenant_slug }    (si ofrece MercadoPago)
//   - las imagenes de Storage (opcional, CARGA_IMAGENES=1: gasta egress)
// Las dos primeras salen juntas, igual que en el front.
//
// El front estatico (Vercel) no se prueba: es CDN y no dice nada del sistema.
//
// Se corre con `npm run carga:catalogo`, que lee la URL y la key publicable
// del .env del edificio. Variables:
//   CARGA_VUS       usuarios virtuales en la meseta (default 20)
//   CARGA_MESETA    duracion de la meseta (default 3m)
//   CARGA_TENANTS   slugs separados por coma (default los tres con catalogo)
//   CARGA_IMAGENES  1 para bajar tambien las imagenes de los productos

/* global __ENV */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const URL = __ENV.SUPABASE_URL;
const KEY = __ENV.SUPABASE_KEY;
if (!URL || !KEY) throw new Error('Faltan SUPABASE_URL y SUPABASE_KEY (usar npm run carga:catalogo)');

const VUS = Number(__ENV.CARGA_VUS || 20);
const MESETA = __ENV.CARGA_MESETA || '3m';
const TENANTS = (__ENV.CARGA_TENANTS || 'la-nona-pato,crazy-miga,cochi').split(',').map((s) => s.trim()).filter(Boolean);
const IMAGENES = __ENV.CARGA_IMAGENES === '1';

const tCatalogo = new Trend('get_catalog_ms', true);
const tMpStatus = new Trend('mp_status_ms', true);
const visitaRota = new Rate('visita_rota');

export const options = {
  scenarios: {
    catalogo: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: VUS },
        { duration: MESETA, target: VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  // Si se pasa de estos umbrales k6 sale con codigo distinto de 0, como un gate.
  thresholds: {
    get_catalog_ms: ['p(95)<800'],
    mp_status_ms: ['p(95)<1500'],
    visita_rota: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
};

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

export default function () {
  const slug = TENANTS[Math.floor(Math.random() * TENANTS.length)];

  const [rCat, rMp] = http.batch([
    ['POST', `${URL}/rest/v1/rpc/get_catalog`, JSON.stringify({ p_tenant_slug: slug }),
      { headers: HEADERS, tags: { name: 'get_catalog', tenant: slug } }],
    ['POST', `${URL}/functions/v1/mp-status`, JSON.stringify({ tenant_slug: slug }),
      { headers: HEADERS, tags: { name: 'mp-status', tenant: slug } }],
  ]);

  tCatalogo.add(rCat.timings.duration, { tenant: slug });
  tMpStatus.add(rMp.timings.duration, { tenant: slug });

  let productos = [];
  const ok = check(rCat, {
    'get_catalog 200': (r) => r.status === 200,
    'get_catalog trae productos': (r) => {
      try {
        productos = r.json('products') || [];
        return Array.isArray(productos) && productos.length > 0;
      } catch {
        return false;
      }
    },
  }) && check(rMp, { 'mp-status 200': (r) => r.status === 200 });
  visitaRota.add(!ok);

  if (IMAGENES) {
    // La home muestra las primeras; el navegador las pide en paralelo.
    const urls = productos.map((p) => p.image || p.image_url || p.img).filter(Boolean).slice(0, 6);
    if (urls.length) http.batch(urls.map((u) => ['GET', u, null, { tags: { name: 'imagen' } }]));
  }

  // Tiempo de persona real mirando el catalogo antes de la siguiente visita.
  sleep(10 + Math.random() * 20);
}
