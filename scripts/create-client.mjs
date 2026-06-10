#!/usr/bin/env node
/**
 * create-client.mjs — Onboarding script for new clients.
 *
 * Genera SOLO archivos nuevos por tenant (clients/<slug>/business.js y
 * .env.<slug>) e imprime los pasos manuales para terminar el onboarding.
 *
 * NO toca archivos compartidos del repo:
 *   - manifest.json e index.html (title/description/theme-color) se generan
 *     por tenant en build via businessHtmlPlugin en vite.config.js
 *   - public/sw.js es generico (no tiene nombre de negocio hardcodeado)
 *   - el schema de DB vive en supabase/migrations/000_initial_schema.sql
 *     (source of truth, se corre en el SQL Editor del proyecto nuevo)
 *   - feature_flags se seedea en 000_initial_schema.sql y se ajusta por
 *     tenant via SQL (el script imprime el bloque listo para pegar)
 *
 * Usage:
 *   node scripts/create-client.mjs
 *   node scripts/create-client.mjs --name "Mi Panaderia" --type bakery
 *
 * Interactive mode (no flags) walks through all fields step by step.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Helpers ────────────────────────────────────────────────

function readFile(path) {
  return readFileSync(path, 'utf-8');
}

function writeFile(path, content) {
  writeFileSync(path, content);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(question, defaultVal = '') {
  const suffix = defaultVal ? ` (${defaultVal})` : '';
  return new Promise(resolve => {
    rl.question(`  ${question}${suffix}: `, answer => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

function heading(text) {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ${text}`);
  console.log('═'.repeat(50));
}

// ─── CLI args parsing ───────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const val = args[i + 1];
    if (key && val) parsed[key] = val;
  }
  return parsed;
}

// ─── Business types with presets ────────────────────────────

const BUSINESS_PRESETS = {
  bakery: {
    type: 'bakery',
    tagline: 'Panadería Artesanal',
    mascotEmoji: '🍞',
    categories: ['Panes', 'Facturas', 'Tortas', 'Galletitas', 'Budines', 'Bebidas'],
  },
  restaurant: {
    type: 'restaurant',
    tagline: 'Restaurante',
    mascotEmoji: '🍽️',
    categories: ['Entradas', 'Platos Principales', 'Pastas', 'Carnes', 'Postres', 'Bebidas'],
  },
  pizzeria: {
    type: 'pizzeria',
    tagline: 'Pizzería',
    mascotEmoji: '🍕',
    categories: ['Pizzas', 'Empanadas', 'Calzones', 'Bebidas', 'Postres'],
  },
  cafe: {
    type: 'cafe',
    tagline: 'Cafetería',
    mascotEmoji: '☕',
    categories: ['Cafés', 'Infusiones', 'Pastelería', 'Sándwiches', 'Jugos'],
  },
  icecream: {
    type: 'icecream',
    tagline: 'Heladería Artesanal',
    mascotEmoji: '🍦',
    categories: ['Helados', 'Postres Helados', 'Batidos', 'Tortas Heladas', 'Toppings'],
  },
  grocery: {
    type: 'grocery',
    tagline: 'Almacén Natural',
    mascotEmoji: '🛒',
    categories: ['Frutas', 'Verduras', 'Lácteos', 'Carnes', 'Almacén', 'Bebidas'],
  },
  custom: {
    type: 'custom',
    tagline: '',
    mascotEmoji: '🏪',
    categories: [],
  },
};

// ─── Color presets ──────────────────────────────────────────

const COLOR_PRESETS = {
  terracotta: { accent: '#C45D3E', bg: '#FBF7F2', tx: '#2D1B0E' },
  ocean:      { accent: '#1B4F72', bg: '#F5F8FA', tx: '#1C2833' },
  forest:     { accent: '#27674A', bg: '#F5FAF7', tx: '#1B2E20' },
  rose:       { accent: '#C2185B', bg: '#FDF5F8', tx: '#3E1929' },
  mustard:    { accent: '#B7950B', bg: '#FFFCF2', tx: '#2C2407' },
  purple:     { accent: '#6C3483', bg: '#FAF5FC', tx: '#2C1338' },
};

// ─── Edge functions del repo (supabase/functions/) ──────────
// afip-invoice queda afuera: es un stub, NO se deploya.
const EDGE_FUNCTIONS = [
  'submit-order', 'get-catalog', 'send-push', 'admin-users',
  'create-payment-preference', 'mp-webhook', 'mp-status',
  'mp-connect-manual', 'mp-oauth-callback', 'validate-coupon',
  'scheduled-export', 'sentry-to-telegram',
];

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const cliArgs = parseArgs();

  heading('🚀 Nuevo cliente — Configuración');

  // 1. Business basics
  console.log('\n📋 Datos del negocio:\n');
  const name = cliArgs.name || await ask('Nombre del negocio');
  const shortName = cliArgs.short || await ask('Nombre corto', name.split(' ')[0]);

  console.log('\n  Tipos disponibles: bakery, restaurant, pizzeria, cafe, icecream, grocery, custom');
  const type = cliArgs.type || await ask('Tipo de negocio', 'bakery');
  const preset = BUSINESS_PRESETS[type] || BUSINESS_PRESETS.custom;

  const tagline = cliArgs.tagline || await ask('Eslogan / tagline', preset.tagline);
  const phone = cliArgs.phone || await ask('Teléfono (con código de país)', '+549');
  const whatsapp = cliArgs.whatsapp || await ask('WhatsApp (mismo o diferente)', phone);
  const address = cliArgs.address || await ask('Dirección');

  // 2. Branding
  heading('🎨 Branding');
  console.log('\n  Paletas: terracotta, ocean, forest, rose, mustard, purple');
  const palette = cliArgs.palette || await ask('Paleta de colores', 'terracotta');
  const colors = COLOR_PRESETS[palette] || COLOR_PRESETS.terracotta;
  const emoji = cliArgs.emoji || await ask('Emoji mascota', preset.mascotEmoji);

  // 3. Features
  heading('⚙️ Funcionalidades');
  const delivery = (cliArgs.delivery || await ask('¿Habilitar delivery? (s/n)', 's')).toLowerCase().startsWith('s');
  const scheduling = (cliArgs.scheduling || await ask('¿Pedidos programados? (s/n)', 's')).toLowerCase().startsWith('s');
  const gift = (cliArgs.gift || await ask('¿Modo regalo? (s/n)', 'n')).toLowerCase().startsWith('s');
  const reviews = (cliArgs.reviews || await ask('¿Reseñas de clientes? (s/n)', 's')).toLowerCase().startsWith('s');
  const push = (cliArgs.push || await ask('¿Notificaciones push? (s/n)', 'n')).toLowerCase().startsWith('s');
  const loyalty = (cliArgs.loyalty || await ask('¿Programa de fidelidad? (s/n)', 'n')).toLowerCase().startsWith('s');
  const referral = (cliArgs.referral || await ask('¿Programa de referidos? (s/n)', 'n')).toLowerCase().startsWith('s');

  // 4. Supabase
  heading('🔧 Supabase');
  const supaUrl = cliArgs.supabase_url || await ask('Supabase URL', 'https://xxx.supabase.co');
  const supaKey = cliArgs.supabase_key || await ask('Supabase Anon Key', 'sb_publishable_...');

  rl.close();

  // ─── Generate files (SOLO archivos nuevos por tenant) ─────

  heading('📝 Generando archivos...');

  const slug = (cliArgs.slug || shortName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // A) clients/<slug>/business.js (seed desde la-nona-pato como template)
  const clientDir = join(ROOT, 'clients', slug);
  if (!existsSync(clientDir)) mkdirSync(clientDir, { recursive: true });
  const businessPath = join(clientDir, 'business.js');
  console.log(`  → clients/${slug}/business.js`);
  let businessContent = readFile(join(ROOT, 'clients/la-nona-pato/business.js'));
  const replacements = [
    [/name:\s*'[^']*'/, `name: '${name}'`],
    [/shortName:\s*'[^']*'/, `shortName: '${shortName}'`],
    [/tagline:\s*'[^']*'/, `tagline: '${tagline}'`],
    [/phone:\s*'[^']*'/, `phone: '${phone}'`],
    [/whatsapp:\s*'[^']*'/, `whatsapp: '${whatsapp}'`],
    [/address:\s*'[^']*'/, `address: '${address}'`],
    [/mascotEmoji:\s*'[^']*'/, `mascotEmoji: '${emoji}'`],
    [/themeColorLight:\s*'[^']*'/, `themeColorLight: '${colors.accent}'`],
    [/type:\s*'[^']*'/, `type: '${type}'`],
    [/biz_name:\s*'[^']*'/, `biz_name: '${name}'`],
    [/copyrightHolder:\s*'[^']*'/, `copyrightHolder: '${name}'`],
  ];
  replacements.forEach(([pattern, replacement]) => {
    businessContent = businessContent.replace(pattern, replacement);
  });
  writeFile(businessPath, businessContent);

  // B) .env.<slug> (lo lee vite.config.js segun la env var CLIENT)
  const envPath = join(ROOT, `.env.${slug}`);
  console.log(`  → .env.${slug}`);
  const envContent = [
    `VITE_SUPABASE_URL=${supaUrl}`,
    `VITE_SUPABASE_ANON_KEY=${supaKey}`,
    `# VITE_VAPID_PUBLIC_KEY=<pegar la public key VAPID si usa push>`,
    `# Generated by create-client on ${new Date().toISOString()}`,
    `# Build/dev with: CLIENT=${slug} npm run dev`,
  ].join('\n') + '\n';
  writeFile(envPath, envContent);

  // NOTA: manifest.json e index.html (title, description, theme-color) se
  // generan por tenant en build/dev via businessHtmlPlugin (vite.config.js)
  // leyendo clients/<slug>/business.js. No hay nada que mutar en el repo.
  console.log('  → manifest.json / index.html: se generan en build (vite.config.js), nada que tocar');

  // ─── SQL de personalizacion (se imprime, NO se escribe) ───

  const flags = {
    DELIVERY_ENABLED: delivery,
    SCHEDULING_ENABLED: scheduling,
    GIFT_MODE: gift,
    REVIEWS: reviews,
    PUSH_NOTIFICATIONS: push,
    LOYALTY: loyalty,
    REFERRAL: referral,
    RECIPES_WITH_INGREDIENTS: true,
    COUPONS: true,
    WHATSAPP: !!whatsapp,
    E_INVOICE: false,
    DAILY_DEALS: true,
  };
  const flagsSql = Object.entries(flags)
    .map(([key, val]) => `        UPDATE feature_flags SET enabled = ${val} WHERE key = '${key}';`)
    .join('\n');

  let categoriesSql = '';
  if (preset.categories.length > 0) {
    const catIcons = ['🥖', '🥐', '🎂', '🍪', '🍰', '🥤', '🍝', '🥩', '🍕', '🥗', '☕', '🧃'];
    const catValues = preset.categories.map((cat, i) =>
      `          ('${cat}', '${catIcons[i % catIcons.length]}', ARRAY['${cat}'], ${i + 1}, true)`
    ).join(',\n');
    categoriesSql = [
      '        INSERT INTO category_groups (name, icon, subcategories, sort_order, visible) VALUES',
      catValues,
      '        ON CONFLICT DO NOTHING;',
    ].join('\n');
  }

  // ─── Summary ──────────────────────────────────────────────

  heading('✅ Configuración completa');
  console.log(`
  Negocio:     ${name} (${type})
  Tagline:     ${tagline}
  Paleta:      ${palette} (${colors.accent})
  WhatsApp:    ${whatsapp}
  Delivery:    ${delivery ? 'Sí' : 'No'}
  Reviews:     ${reviews ? 'Sí' : 'No'}
  Push:        ${push ? 'Sí' : 'No'}
  Supabase:    ${supaUrl.substring(0, 30)}...

  Archivos generados (lo UNICO que toca este script):
    clients/${slug}/business.js
    .env.${slug}

  ${'─'.repeat(60)}
  PRÓXIMOS PASOS
  ${'─'.repeat(60)}

  1. SUPABASE — Crear proyecto nuevo (región sa-east-1 si es ARG).
     En el SQL Editor pegar y ejecutar COMPLETO:
        supabase/migrations/000_initial_schema.sql
     Es el source of truth e idempotente: tablas, RLS, policies, funciones,
     views, triggers, buckets, roles admin_users y seed limpio.

  2. REALTIME — 000_initial_schema.sql ya agrega las tablas a la publication
     (sección 10: ALTER PUBLICATION supabase_realtime ADD TABLE ...).
     Verificar con:
        SELECT tablename FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime';
     Si falta alguna:
        ALTER PUBLICATION supabase_realtime ADD TABLE public.<tabla>;

  3. ADMIN BOOTSTRAP — Crear el primer usuario en Auth (Dashboard >
     Authentication > Add user) y correr en el SQL Editor:
        INSERT INTO public.admin_users (user_id, role)
        SELECT id, 'owner' FROM auth.users WHERE email = '<email-del-dueno>';
     (bloque documentado al final de 000_initial_schema.sql).
     Después, el resto de los usuarios se gestionan desde el panel
     (Más > Usuarios).

  4. EDGE FUNCTIONS — Deployar las functions reales del repo:
        node scripts/deploy-functions.mjs --project-ref <ref>
     Equivalente con supabase CLI:
        supabase functions deploy ${EDGE_FUNCTIONS.join(' \\\n          ')} \\
          --project-ref <ref>
     IMPORTANTE: submit-order, validate-coupon, create-payment-preference,
     mp-* y send-push van con verify_jwt=false — el gateway rechaza las
     keys sb_publishable_ (no son JWT) y rompe el guest checkout.
     NO deployar afip-invoice (es un stub).

  5. SECRETS — Setear secrets de functions (Dashboard > Edge Functions >
     Secrets, o supabase secrets set --project-ref <ref>):
        VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT   (push)
        RESEND_API_KEY + EXPORT_EMAIL          (si usa scheduled-export)
        TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID  (si usa sentry-to-telegram)

  6. VERCEL — Crear proyecto nuevo (Import Git Repo, framework Vite) con
     env vars:
        CLIENT=${slug}
        VITE_SUPABASE_URL=<url del nuevo proyecto Supabase>
        VITE_SUPABASE_ANON_KEY=<publishable key del nuevo Supabase>
        VITE_VAPID_PUBLIC_KEY=<public key VAPID del tenant>

  7. AUTH — Habilitar leaked password protection
     (Dashboard > Auth > Settings, 1 click).

  8. PERSONALIZACIÓN — En el SQL Editor del tenant nuevo, ajustar los
     feature flags elegidos (la tabla ya viene seedeada por el schema;
     NO se tocan los DEFAULTS compartidos de src/services/featureFlags.js):
${flagsSql}
${categoriesSql ? `
     Categorías iniciales sugeridas para "${type}":
${categoriesSql}
` : ''}
     Nombre y URL del negocio:
        UPDATE settings SET store_name = '${name}',
          app_url = 'https://${slug}.vercel.app' WHERE id = 1;
        UPDATE theme_config SET name = '${name}' WHERE is_active = true;

  9. DEV LOCAL — CLIENT=${slug} npm run dev

  Documentación del schema: SCHEMA.md (organizado por dominio).
  `);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
