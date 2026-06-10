// src/services/invoices.js
// Client-side service for AFIP invoicing via Edge Function.
import { supabase } from '../lib/supabase';

const FUNCTION_NAME = 'afip-invoice';

async function callInvoiceFunction(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('No auth session');

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function checkAfipStatus() {
  return callInvoiceFunction({ action: 'status' });
}

export async function createInvoice({ orderId, total, items, invoiceType = 11, puntoVenta = 1, docTipo = 99, docNro = '0' }) {
  return callInvoiceFunction({
    action: 'create',
    order_id: orderId,
    total,
    items,
    invoice_type: invoiceType,
    punto_venta: puntoVenta,
    doc_tipo: docTipo,
    doc_nro: docNro,
  });
}

// Local query for invoice list
export async function listInvoices({ limit = 50, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, orders(customer, phone)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

// Invoice type labels
export const INVOICE_TYPE_LABELS = {
  1: 'Factura A',
  6: 'Factura B',
  11: 'Factura C',
  13: 'Nota de Crédito C',
};
