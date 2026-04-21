-- Migration: Enable pg_cron for scheduled exports
-- This sets up a weekly export cron job that calls the scheduled-export Edge Function.
-- Requires pg_cron and pg_net extensions (available on Supabase Pro+).
--
-- To enable, uncomment the lines below after deploying the Edge Function.
-- You'll also need to set the app.supabase_url and app.service_role_key config.

-- Step 1: Enable extensions (if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Step 2: Set config values (replace with your actual values)
-- ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT.supabase.co';
-- ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

-- Step 3: Schedule weekly export every Monday at 8:00 AM UTC
-- SELECT cron.schedule(
--   'weekly-export',
--   '0 8 * * 1',
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/scheduled-export',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--     ),
--     body := '{"period":"week"}'::jsonb
--   );
--   $$
-- );

-- Step 4 (optional): Schedule daily export at 7:00 AM UTC
-- SELECT cron.schedule(
--   'daily-export',
--   '0 7 * * *',
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/scheduled-export',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--     ),
--     body := '{"period":"day"}'::jsonb
--   );
--   $$
-- );

-- To view scheduled jobs: SELECT * FROM cron.job;
-- To remove a job: SELECT cron.unschedule('weekly-export');
