-- Anonymous app usage: one row per visit (the app brought to the foreground, then put away).
-- No column can identify a person or a device: no id, no IP, no clock time, only the day.
-- Run once in the Supabase SQL editor (project created in an EU region).

create table if not exists usage_visits (
  day                 date     not null,               -- local calendar day of the visit
  seconds             integer  not null check (seconds between 0 and 10800),
  cohort_week         text     not null,               -- ISO week of the device's first visit, e.g. 2026-W40
  week_since_first    smallint not null check (week_since_first >= 0),
  first_ever          boolean  not null,               -- the device's very first visit
  first_of_day        boolean  not null,               -- first visit of that device that day
  first_of_week       boolean  not null,               -- first visit of that device that ISO week
  first_of_life_week  boolean  not null,               -- first visit in that week_since_first
  continued           boolean  not null,               -- came back within 30 s: extra time, not a new opening
  platform            text     not null default 'web' check (platform in ('ios', 'android', 'web'))
);

-- Only the server (service role) may write, and nobody may read through the public API.
alter table usage_visits enable row level security;

-- Rows are only ever needed for the pilot: delete them after 12 months.
-- (Supabase → Database → Cron, or run by hand)
-- delete from usage_visits where day < current_date - interval '12 months';
