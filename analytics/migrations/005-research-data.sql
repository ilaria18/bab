-- Research data of the pilot: the check-ins an athlete sends from her phone, only after tapping
-- "Send my data" and confirming (api/research.ts). Run once in the Supabase SQL editor.
-- No name, contact, IP or device id: `code` is a random code made on the phone.
-- These are health data of minors: never make these tables readable with the public (anon) key.

create table if not exists research_participants (
  code             text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  token_hash       text not null,                    -- SHA-256 of the phone's secret: only that phone can replace/delete
  consent_version  text not null,                    -- which consent text she confirmed
  consented_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

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
  note             text,
  primary key (participant, record_id)
);

alter table research_participants enable row level security;
alter table research_checkins enable row level security;

-- To analyse: Table Editor → research_checkins → Export to CSV, or queries such as
--   select participant, count(*) filter (where record = 'check-in') as check_ins
--   from research_checkins group by participant order by participant;
