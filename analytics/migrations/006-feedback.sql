-- Anonymous feedback from the athletes (the app's "Feedback" tab, api/feedback.ts).
-- Only the day it arrived: no time, no name, no participant code, no IP or device id.
-- Run once in the Supabase SQL editor.

create table if not exists feedback (
  id        bigint generated always as identity primary key,
  day       date not null default current_date,
  kind      text not null check (kind in ('like', 'idea', 'problem')),
  message   text not null check (length(message) between 1 and 1000),
  screen    text not null default 'general',
  language  text
);

alter table feedback enable row level security;
