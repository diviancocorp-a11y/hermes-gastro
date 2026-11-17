-- Aplicada via MCP el 2026-11-17
-- Datos del tenant cochi: ubicacion de la sucursal Principal, la que paso
-- Ricky el 17/nov: "Calle Zamora, entre calle Bolivar y calle Dr. Obdulio
-- Alvarez, Edificio DONNARUMMA, Ocumare del Tuy, Edo. Miranda".
-- Coordenadas: el cruce de Calle Zamora con Av. Bolivar en Google Maps; el
-- edificio esta sobre esa cuadra. Sin ubicacion el catalogo no toma pedidos
-- (private.tiene_ubicacion, 0083): en la prueba del 17/nov el checkout decia
-- "Todavia no tomamos pedidos".

update public.branches
set lat = 10.1189835,
    lng = -66.7724319,
    address = 'Calle Zamora, entre calle Bolívar y calle Dr. Obdulio Álvarez, Edificio Donnarumma, Ocumare del Tuy, Miranda'
where tenant_id = '27881a18-b49e-4ff4-831f-de7f5acf4aa5'
  and id = '32d3fab0-6531-422b-9362-7c393666a461'
  and lat is null;
