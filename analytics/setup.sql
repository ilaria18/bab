-- BAB pilot database: everything in one file, for a NEW Supabase project (EU region).
-- Supabase → SQL Editor → paste this whole file → Run. Safe to run again: nothing is created twice.
--
-- Five tables, four purposes. None of them stores a name, contact, IP address or device id.
-- Row level security is on everywhere with no policies: only the server (Vercel, with the
-- secret key) can read or write; the public key of the app can't.
--
--   usage_visits           anonymous usage statistics (api/usage.ts)       → dashboard "App use"
--   push_subscriptions     notifications of the web app (api/reminder.ts)  → sent by api/send-reminders.ts
--   research_participants  research data, sent only with consent          → dashboard "Check-ins"
--   research_checkins        (api/research.ts)
--   feedback               anonymous feedback (api/feedback.ts)             → dashboard "App use"


-- ── 1. Usage statistics ──────────────────────────────────────────────────────────────────────
-- One row per visit of the installed app. No id: the yes/no flags are counted on the server to
-- get daily/weekly active athletes and retention without being able to link two rows.
create table if not exists usage_visits (
  day                 date     not null,               -- local calendar day of the visit
  seconds             integer  not null check (seconds between 0 and 10800),
  cohort_week         text     not null,               -- ISO week of the phone's first visit, e.g. 2026-W41
  week_since_first    smallint not null check (week_since_first >= 0),
  first_ever          boolean  not null,               -- the phone's very first visit
  first_of_day        boolean  not null,               -- first visit that day
  first_of_week       boolean  not null,               -- first visit that ISO week
  first_of_life_week  boolean  not null,               -- first visit in that week_since_first
  continued           boolean  not null,               -- came back within 30 s: extra time, not a new opening
  platform            text     not null default 'web' check (platform in ('ios', 'android', 'web')),
  checkins            smallint check (checkins between 0 and 50),   -- how many, never what
  from_reminder       boolean,                                      -- opened by tapping a notification
  reminder_on         boolean                                       -- notifications on and allowed
);
alter table usage_visits enable row level security;

-- One row per phone and week, sent with the first visit of the week (same consent as the visits):
-- the training/match routine entered in Settings. No identifier; not linked to the visits.
create table if not exists usage_routines (
  week      text  not null,                         -- ISO week, e.g. 2026-W41
  sessions  jsonb not null default '[]',            -- [{ day: 1-7, kind: training|match, start, end }]; [] = none entered
  platform  text  not null check (platform in ('ios', 'android', 'web'))
);
alter table usage_routines enable row level security;


-- ── 2. Notifications of the web app ──────────────────────────────────────────────────────────
-- One row per phone that switched the reminder on. Deleted when switched off, when the push
-- service says the address is gone, or after 60 days without opening the app.
create table if not exists push_subscriptions (
  endpoint       text primary key,                     -- address given by the phone's push service (random)
  p256dh         text not null,                        -- the phone's public key, to encrypt the message
  auth           text not null,
  remind_at      text not null check (remind_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),  -- local HH:MM
  time_zone      text not null,                        -- e.g. Europe/Rome
  title          text not null check (length(title) <= 60),
  body           text not null check (length(body) <= 200),   -- in the athlete's language
  last_sent_day  date,                                 -- local day of the last daily reminder
  slots          jsonb not null default '[]',          -- training/match notifications: [{ dow, time, type }]
  session_days   jsonb not null default '[]',          -- ISO weekdays with a session (no daily reminder then)
  texts          jsonb not null default '{}',          -- text of each notification type
  sent_keys      jsonb not null default '[]',          -- what was already sent today
  updated_at     timestamptz not null default now()    -- refreshed every time the app is opened
);
alter table push_subscriptions enable row level security;

-- Calls api/send-reminders every 5 minutes (Vercel's free plan allows one scheduled job a day).
-- New project: before running, replace YOUR-SECRET with the value of CRON_SECRET in Vercel.
-- If the job already exists it is left untouched, so running this file again never breaks it.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $setup$
begin
  if not exists (select 1 from cron.job where jobname = 'bab-daily-reminders') then
    perform cron.schedule(
      'bab-daily-reminders',
      '*/5 * * * *',
      $job$
      select net.http_post(
        url     := 'https://bab-analytics.vercel.app/api/send-reminders',
        headers := jsonb_build_object('Authorization', 'Bearer YOUR-SECRET', 'Content-Type', 'application/json'),
        body    := '{}'::jsonb
      );
      $job$
    );
  end if;
end
$setup$;


-- ── 3. Research data (only with the athlete's consent) ───────────────────────────────────────
-- Health data of minors. `code` is a random 6-character code made on the phone; only the SHA-256
-- of the phone's secret is stored, so only that phone can replace or delete what it sent.
create table if not exists research_participants (
  code             text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  token_hash       text not null,
  consent_version  text not null,                    -- which consent text she confirmed
  consented_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  routine          jsonb not null default '[]'           -- weekly training/match sessions: [{ day, kind, start, end }]
);
alter table research_participants add column if not exists routine jsonb not null default '[]';
create table if not exists research_checkins (
  participant      text not null references research_participants(code) on delete cascade,
  record_id        text not null,                    -- the check-in's id on the phone, or 'day-YYYY-MM-DD'
  record           text not null check (record in ('check-in', 'day')),
  date             date not null,
  time             text,                             -- local HH:MM of the check-in
  word_id          text,
  word             text,                             -- in English, the same for every athlete
  category         text,
  intensity        smallint check (intensity between 0 and 10),
  energy           smallint check (energy between 1 and 7),
  triggers         text[] not null default '{}',     -- movement, pressure, stillness
  body_zones       text[] not null default '{}',     -- e.g. kneeLeft, kneeLeftBack
  on_period        boolean,                          -- that day's answer (null = not answered)
  took_painkiller  boolean,
  note             text,                             -- never shown in the dashboard
  primary key (participant, record_id)
);
alter table research_participants enable row level security;
alter table research_checkins enable row level security;


-- ── 4. Anonymous feedback ────────────────────────────────────────────────────────────────────
-- Only the week it arrived (its Monday): no day, no time, no language, no name, no participant code.
create table if not exists feedback (
  id        bigint generated always as identity primary key,
  day       date not null default date_trunc('week', current_date)::date,   -- Monday of the week
  kind      text not null check (kind in ('like', 'idea', 'problem')),
  message   text not null check (length(message) between 1 and 1000),
  screen    text not null default 'general'
);
alter table feedback enable row level security;

notify pgrst, 'reload schema';


-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- Useful commands (run them one at a time, only when needed; they are commented out on purpose)
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- Before the pilot starts: remove the test data (the notifications of the phones stay on)
--   delete from usage_visits; delete from feedback; delete from research_participants;
--
-- Is the notifications job running?
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select status_code, content from net._http_response order by created desc limit 5;
-- Stop it:
--   select cron.unschedule('bab-daily-reminders');
--
-- Existing project that still has the old table of weekly summaries (no longer used):
--   drop table if exists usage_weeks;
--
-- Existing project whose feedback still has the day and the language (before October 2026):
--   alter table feedback drop column if exists language;
--   update feedback set day = date_trunc('week', day)::date;
