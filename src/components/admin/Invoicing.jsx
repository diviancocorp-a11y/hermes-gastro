// src/components/admin/Invoicing.jsx
// AFIP invoicing panel: create invoices from completed orders, view history.
import { useState, useEffect, useMemo } from 'react';
import { formatMoney, formatOrderCode, Icon, todayISO } from '../../lib/utils';
import { createInvoice, listInvoices, checkAfipStatus, INVOICE_TYPE_LABELS } from '../../services/invoices';
import business from '@business';
import { printAsPDF } from '../../lib/exports';

export default function Invoicing({ orders, recipes, sett, msg, onClose }) {
  const [tab, setTab] = useState('create'); // 'create' | 'history'
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [afipOk, setAfipOk] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Check AFIP status on mount
  useEffect(() => {
    checkAfipStatus()
      .then(s => setAfipOk(s?.cuit_configured && s?.cert_configured && s?.key_configured))
      .catch(() => setAfipOk(false));
    listInvoices()
      .then(setInvoices)
      .catch(() => {});
  }, []);

  // Completed orders without invoice
  const billableOrders = useMemo(() => {
    const invoicedIds = new Set(invoices.map(i => i.order_id));
    return orders
      .filter(o => o.status === 'completed' && !invoicedIds.has(o.id))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [orders, invoices]);

  const handleCreate = async (order) => {
    setLoading(true);
    try {
      const items = (order.items || []).map(it => {
        const rec = recipes?.find(r => r.id === it.id);
        return { description: rec?.name || it.id, quantity: it.qty || 1, unit_price: it.price || 0 };
      });

      const result = await createInvoice({
        orderId: order.id,
        total: order.total || 0,
        items,
      });

      msg?.(`Factura ${result.invoice_number} autorizada ✓ CAE: ${result.cae}`);
      // Refresh invoices
      const updated = await listInvoices();
      setInvoices(updated);
    } catch (err) {
      msg?.(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (inv) => {
    const headers = ['Descripción', 'Cantidad', 'Precio Unit.', 'Subtotal'];
    const items = inv.items || [];
    const rows = items.map(it => [
      it.description,
      it.quantity,
      `$${formatMoney(it.unit_price)}`,
      `$${formatMoney(it.quantity * it.unit_price)}`,
    ]);

    const bizName = sett?.biz_name || business.name;
    const cuit = sett?.cuit || '';
    const tipo = INVOICE_TYPE_LABELS[inv.invoice_type] || `Tipo ${inv.invoice_type}`;
    const subtitle = `${tipo} ${String(inv.punto_venta).padStart(4, '0')}-${String(inv.invoice_number).padStart(8, '0')} | CAE: ${inv.cae || 'N/A'} | Vto: ${inv.cae_expiry || 'N/A'}${cuit ? ` | CUIT: ${cuit}` : ''}`;

    printAsPDF(`Comprobante de venta`, headers, rows, { bizName, subtitle });
  };

  return (
    <div className="ov">
      <div className="op">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="st" style={{ marginBottom: 0 }}>🧾 Facturación AFIP</div>
          <button className="hb" onClick={onClose}>{Icon.x({ size: 20 })}</button>
        </div>

        {/* AFIP status badge */}
        <div style={{
          padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600,
          background: afipOk === null ? 'var(--yl,#FFF8E1)' : afipOk ? 'var(--gl,#E8F5E9)' : 'var(--rl,#FFEBEE)',
          color: afipOk === null ? 'var(--yw)' : afipOk ? 'var(--gn)' : 'var(--rd)',
        }}>
          {afipOk === null ? '⏳ Verificando conexión AFIP...' : afipOk ? '✅ AFIP conectado' : '⚠️ AFIP no configurado — configurá certificado y CUIT en las variables de entorno'}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {[{ k: 'create', l: 'Facturar' }, { k: 'history', l: `Historial (${invoices.length})` }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
              background: tab === t.k ? 'var(--ac)' : 'var(--b2)', color: tab === t.k ? '#fff' : 'var(--t2)', cursor: 'pointer',
            }}>{t.l}</button>
          ))}
        </div>

        {/* Create tab */}
        {tab === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {billableOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)', fontSize: 13 }}>
                No hay pedidos completados pendientes de facturar
              </div>
            ) : (
              billableOrders.map(o => (
                <div key={o.id} className="c" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{formatOrderCode(o.id)}</div>
                    <div style={{ fontSize: 12, color: 'var(--t2)' }}>{o.customer || 'Sin nombre'} · ${formatMoney(o.total || 0)}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{(o.created_at || '').slice(0, 10)}</div>
                  </div>
                  <button
                    className="btn bp bsm"
                    onClick={() => handleCreate(o)}
                    disabled={loading || !afipOk}
                    style={{ fontSize: 12, padding: '6px 14px' }}
                  >
                    {loading ? '...' : '🧾 Facturar'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)', fontSize: 13 }}>
                Sin facturas emitidas
              </div>
            ) : (
              invoices.map(inv => (
                <div key={inv.id} className="c" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {INVOICE_TYPE_LABELS[inv.invoice_type] || 'Factura'} {String(inv.punto_venta).padStart(4, '0')}-{String(inv.invoice_number).padStart(8, '0')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                        ${formatMoney(inv.total)} · {(inv.created_at || '').slice(0, 10)}
                      </div>
                      {inv.cae && <div style={{ fontSize: 11, color: 'var(--t3)' }}>CAE: {inv.cae} · Vto: {inv.cae_expiry}</div>}
                    </div>
                    <button className="hb" onClick={() => handlePrint(inv)} title="Imprimir">
                      🖨
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
