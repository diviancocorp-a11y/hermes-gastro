-- Aplicada via MCP el 2026-11-17
-- Datos del tenant cochi (fase 5), los paso Ricky el 17/nov:
-- 1. WhatsApp del local: +58 424-2246392, guardado en digitos (wa.me no acepta
--    el "+" ni guiones).
-- 2. Cuenta de pago movil en Bs. (moneda VES): Bancamiga 0172, telefono y
--    cedula como detalles; alias y CBU van vacios (son de Argentina).
-- 3. Flags del checkout: envio a confirmar y pedido por WhatsApp.
--    Solo pisa la cuenta si todavia no hay ninguna cargada.

update public.settings
set whatsapp = '584242246392',
    payment_accounts = case
      when payment_accounts is null or payment_accounts = '[]'::jsonb then jsonb_build_array(jsonb_build_object(
        'id', 'cochi-pago-movil', 'label', 'Pago móvil', 'banco', 'Bancamiga (0172)',
        'titular', '', 'alias', '', 'cbu', '', 'active', true, 'sort', 0,
        'scope', 'checkout', 'moneda', 'VES',
        'detalles', jsonb_build_array(
          jsonb_build_object('label', 'Teléfono', 'value', '04242246392'),
          jsonb_build_object('label', 'Cédula', 'value', '10071476'))))
      else payment_accounts end,
    delivery_a_confirmar = true,
    pedido_por_whatsapp = true
where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5';
