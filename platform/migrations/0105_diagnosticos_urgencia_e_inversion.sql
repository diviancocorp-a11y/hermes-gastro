-- 0105_diagnosticos_urgencia_e_inversion.sql
-- (Nacio como 0102 y se renumero: main ya tenia 0102_recetas_e_insumos_por_rol
-- y las sesiones de producto usan 0103 y 0104. En la base quedo registrada
-- como diagnosticos_urgencia_e_inversion, sin numero.)
-- Aplicada via MCP el 19/oct/2026 (ok de Ricky en el chat: "Si, las dos").
--
-- El diagnostico cualifica sin pedir email: para cuando lo quiere andando y
-- cuanto piensa invertir por mes. Columnas nuevas y opcionales: el codigo
-- desplegado que no las manda sigue funcionando (expandir, sin contraer).
-- Los rangos de inversion siguen los planes de Dico (Digital gratis, Local
-- $59.000, Cadena $99.000 por local).

alter table public.diagnosticos
  add column if not exists urgencia text
    check (urgencia in ('ya', 'este_mes', 'proximos_meses', 'explorando'));

alter table public.diagnosticos
  add column if not exists inversion text
    check (inversion in ('gratis', 'hasta_60k', 'hasta_100k', 'mas_de_100k', 'no_se'));
