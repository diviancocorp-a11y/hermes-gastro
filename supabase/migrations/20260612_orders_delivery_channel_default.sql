-- 20260612_orders_delivery_channel_default.sql
-- Aplicada via MCP en los 3 tenants el 12/jun/2026.
--
-- Los pedidos del CATALOGO no llevaban delivery_channel (submit-order no
-- lo setea) y el P&L USAR los agrupaba con el fallback "mostrador" —
-- mezclando ventas online con mostrador. Los pedidos manuales del admin
-- siempre mandan canal explicito, asi que los NULL son del catalogo.
alter table public.orders alter column delivery_channel set default 'web_own';
update public.orders set delivery_channel = 'web_own' where delivery_channel is null;
