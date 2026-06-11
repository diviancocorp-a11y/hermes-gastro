-- 20260611_hermes_daily_report_cron.sql
-- Informe diario de Hermes a Telegram (alternativa liviana al dashboard
-- maestro): pg_cron llama a la edge function hermes-daily-report a las
-- 09:00 AR. Cada tenant reporta SOLO sus numeros — sin secretos cruzados.
--
-- NOTA onboarding: reemplazar <REF> y <ANON_KEY> por los del tenant nuevo.
-- La function necesita los secrets TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
-- (los mismos de sentry-to-telegram) en Project Settings → Functions → Secrets.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.unschedule('hermes-daily-report') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hermes-daily-report');
SELECT cron.schedule(
  'hermes-daily-report',
  '0 12 * * *', -- 12:00 UTC = 09:00 Argentina
  $$ SELECT net.http_post(
       url := 'https://<REF>.supabase.co/functions/v1/hermes-daily-report',
       headers := '{"Content-Type": "application/json", "apikey": "<ANON_KEY>"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
