-- Daily reminder for the web app (the website installed on the home screen).
-- One row per phone that has the reminder on; see api/reminder.ts and api/send-reminders.ts.
-- Separate from the usage statistics: nothing links the two tables.
-- Run once in the Supabase SQL editor.

create table if not exists push_subscriptions (
  endpoint       text primary key,                     -- address given by the phone's push service (random)
  p256dh         text not null,                        -- the phone's public key, to encrypt the message
  auth           text not null,
  remind_at      text not null check (remind_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),  -- local time, HH:MM
  time_zone      text not null,                        -- e.g. Europe/Rome
  title          text not null check (length(title) <= 60),
  body           text not null check (length(body) <= 200),   -- in the athlete's language
  last_sent_day  date,                                 -- local day of the last reminder sent
  updated_at     timestamptz not null default now()    -- refreshed every time the app is opened
);

-- Only the server (secret key) may read or write.
alter table push_subscriptions enable row level security;
