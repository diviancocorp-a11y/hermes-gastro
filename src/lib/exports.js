// @no-jsx-check (genera XML para XLSX, no JSX)
// src/lib/exports.js
// Export utilities: CSV, XLSX (XML-based), and PDF (via print).
// No external dependencies — uses browser APIs only.

import { formatMoney, todayISO } from './utils';

// ─── CSV ────────────────────────────────────────────────────────────
export function generateCSV(headers, rows) {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.map(escape).join(',')];
  rows.forEach(row => lines.push(row.map(escape).join(',')));
  return lines.join('\n');
}

export function downloadCSV(filename, headers, rows) {
  const csv = generateCSV(headers, rows);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

// ─── XLSX (XML SpreadsheetML) ────────────────────────────────────────
// Generates a valid .xlsx file using Open XML format (single sheet).
// This approach uses ZIP + XML, all in the browser.

function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colLetter(idx) {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function buildSheetXML(headers, rows, sheetName = 'Datos') {
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  xml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  xml += ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n';
  xml += '<sheetData>\n';

  // Header row
  xml += '<row r="1">';
  headers.forEach((h, ci) => {
    const ref = colLetter(ci) + '1';
    xml += `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(h)}</t></is></c>`;
  });
  xml += '</row>\n';

  // Data rows
  rows.forEach((row, ri) => {
    const rowNum = ri + 2;
    xml += `<row r="${rowNum}">`;
    row.forEach((cell, ci) => {
      const ref = colLetter(ci) + rowNum;
      if (typeof cell === 'number' && isFinite(cell)) {
        xml += `<c r="${ref}"><v>${cell}</v></c>`;
      } else {
        xml += `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
      }
    });
    xml += '</row>\n';
  });

  xml += '</sheetData>\n</worksheet>';
  return xml;
}

// Minimal ZIP builder for XLSX (no external lib)
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function textToBytes(str) {
  return new TextEncoder().encode(str);
}

function buildZip(files) {
  // files: [{ name: string, data: Uint8Array }]
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  files.forEach(f => {
    const nameBytes = textToBytes(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    // Local file header (30 + name + data)
    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true);         // version needed
    lv.setUint16(6, 0, true);          // flags
    lv.setUint16(8, 0, true);          // compression (store)
    lv.setUint16(10, 0, true);         // mod time
    lv.setUint16(12, 0, true);         // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);      // compressed
    lv.setUint32(22, size, true);      // uncompressed
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);        // extra length
    local.set(nameBytes, 30);
    local.set(f.data, 30 + nameBytes.length);
    localHeaders.push(local);

    // Central directory header (46 + name)
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0x20, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralHeaders.push(central);

    offset += local.length;
  });

  const centralOffset = offset;
  const centralSize = centralHeaders.reduce((s, c) => s + c.length, 0);

  // End of central directory
  const eocdr = new Uint8Array(22);
  const ev = new DataView(eocdr.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);

  const total = offset + centralSize + 22;
  const result = new Uint8Array(total);
  let pos = 0;
  localHeaders.forEach(h => { result.set(h, pos); pos += h.length; });
  centralHeaders.forEach(h => { result.set(h, pos); pos += h.length; });
  result.set(eocdr, pos);
  return result;
}

export function downloadXLSX(filename, headers, rows, sheetName = 'Datos') {
  const sheetXml = buildSheetXML(headers, rows, sheetName);

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const zip = buildZip([
    { name: '[Content_Types].xml', data: textToBytes(contentTypes) },
    { name: '_rels/.rels', data: textToBytes(rels) },
    { name: 'xl/workbook.xml', data: textToBytes(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: textToBytes(workbookRels) },
    { name: 'xl/worksheets/sheet1.xml', data: textToBytes(sheetXml) },
  ]);

  const blob = new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, filename);
}

// ─── PDF (print-based) ──────────────────────────────────────────────
// Opens a styled print window for the user to save as PDF.
export function printAsPDF(title, headers, rows, { bizName = '', subtitle = '' } = {}) {
  const win = window.open('', '_blank', 'width=800,height=600');
  if (!win) { alert('Permití las ventanas emergentes para descargar el PDF.'); return; }

  const today = todayISO();
  const tableRows = rows.map(r =>
    '<tr>' + r.map(c => `<td style="border:1px solid #ddd;padding:6px 10px;font-size:12px">${xmlEscape(String(c ?? ''))}</td>`).join('') + '</tr>'
  ).join('\n');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${xmlEscape(title)}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:40px;color:#333}
  h1{font-size:20px;margin:0 0 4px}
  .sub{font-size:13px;color:#888;margin-bottom:20px}
  table{border-collapse:collapse;width:100%}
  th{background:#f5f0eb;border:1px solid #ddd;padding:8px 10px;font-size:12px;text-align:left;font-weight:700}
  @media print{body{margin:20px}button{display:none}}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
  <div><h1>${xmlEscape(title)}</h1>
  ${bizName ? `<div style="font-size:14px;font-weight:600;color:#C45D3E">${xmlEscape(bizName)}</div>` : ''}
  ${subtitle ? `<div class="sub">${xmlEscape(subtitle)}</div>` : ''}
  <div class="sub">Generado: ${today}</div></div>
  <button onclick="window.print();setTimeout(()=>window.close(),500)" style="padding:8px 16px;border:none;background:#C45D3E;color:#fff;border-radius:8px;cursor:pointer;font-weight:600">🖨 Imprimir / PDF</button>
</div>
<table>
<thead><tr>${headers.map(h => `<th>${xmlEscape(h)}</th>`).join('')}</tr></thead>
<tbody>${tableRows}</tbody>
</table>
</body></html>`;

  win.document.write(html);
  win.document.close();
}

// ─── Data preparation helpers ────────────────────────────────────────

export function prepareSalesExport(sales, recipes) {
  const headers = ['Fecha', 'Producto', 'Cantidad', 'Total', 'Método de pago'];
  const rows = sales.map(s => {
    const rec = recipes?.find(r => r.id === s.recipe_id);
    return [
      s.date || '',
      rec?.name || s.recipe_id || 'N/A',
      s.qty || 1,
      s.total || 0,
      s.payment_method || '',
    ];
  });
  return { headers, rows };
}

export function prepareExpensesExport(expenses) {
  const headers = ['Fecha', 'Descripción', 'Categoría', 'Monto', 'Proveedor'];
  const rows = expenses.map(e => [
    e.date || '',
    e.description || '',
    e.category || '',
    e.amount || 0,
    e.supplier || '',
  ]);
  return { headers, rows };
}

export function prepareInventoryExport(ingredients) {
  const headers = ['Ingrediente', 'Cantidad', 'Unidad', 'Stock mínimo', 'Costo unitario'];
  const rows = ingredients.map(i => [
    i.name || '',
    i.qty ?? 0,
    i.unit || '',
    i.min ?? 0,
    i.cost ?? 0,
  ]);
  return { headers, rows };
}

export function prepareOrdersExport(orders, recipes) {
  const headers = ['Fecha', 'Cliente', 'Teléfono', 'Estado', 'Entrega', 'Total', 'Productos'];
  const rows = orders.map(o => {
    const items = (o.items || []).map(it => {
      const rec = recipes?.find(r => r.id === it.id);
      return `${rec?.name || it.id} x${it.qty || 1}`;
    }).join(', ');
    return [
      o.created_at || o.date || '',
      o.customer || '',
      o.phone || '',
      o.status || '',
      o.delivery || '',
      o.total || 0,
      items,
    ];
  });
  return { headers, rows };
}

// ─── Download trigger ────────────────────────────────────────────────
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
