-- The pilot's metrics, computed from usage_visits.
-- Set the pilot's first day (a Monday) once here; everything covers the following 5 weeks.
-- Any figure based on fewer than 5 devices is hidden (shown as null) so that, with a single team,
-- nobody's own behaviour can be read off the numbers.

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 1. Per day: openings, active users, openings per user, time spent
-- ─────────────────────────────────────────────────────────────────────────────────────────────
with pilot as (select date '2026-10-05' as start),
days as (
  select
    day,
    count(*) filter (where not continued)                 as openings,
    count(*) filter (where first_of_day)                  as active_users,
    sum(seconds)                                          as total_seconds
  from usage_visits, pilot
  where day >= pilot.start and day < pilot.start + 35
  group by day
)
select
  day,
  openings,
  case when active_users >= 5 then active_users end                                  as active_users,
  case when active_users >= 5 then round(openings::numeric / active_users, 1) end   as openings_per_user,
  round(total_seconds / 60.0 / nullif(openings, 0), 1)                               as minutes_per_opening,
  case when active_users >= 5 then round(total_seconds / 60.0 / active_users, 1) end as minutes_per_user
from days
order by day;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 2. Per week of the pilot: openings, weekly active users, days used per week, time spent
-- ─────────────────────────────────────────────────────────────────────────────────────────────
with pilot as (select date '2026-10-05' as start),
weeks as (
  select
    (day - pilot.start) / 7 + 1                           as pilot_week,   -- 1..5
    count(*) filter (where not continued)                 as openings,
    count(*) filter (where first_of_week)                 as active_users,
    count(*) filter (where first_of_day)                  as user_days,     -- sum over users of the days each was active
    sum(seconds)                                          as total_seconds
  from usage_visits, pilot
  where day >= pilot.start and day < pilot.start + 35
  group by 1
)
select
  pilot_week,
  openings,
  case when active_users >= 5 then active_users end                                   as weekly_active_users,
  case when active_users >= 5 then round(openings::numeric / active_users, 1) end    as openings_per_user,
  case when active_users >= 5 then round(user_days::numeric / active_users, 1) end   as days_used_per_user,
  round(total_seconds / 60.0 / nullif(openings, 0), 1)                                as minutes_per_opening,
  case when active_users >= 5 then round(total_seconds / 60.0 / active_users, 1) end  as minutes_per_user
from weeks
order by pilot_week;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 3. Retention and churn, week by week since each athlete's first opening
--    retention(k) = devices that opened the app in their k-th week / devices that started
--    churn(k)     = 1 - retention(k)
-- ─────────────────────────────────────────────────────────────────────────────────────────────
with started as (
  select count(*) filter (where first_ever) as devices
  from usage_visits
  where day >= date '2026-10-05' and day < date '2026-10-05' + 35
),
active as (
  select week_since_first + 1 as life_week, count(*) filter (where first_of_life_week) as devices
  from usage_visits
  where day >= date '2026-10-05' and day < date '2026-10-05' + 35
    and cohort_week >= to_char(date '2026-10-05', 'IYYY-"W"IW')   -- only devices that started during the pilot
    and week_since_first < 5
  group by 1
)
select
  a.life_week,
  s.devices                                                                    as started,
  a.devices                                                                    as still_active,
  case when s.devices >= 5 then round(100.0 * a.devices / s.devices) end       as retention_pct,
  case when s.devices >= 5 then round(100.0 - 100.0 * a.devices / s.devices) end as churn_pct
from active a cross join started s
order by a.life_week;

-- Note: a device that started in the pilot's last week can't have a week 5 yet, so read the later
-- weeks with that in mind — or, as with a team onboarded all together, count only week-1 starters:
-- add `and cohort_week = to_char(date '2026-10-05', 'IYYY-"W"IW')` to both queries above.
