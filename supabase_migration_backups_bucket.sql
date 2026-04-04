-- ═══════════════════════════════════════════════════════
-- MIGRACIÓN: Crear bucket privado "backups" para respaldo
-- de clientes automático.
-- Ejecutar en Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════

-- 1. Crear bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas para usuarios autenticados (admin)
DROP POLICY IF EXISTS "Auth users can upload backups" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update backups" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can read backups" ON storage.objects;

CREATE POLICY "Auth users can upload backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'backups');

CREATE POLICY "Auth users can update backups"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'backups');

CREATE POLICY "Auth users can read backups"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'backups');

-- 3. Políticas para rol anon (sync automático después de cada pedido)
DROP POLICY IF EXISTS "Anon can upload backups" ON storage.objects;
DROP POLICY IF EXISTS "Anon can update backups" ON storage.objects;

CREATE POLICY "Anon can upload backups"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'backups');

CREATE POLICY "Anon can update backups"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'backups');
