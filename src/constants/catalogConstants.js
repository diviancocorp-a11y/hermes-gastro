// ── Shared constants for the catalog ──

export const avatarColors = ["#C45D3E", "#3A7D44", "#8D6E00", "#5C6BC0", "#AB47BC", "#00897B", "#D84315", "#6D4C41", "#546E7A", "#7B1FA2"];

export const CAT_GROUPS = [
  { name: "Primeros Mimos",         icon: "🫕", subs: ["Brusquetas", "Escabeches", "Aperitivos"] },
  { name: "La Mesa Principal",      icon: "🍕", subs: ["Rotisería", "Pizzas"] },
  { name: "El Sanguche de la Nona", icon: "🥪", subs: ["Sandwiches"] },
  { name: "La Nona Amasó",          icon: "🥖", subs: ["Panadería", "Panificados"] },
  { name: "La Última Mordida",      icon: "🍰", subs: ["Tortas", "torta", "Budines", "Alfajores"] },
  { name: "Cocina Consciente",      icon: "🥗", subs: ["Saludable"] },
];

export const SUB_TO_PARENT = {};
CAT_GROUPS.forEach(g => g.subs.forEach(s => { SUB_TO_PARENT[s] = g.name; }));

export const DAILY_DEALS = {
  1: ["La Nona Amasó", "La Mesa Principal"],
  2: ["La Última Mordida"],
  3: ["El Sanguche de la Nona", "Primeros Mimos"],
  4: ["Cocina Consciente", "Primeros Mimos"],
};
export const DEAL_PCT = 15;

export const fallbackSettings = {
  biz_name: "La Nona Pato",
  logo_letter: "N",
  logo_color: "#C45D3E",
  cover_url: "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=800&q=80"
};

export const fallbackProducts = [
  { id: "r1", name: "Alfajores de Maicena", category: "Alfajores", sale_price: 6500, image_url: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=300&q=80", description: "Caja x12. Clásicos alfajores artesanales que se deshacen en la boca, con mucho dulce de leche." },
  { id: "r2", name: "Torta de Chocolate", category: "Tortas", sale_price: 18000, image_url: "https://images.unsplash.com/photo-1578985545062-69928b1d9ba9?auto=format&fit=crop&w=300&q=80", description: "Torta súper húmeda de chocolate rellena y cubierta con ganache de chocolate semiamargo." },
  { id: "r3", name: "Cheesecake Frutos Rojos", category: "Tortas", sale_price: 15000, image_url: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=300&q=80", description: "Cheesecake horneado súper cremoso con base crocante y abundante salsa de frutos rojos." },
  { id: "r4", name: "Budín de Limón", category: "Budines", sale_price: 5500, image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=300&q=80", description: "Budín esponjoso con glaseado cítrico." }
];

export const STORE_LAT = -34.4295;
export const STORE_LNG = -58.7267;

export const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

export const calcDeliveryCost = (km) => {
  if (km <= 2) return 500;
  if (km <= 5) return 1000;
  if (km <= 10) return 1800;
  if (km <= 15) return 2500;
  if (km <= 25) return 3500;
  return 5000;
};

export const CHECKOUT_STEPS = ["Datos", "Entrega", "Pago", "Resumen"];

export const DEFAULT_FORM = { name: "", phone: "", email: "", delivery: "retiro", payment: "efectivo", address: "", address_piso: "", address_notas: "", note: "", is_gift: false, gift_note: "", delivery_date: "", delivery_time: "", change_amount: "justo" };
