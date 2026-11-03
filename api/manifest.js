// api/manifest.js — manifest PWA por tenant (Vercel serverless).
//
// El manifest estatico que emite vite (/manifest.json) lleva el nombre y el
// icono del client del BUILD. En el edificio todos los tenants comparten ese
// build, asi que "Agregar a pantalla de inicio" instalaba siempre el mismo
// local. Este endpoint lo resuelve por tenant.
//
// El slug sale del query (?slug=) o, si no viene, del Host: asi el manifest
// tambien es correcto cuando el browser lo pide sin pasar por nuestro JS.
//
// Hay dos apps por negocio en el mismo origen, separadas por `id` y `scope`:
// el catalogo (`/`, la instala el cliente) y el panel (`?app=panel`, abre en
// `/admin`, la instala el duenio y su equipo). Con el mismo id el browser las
// tomaria como una sola y la segunda pisaria a la primera.

const PLATFORM_ROOTS = ['divianco.app'];

// Chrome exige un icono cuadrado de al menos 144px para ofrecer la
// instalacion; 192 es el minimo que recomienda para la pantalla de inicio.
const ICONO_MINIMO = 192;

// Lo justo para leer la cabecera de un PNG/JPEG/WebP sin bajar la imagen
// entera (hay logos de 1,3MB).
const BYTES_CABECERA = 65535;

function slugFromHost(host) {
  const h = String(host || '').toLowerCase().replace(/:\d+$/, '');
  for (const root of PLATFORM_ROOTS) {
    if (h === root || h === `www.${root}`) return null;
    if (h.endsWith(`.${root}`)) {
      const prefix = h.slice(0, -(root.length + 1));
      if (!prefix.includes('.') && prefix !== 'www') return prefix;
    }
  }
  return null;
}

function contrastOn(hex) {
  const h = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return '#ffffff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? '#111111' : '#ffffff';
}

function letterIcon(letter, bg) {
  const ch = String(letter || 'H').trim().charAt(0).toUpperCase() || 'H';
  const fg = contrastOn(bg);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">`
    + `<rect width="512" height="512" rx="112" fill="${bg}"/>`
    + `<text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="${fg}"`
    + ` font-family="system-ui,-apple-system,Segoe UI,sans-serif"`
    + ` font-size="300" font-weight="700">${ch}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Ancho, alto y tipo de una imagen leyendo solo su cabecera.
 * Devuelve null si el formato no es PNG, JPEG ni WebP o la cabecera no
 * alcanza: en ese caso el icono no se declara (mejor la letra que un tamanio
 * inventado, que hace que Chrome rechace la instalacion).
 */
export function medidasDeImagen(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf || []);
  const u16 = (i) => (b[i] << 8) | b[i + 1];
  const u32 = (i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

  // PNG: firma de 8 bytes y el IHDR con ancho y alto en 16..23.
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { w: u32(16), h: u32(20), type: 'image/png' };
  }

  // JPEG: se recorren los segmentos hasta el SOF (baseline o progresivo).
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marca = b[i + 1];
      const largo = u16(i + 2);
      if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
        return { w: u16(i + 7), h: u16(i + 5), type: 'image/jpeg' };
      }
      i += 2 + largo;
    }
    return null;
  }

  // WebP: RIFF....WEBP y el chunk VP8 / VP8L / VP8X.
  if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === 'VP8X') {
      return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)), type: 'image/webp' };
    }
    if (chunk === 'VP8 ') {
      return { w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff, type: 'image/webp' };
    }
    if (chunk === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1, type: 'image/webp' };
    }
  }
  return null;
}

/**
 * El logo sirve de icono solo si es cuadrado y alcanza el minimo. Un logo
 * apaisado o vertical (Crazy Miga es 704x1524) el sistema lo deformaria o lo
 * recortaria, asi que para esos queda la inicial sobre el color de marca.
 */
async function iconoDeImagen(url) {
  if (!url || !/^https:\/\//i.test(url)) return null;
  try {
    const r = await fetch(url, {
      headers: { Range: `bytes=0-${BYTES_CABECERA}` },
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return null;
    const m = medidasDeImagen(new Uint8Array(await r.arrayBuffer()));
    if (!m || m.w !== m.h || m.w < ICONO_MINIMO) return null;
    return { src: url, sizes: `${m.w}x${m.h}`, type: m.type, purpose: 'any' };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const slug = url.searchParams.get('slug') || slugFromHost(req.headers.host);
  const esPanel = url.searchParams.get('app') === 'panel';

  // Sin tenant (raiz de la plataforma): manifest de Dico, no de un local.
  let name = 'Dico';
  let color = '#0f0e0d';
  let letter = 'D';
  let imagenes = [];

  if (slug) {
    try {
      const base = process.env.VITE_SUPABASE_URL;
      const key = process.env.VITE_SUPABASE_ANON_KEY;
      // get_tenant_brand y no get_catalog: el manifest solo necesita la marca,
      // y get_catalog trae el catalogo entero en cada pedido.
      const r = await fetch(`${base}/rest/v1/rpc/get_tenant_brand`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_slug: slug }),
      });
      if (r.ok) {
        const brand = await r.json();
        if (brand?.name) {
          name = brand.name;
          color = brand.logo_color || color;
          letter = brand.logo_letter || name.charAt(0);
          imagenes = [...new Set([brand.logo_url, brand.favicon_url].filter(Boolean))];
        }
      }
    } catch {
      // Se cae al manifest generico: un manifest de mas vale mas que un 500
      // que rompe la instalacion de la PWA.
    }
  }

  const letra = letterIcon(letter, color);
  const propios = (await Promise.all(imagenes.map(iconoDeImagen))).filter(Boolean);
  const raiz = esPanel ? '/admin' : '/';

  const manifest = {
    id: raiz,
    name: esPanel ? `${name} · Panel` : name,
    short_name: name.slice(0, 12),
    description: esPanel ? `Panel de ${name}: pedidos, stock y ventas.` : undefined,
    lang: 'es-AR',
    start_url: raiz,
    scope: raiz,
    display: 'standalone',
    theme_color: color,
    background_color: color,
    // El logo propio va primero; la letra queda de respaldo por si el
    // sistema no puede usarlo (y es lo unico que hay si no cargaron logo).
    icons: [
      ...propios,
      { src: letra, sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: letra, sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
    ],
  };

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  // Cachea en el edge pero permite refrescar rapido si el tenant cambia su
  // marca: 5 min fresco, 1 dia sirviendo el viejo mientras revalida.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(JSON.stringify(manifest));
}
