-- Database of a team with its own pilot (e.g. VeroVolley): a SEPARATE Supabase project (EU region).
-- Supabase → SQL Editor of THAT project → paste this whole file → Run. Safe to run again.
-- Same tables as analytics/setup.sql except the notifications: those stay in the main project,
-- which sends every reminder. Then in Vercel set, for the team (name in capitals):
--   VEROVOLLEY_SUPABASE_URL                 https://<project>.supabase.co
--   VEROVOLLEY_SUPABASE_SERVICE_ROLE_KEY    the project's secret key
-- The team's athletes use the link https://bab-analytics.vercel.app/verovolley

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


notify pgrst, 'reload schema';
