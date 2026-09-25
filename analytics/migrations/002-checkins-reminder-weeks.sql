-- For a database created with the first version of schema.sql: run once in the Supabase SQL Editor.
-- Adds check-ins, reminder flags and the weekly summaries. Existing rows keep null in the new columns.

alter table usage_visits add column if not exists checkins smallint check (checkins between 0 and 50);
alter table usage_visits add column if not exists from_reminder boolean;
alter table usage_visits add column if not exists reminder_on boolean;

create table if not exists usage_weeks (
  week                text     not null,
  active_days         text     not null check (active_days in ('1-2', '3-4', '5-7')),
  platform            text     not null check (platform in ('ios', 'android', 'web'))
);
alter table usage_weeks enable row level security;

-- let Supabase's API see the new columns and table right away
notify pgrst, 'reload schema';
