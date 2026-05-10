// src/components/admin/Exports.jsx
// Export center: download sales, expenses, inventory, orders as CSV/XLSX/PDF.
import { useState } from 'react';
import { todayISO, Icon } from '../../lib/utils';
import business from '@business';
import {
  downloadCSV, downloadXLSX, printAsPDF,
  prepareSalesExport, prepareExpensesExport,
  prepareInventoryExport, prepareOrdersExport,
} from '../../lib/exports';

const EXPORT_TYPES = [
  { key: 'sales', label: 'Ventas', icon: '💰', desc: 'Todas las ventas registradas' },
  { key: 'expenses', label: 'Gastos', icon: '📋', desc: 'Gastos y compras' },
  { key: 'inventory', label: 'Inventario', icon: '📦', desc: 'Stock actual de ingredientes' },
  { key: 'orders', label: 'Pedidos', icon: '🛒', desc: 'Historial de pedidos' },
];

const FORMAT_OPTIONS = [
  { key: 'xlsx', label: 'Excel (.xlsx)', icon: '📊' },
  { key: 'csv', label: 'CSV', icon: '📄' },
  { key: 'pdf', label: 'PDF (imprimir)', icon: '🖨' },
];

export default function Exports({ sales, expenses, ingredients, orders, recipes, sett, msg, onClose }) {
  const [selected, setSelected] = useState('sales');
  const [format, setFormat] = useState('xlsx');
  const [loading, setLoading] = useState(false);

  const doExport = () => {
    setLoading(true);
    try {
      let headers, rows;
      const date = todayISO();
      const bizName = sett?.biz_name || business.name;

      switch (selected) {
        case 'sales': ({ headers, rows } = prepareSalesExport(sales, recipes)); break;
        case 'expenses': ({ headers, rows } = prepareExpensesExport(expenses)); break;
        case 'inventory': ({ headers, rows } = prepareInventoryExport(ingredients)); break;
        case 'orders': ({ headers, rows } = prepareOrdersExport(orders, recipes)); break;
        default: return;
      }

      const label = EXPORT_TYPES.find(t => t.key === selected)?.label || selected;
      const filename = `${label.toLowerCase()}_${date}`;

      switch (format) {
        case 'csv':
          downloadCSV(`${filename}.csv`, headers, rows);
          break;
        case 'xlsx':
          downloadXLSX(`${filename}.xlsx`, headers, rows, label);
          break;
        case 'pdf':
          printAsPDF(`Reporte de ${label}`, headers, rows, { bizName, subtitle: `Exportado el ${date}` });
          break;
      }

      msg?.(`${label} exportado ✓`);
    } catch (err) {
      console.error('Export error:', err);
      msg?.('Error al exportar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ov">
      <div className="op">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="st" style={{ marginBottom: 0 }}>📥 Exportar datos</div>
          <button className="hb" onClick={onClose}>{Icon.x({ size: 20 })}</button>
        </div>

        {/* Data type selection */}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginBottom: 8 }}>¿Qué datos exportar?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {EXPORT_TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => setSelected(t.key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '14px 8px', borderRadius: 12, border: '2px solid',
                borderColor: selected === t.key ? 'var(--ac)' : 'var(--b2)',
                background: selected === t.key ? 'var(--al,#FFF0EB)' : 'var(--b2)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 24 }}>{t.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: selected === t.key ? 'var(--ac)' : 'var(--tx)' }}>{t.label}</span>
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>{t.desc}</span>
            </button>
          ))}
        </div>

        {/* Format selection */}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginBottom: 8 }}>Formato</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {FORMAT_OPTIONS.map(f => (
            <button
              key={f.key}
              onClick={() => setFormat(f.key)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, border: '2px solid',
                borderColor: format === f.key ? 'var(--ac)' : 'var(--b2)',
                background: format === f.key ? 'var(--al,#FFF0EB)' : 'transparent',
                cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 18 }}>{f.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: format === f.key ? 'var(--ac)' : 'var(--t2)', marginTop: 2 }}>{f.label}</div>
            </button>
          ))}
        </div>

        {/* Summary */}
        <div style={{
          padding: '12px 14px', background: 'var(--b2)', borderRadius: 10, marginBottom: 16,
          fontSize: 12, color: 'var(--t2)',
        }}>
          {selected === 'sales' && <span>{sales?.length || 0} ventas registradas</span>}
          {selected === 'expenses' && <span>{expenses?.length || 0} gastos registrados</span>}
          {selected === 'inventory' && <span>{ingredients?.length || 0} ingredientes en stock</span>}
          {selected === 'orders' && <span>{orders?.length || 0} pedidos registrados</span>}
        </div>

        {/* Export button */}
        <button
          className="btn bp"
          onClick={doExport}
          disabled={loading}
          style={{ width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 700, borderRadius: 12 }}
        >
          {loading ? 'Exportando...' : `Exportar ${EXPORT_TYPES.find(t => t.key === selected)?.label || ''}`}
        </button>
      </div>
    </div>
  );
}
