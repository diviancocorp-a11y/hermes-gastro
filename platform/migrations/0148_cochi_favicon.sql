-- Aplicada via MCP el 2026-11-19
-- Datos del tenant cochi: favicon propio (el isotipo del chancho en llamas),
-- pedido de Ricky del 19/nov. Sin favicon_url la pestana mostraba la "C"
-- generada (letterFavicon de src/lib/tenantHead.js). Se usa el isotipo ya
-- subido en la 0133; el icono de "Agregar a inicio" cae al mismo.

update public.settings
set favicon_url = 'https://wwwzdgprsooyjgkuyoav.supabase.co/storage/v1/object/public/tenant-images/27881a18-b49e-4ff4-831f-de7f5acf4aa5/cochi-brand-cochi-isotipo-red-c47c3c71.png'
where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5'
  and favicon_url is null;
