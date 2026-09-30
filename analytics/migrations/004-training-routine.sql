-- Training/match notifications of the web app (3 hours before and 2 hours after each session of
-- the athlete's weekly routine, instead of the daily reminder on those days).
-- Run once in the Supabase SQL editor, after 003-web-reminders.sql.

alter table push_subscriptions
  add column if not exists slots        jsonb not null default '[]',  -- [{ dow: 1-7, time: 'HH:MM', type }]
  add column if not exists session_days jsonb not null default '[]',  -- ISO weekdays with a session
  add column if not exists texts        jsonb not null default '{}',  -- text of each notification type, in her language
  add column if not exists sent_keys    jsonb not null default '[]';  -- what was already sent today
