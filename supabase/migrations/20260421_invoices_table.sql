-- Migration: Create invoices table for AFIP electronic invoicing
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  invoice_type INTEGER NOT NULL DEFAULT 11, -- 11 = Factura C
  punto_venta INTEGER NOT NULL DEFAULT 1,
  invoice_number BIGINT NOT NULL,
  cae VARCHAR(20),
  cae_expiry VARCHAR(10),
  total NUMERIC(12,2) NOT NULL,
  doc_tipo INTEGER DEFAULT 99, -- 99 = Consumidor Final
  doc_nro VARCHAR(20) DEFAULT '0',
  items JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'authorized',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(invoice_type, punto_venta, invoice_number)
);

-- RLS: only authenticated admin users can read/write invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read invoices" ON invoices FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role insert invoices" ON invoices FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Index for quick lookups by order
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
