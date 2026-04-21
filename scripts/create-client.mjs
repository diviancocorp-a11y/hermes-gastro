#!/usr/bin/env node
/**
 * create-client.mjs — Onboarding script for new clients.
 *
 * Clones the template, sets up business identity, theme, categories,
 * feature flags, and environment config for a new business.
 *
 * Usage:
 *   node scripts/create-client.mjs
 *   node scripts/create-client.mjs --name "Mi Panadería" --type bakery
 *
 * Interactive mode (no flags) walks through all fields step by step.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Helpers ────────────────────────────────────────────────

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

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
  const supaKey = cliArgs.supabase_key || await ask('Supabase Anon Key', 'eyJ...');

  rl.close();

  // ─── Generate files ───────────────────────────────────────

  heading('📝 Generando archivos...');

  // A) Update business.js
  console.log('  → src/config/business.js');
  const businessPath = join(ROOT, 'src/config/business.js');
  let businessContent = readFile(businessPath);
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

  // B) Update .env
  console.log('  → .env');
  const envPath = join(ROOT, '.env');
  const envContent = [
    `VITE_SUPABASE_URL=${supaUrl}`,
    `VITE_SUPABASE_ANON_KEY=${supaKey}`,
    `# Generated by create-client on ${new Date().toISOString()}`,
  ].join('\n') + '\n';
  writeFile(envPath, envContent);

  // C) Feature flags seed SQL
  console.log('  → Feature flags config');
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

  // Update the DEFAULTS in featureFlags.js to match
  const ffPath = join(ROOT, 'src/services/featureFlags.js');
  let ffContent = readFile(ffPath);
  Object.entries(flags).forEach(([key, val]) => {
    const re = new RegExp(`(${key}:\\s*)(true|false)`);
    ffContent = ffContent.replace(re, `$1${val}`);
  });
  writeFile(ffPath, ffContent);

  // D) Category groups seed
  if (preset.categories.length > 0) {
    console.log('  → Categorías iniciales');
    const catIcons = ['🥖', '🥐', '🎂', '🍪', '🍰', '🥤', '🍝', '🥩', '🍕', '🥗', '☕', '🧃'];
    const catSql = preset.categories.map((cat, i) =>
      `  ('${cat}', '${catIcons[i % catIcons.length]}', ARRAY['${cat}'], ${i + 1}, true)`
    ).join(',\n');

    const migrationPath = join(ROOT, 'supabase/migrations/20260421_category_groups.sql');
    if (existsSync(migrationPath)) {
      let sql = readFile(migrationPath);
      // Replace the INSERT block
      const insertRegex = /INSERT INTO category_groups[\s\S]*?ON CONFLICT[\s\S]*?;/;
      const newInsert = `INSERT INTO category_groups (name, icon, subcategories, sort_order, visible) VALUES\n${catSql}\nON CONFLICT DO NOTHING;`;
      sql = sql.replace(insertRegex, newInsert);
      writeFile(migrationPath, sql);
    }
  }

  // E) Theme config
  console.log('  → Tema de colores');
  const themeMigration = join(ROOT, 'supabase/migrations/20260421_theme_config.sql');
  if (existsSync(themeMigration)) {
    let sql = readFile(themeMigration);
    sql = sql.replace(/INSERT INTO theme_config \(name, is_active\) VALUES \('[^']*'/, `INSERT INTO theme_config (name, is_active) VALUES ('${name}'`);
    writeFile(themeMigration, sql);
  }

  // F) Update service worker business name
  console.log('  → Service Worker');
  const swPath = join(ROOT, 'public/sw.js');
  if (existsSync(swPath)) {
    let sw = readFile(swPath);
    sw = sw.replace(/La Nona Pato/g, name);
    writeFile(swPath, sw);
  }

  // G) Update HTML title and manifest
  console.log('  → index.html & manifest');
  const indexPath = join(ROOT, 'index.html');
  if (existsSync(indexPath)) {
    let html = readFile(indexPath);
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${name}</title>`);
    writeFile(indexPath, html);
  }

  const manifestPath = join(ROOT, 'public/manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    manifest.name = name;
    manifest.short_name = shortName;
    writeJson(manifestPath, manifest);
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

  Próximos pasos:
  1. cd ${ROOT}
  2. npm install
  3. Ejecutar migraciones: npx supabase db push
  4. npm run dev
  5. Acceder al panel admin para ajustar productos y recetas
  `);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
