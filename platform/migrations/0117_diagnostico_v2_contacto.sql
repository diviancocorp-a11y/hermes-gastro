-- 0117 — Diagnostico v2 y contacto opcional.
-- Aplicada via MCP el 29/oct/2026. Solo expandir: clientes v1 siguen funcionando.
-- La tabla sigue siendo de plataforma, sin lectura anonima ni de tenants:
-- escribe la edge function con service role; lee private.es_staff_divianco().
alter table public.diagnosticos
  add column version smallint not null default 1 check (version in (1, 2)),
  add column respuestas_v2 jsonb not null default '{}'::jsonb
    check (jsonb_typeof(respuestas_v2) = 'object' and octet_length(respuestas_v2::text) <= 4096)
    check (respuestas_v2->>'senal' is null or respuestas_v2->>'senal' in ('diario', 'fin_mes', 'nunca', 'no_se', 'semanal', 'mensual', 'varios_meses', 'no_actualizo', 'ninguno', 'uno_dos', 'tres_cinco', 'seis_mas', 'sin_diferencia', 'hasta_10000', '10000_50000', 'mas_50000'))
    check (respuestas_v2->>'venta_mensual' is null or respuestas_v2->>'venta_mensual' in ('hasta_1m', '1m_5m', '5m_15m', 'mas_15m', 'no_se', 'prefiero_no_responder'))
    check (respuestas_v2->>'decisor' is null or respuestas_v2->>'decisor' in ('yo', 'socios', 'encargado', 'otra_persona')),
  add column lead_motivos jsonb not null default '{}'::jsonb check (jsonb_typeof(lead_motivos) = 'object'),
  add column contacto_nombre text check (char_length(contacto_nombre) between 2 and 80),
  add column contacto_whatsapp text check (contacto_whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  add column contacto_consentimiento_at timestamptz,
  add column contacto_consentimiento_version text,
  add column contacto_token_hash text check (contacto_token_hash ~ '^[a-f0-9]{64}$'),
  add constraint diagnosticos_contacto_consentido check (
    contacto_whatsapp is null or (contacto_nombre is not null and contacto_consentimiento_at is not null and contacto_consentimiento_version is not null)
  );
comment on column public.diagnosticos.contacto_token_hash is 'SHA256 de capacidad aleatoria para adjuntar contacto sin exponer la tabla. Nunca se devuelve el hash ni el contacto.';
