// src/components/catalog/FoodIllustration.jsx
// Ilustraciones flat geométricas para productos sin imagen, empty states y
// covers. Monocromáticas usando currentColor — toman el color del contenedor.
//
// Uso:
//   <FoodIllustration name="bowl" size={120} />
//   <FoodIllustration name={pickByCategory(category)} />

const ICONS = {
  bowl: (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 48h72c0 18-16 32-36 32S14 66 14 48Z" />
      <path d="M14 48l-2-3M86 48l2-3" />
      <path d="M38 22c0 4-3 6-3 10s3 6 3 10" />
      <path d="M50 18c0 4-3 6-3 10s3 6 3 10" />
      <path d="M62 22c0 4-3 6-3 10s3 6 3 10" />
    </svg>
  ),
  whisk: (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="46" y="10" width="8" height="22" rx="3" />
      <path d="M50 32c-10 0-22 8-22 24 0 18 12 28 22 28s22-10 22-28c0-16-12-24-22-24Z" />
      <path d="M50 36v48M40 38c-6 4-10 14-10 22 0 12 6 22 10 24M60 38c6 4 10 14 10 22 0 12-6 22-10 24M34 50h32M32 64h36" />
    </svg>
  ),
  pot: (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 36h68v36c0 6-4 10-10 10H26c-6 0-10-4-10-10V36Z" />
      <path d="M12 36h76" />
      <path d="M30 26c0-3 3-5 0-9M50 26c0-3 3-5 0-9M70 26c0-3 3-5 0-9" />
      <path d="M14 50h72" opacity="0.4" />
    </svg>
  ),
  baguette: (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 60c4-20 26-32 50-30s28 18 22 32c-4 10-22 16-44 14S10 70 14 60Z" />
      <path d="M28 52l4 8M40 48l4 8M52 46l4 8M64 46l4 8M76 50l4 6" />
    </svg>
  ),
  glass: (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 14h40l-4 70c0 4-4 6-8 6H42c-4 0-8-2-8-6L30 14Z" />
      <path d="M30 14h40M34 38h32M48 14l2 70" opacity="0.4" />
    </svg>
  ),
  cake: (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="18" y="44" width="64" height="38" rx="4" />
      <path d="M22 56c4 4 8 4 12 0s8-4 12 0 8 4 12 0 8-4 12 0 8 4 12 0" />
      <path d="M40 26v18M50 22v22M60 26v18" />
      <path d="M40 26c0-3 0-5-2-7M50 22c0-3 0-5-2-7M60 26c0-3 0-5-2-7" />
    </svg>
  ),
  fork: (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M40 10v22c0 6 4 10 10 10s10-4 10-10V10" />
      <path d="M44 10v18M50 10v18M56 10v18" />
      <path d="M50 42v48" />
    </svg>
  ),
  pizza: (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M50 12c-22 0-40 18-40 40h80c0-22-18-40-40-40Z" />
      <path d="M10 52c0 22 18 36 40 36s40-14 40-36" opacity="0.3" />
      <circle cx="36" cy="40" r="3" fill="currentColor" />
      <circle cx="60" cy="34" r="3" fill="currentColor" />
      <circle cx="68" cy="50" r="3" fill="currentColor" />
      <circle cx="44" cy="54" r="3" fill="currentColor" />
    </svg>
  ),
};

const CATEGORY_MAP = {
  bebidas: 'glass',
  bebida: 'glass',
  postres: 'cake',
  postre: 'cake',
  dulces: 'cake',
  panes: 'baguette',
  pan: 'baguette',
  panaderia: 'baguette',
  pizzas: 'pizza',
  pizza: 'pizza',
  pastas: 'pot',
  guisos: 'pot',
  sopas: 'bowl',
  ensaladas: 'bowl',
  default: 'fork',
};

export function pickIllustrationByCategory(category = '') {
  const key = category.toLowerCase().trim();
  for (const [k, v] of Object.entries(CATEGORY_MAP)) {
    if (key.includes(k)) return v;
  }
  return CATEGORY_MAP.default;
}

export default function FoodIllustration({ name = 'fork', size = 80, color, style = {} }) {
  const icon = ICONS[name] || ICONS.fork;
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        color: color || 'currentColor',
        display: 'inline-flex',
        ...style,
      }}
    >
      {icon}
    </div>
  );
}
