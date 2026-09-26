-- Calls api/send-reminders every 5 minutes, from Supabase (Vercel's free plan only allows one
-- scheduled job a day). Run once in the Supabase SQL editor after replacing:
--   YOUR-DOMAIN   the app's address on Vercel, e.g. bab-nine.vercel.app
--   YOUR-SECRET   the same value as CRON_SECRET in Vercel
-- Needs the pg_cron and pg_net extensions (Database → Extensions, or the two lines below).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'bab-daily-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-DOMAIN/api/send-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR-SECRET', 'Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
  $$
);

-- Check it runs:     select * from cron.job_run_details order by start_time desc limit 5;
-- See the answers:   select status_code, content from net._http_response order by created desc limit 5;
-- Stop it:           select cron.unschedule('bab-daily-reminders');
