// src/services/crm.js
import { supabase } from '../lib/supabase';
import business from '../config/business';

export async function fetchCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('last_order_at', { ascending: false });
  if (error) { console.error('fetchCustomers:', error.message); return []; }
  return data || [];
}

export async function fetchCustomerStats() {
  // Build CRM from orders data (more reliable than customers table)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('customer, phone, email, total, status, created_at')
    .neq('status', 'cancelled');
  if (error || !orders) return [];
  const map = {};
  orders.forEach(o => {
    const key = o.phone || o.email || o.customer;
    if (!key) return;
    if (!map[key]) map[key] = { name: o.customer, phone: o.phone || '', email: o.email || '', orders: 0, total: 0, last_order: '' };
    map[key].orders++;
    map[key].total += (o.total || 0);
    if (!map[key].name && o.customer) map[key].name = o.customer;
    if (!map[key].phone && o.phone) map[key].phone = o.phone;
    if (!map[key].email && o.email) map[key].email = o.email;
    if (o.created_at > map[key].last_order) map[key].last_order = o.created_at;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

// ─── DOWNLOAD SERVER BACKUP ──────────────────────────
// Descarga el CSV de clientes almacenado en Supabase Storage (bucket privado)
export async function downloadServerBackup() {
  const { data, error } = await supabase.storage
    .from('backups')
    .download('clientes/clientes_export.csv');
  if (error) { console.error('downloadServerBackup:', error.message); return { ok: false, msg: error.message }; }
  // Trigger download en el navegador
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url; a.download = `Clientes_${business.name.replace(/\s+/g, '_')}_${dateStr}.csv`; a.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}

// ─── BACKUP CUSTOMERS (respaldo antes de reset) ──────
// Genera y descarga un CSV con todos los clientes (datos de orders + customers)
export async function backupCustomers() {
  // 1. Traer clientes CRM consolidados desde orders
  const { data: orders } = await supabase
    .from('orders')
    .select('customer, phone, email, total, status, created_at, delivery, payment, address')
    .order('created_at', { ascending: false });

  if (!orders || orders.length === 0) return { ok: true, count: 0 };

  // Consolidar por cliente (mismo lógica que fetchCustomerStats pero con más datos)
  const map = {};
  orders.forEach(o => {
    const key = o.phone || o.email || o.customer;
    if (!key) return;
    if (!map[key]) map[key] = {
      nombre: o.customer || '', telefono: o.phone || '', email: o.email || '',
      pedidos: 0, total_gastado: 0, ultimo_pedido: '', direccion: o.address || '',
      metodo_pago: '', metodo_entrega: ''
    };
    map[key].pedidos++;
    map[key].total_gastado += (o.total || 0);
    if (!map[key].nombre && o.customer) map[key].nombre = o.customer;
    if (!map[key].telefono && o.phone) map[key].telefono = o.phone;
    if (!map[key].email && o.email) map[key].email = o.email;
    if (!map[key].direccion && o.address) map[key].direccion = o.address;
    if (o.created_at > map[key].ultimo_pedido) {
      map[key].ultimo_pedido = o.created_at;
      map[key].metodo_pago = o.payment || '';
      map[key].metodo_entrega = o.delivery || '';
    }
  });

  const customers = Object.values(map).sort((a, b) => b.total_gastado - a.total_gastado);

  // 2. Generar CSV
  const headers = ['Nombre', 'Teléfono', 'Email', 'Pedidos', 'Total Gastado', 'Último Pedido', 'Dirección', 'Método Pago', 'Método Entrega'];
  const escape = (v) => {
    const s = String(v || '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = customers.map(c => [
    escape(c.nombre), escape(c.telefono), escape(c.email),
    c.pedidos, c.total_gastado, escape(c.ultimo_pedido?.split('T')[0] || ''),
    escape(c.direccion), escape(c.metodo_pago), escape(c.metodo_entrega)
  ].join(','));
  const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n'); // BOM para Excel

  // 3. Descargar archivo
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const fileName = `Clientes_${business.name.replace(/\s+/g, '_')}_${dateStr}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);

  return { ok: true, count: customers.length, fileName };
}

// ─── RESET HISTORICAL DATA ───────────────────────────
// Borra pedidos, ventas, gastos, compras y mermas.
// NO toca recetas, ingredientes ni settings.
// SIEMPRE genera respaldo de clientes antes de borrar.
export async function resetHistoricalData() {
  // 1. Respaldo obligatorio de clientes
  const backup = await backupCustomers();

  // 2. Borrar tablas históricas
  const tables = [
    { name: 'order_items', label: 'items de pedidos' },
    { name: 'orders', label: 'pedidos' },
    { name: 'sales', label: 'ventas' },
    { name: 'expenses', label: 'gastos' },
    { name: 'purchase_items', label: 'items de compras' },
    { name: 'purchases', label: 'compras' },
    { name: 'waste_log', label: 'mermas' },
    { name: 'coupons', label: 'cupones' },
    { name: 'customers', label: 'clientes CRM' },
  ];
  const errors = [];
  for (const t of tables) {
    const { error } = await supabase.from(t.name).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) errors.push(`${t.label}: ${error.message}`);
  }
  return errors.length
    ? { ok: false, errors, backup }
    : { ok: true, backup };
}
