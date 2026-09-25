-- The pilot's metrics, computed from usage_visits and usage_weeks.
-- Set the pilot's first day (a Monday) in each query — search for 2026-10-05 — and run the
-- queries one at a time in the Supabase SQL Editor. Everything covers the following 5 weeks.
-- Any figure based on fewer than 5 athletes is hidden (shown as null) so that, with a single
-- team, nobody's own behaviour can be read off the numbers.
--
-- checkins / from_reminder / reminder_on are null for rows sent by app versions before they
-- existed; the queries below simply don't count those rows for these three measures.

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 1. Per day: openings, active athletes, check-ins, openings from the reminder, time spent
-- ─────────────────────────────────────────────────────────────────────────────────────────────
with pilot as (select date '2026-10-05' as start),
days as (
  select
    day,
    count(*) filter (where not continued)                     as openings,
    count(*) filter (where first_of_day)                      as active_users,
    coalesce(sum(checkins), 0)                                as checkins,
    count(*) filter (where from_reminder)                     as openings_from_reminder,
    sum(seconds)                                              as total_seconds
  from usage_visits, pilot
  where day >= pilot.start and day < pilot.start + 35
  group by day
)
select
  day,
  to_char(day, 'Dy')                                                                  as weekday,
  openings,
  case when active_users >= 5 then active_users end                                   as active_users,
  case when active_users >= 5 then round(openings::numeric / active_users, 1) end    as openings_per_user,
  checkins,
  case when active_users >= 5 then round(checkins::numeric / active_users, 1) end    as checkins_per_user,
  openings_from_reminder,
  round(total_seconds / 60.0 / nullif(openings, 0), 1)                                as minutes_per_opening,
  case when active_users >= 5 then round(total_seconds / 60.0 / active_users, 1) end  as minutes_per_user
from days
order by day;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 2. Per week of the pilot: active athletes, days of use, check-ins, reminder, time spent
--    reminder_on_pct = share of the week's active athletes with the reminder on and allowed
--    (read at each athlete's first visit of the week)
-- ─────────────────────────────────────────────────────────────────────────────────────────────
with pilot as (select date '2026-10-05' as start),
weeks as (
  select
    (day - pilot.start) / 7 + 1                               as pilot_week,   -- 1..5
    count(*) filter (where not continued)                     as openings,
    count(*) filter (where first_of_week)                     as active_users,
    count(*) filter (where first_of_day)                      as user_days,    -- sum over athletes of their days of use
    coalesce(sum(checkins), 0)                                as checkins,
    count(*) filter (where from_reminder)                     as openings_from_reminder,
    count(*) filter (where first_of_week and reminder_on)     as users_with_reminder,
    count(*) filter (where first_of_week and reminder_on is not null) as users_reminder_known,
    sum(seconds)                                              as total_seconds
  from usage_visits, pilot
  where day >= pilot.start and day < pilot.start + 35
  group by 1
)
select
  pilot_week,
  openings,
  case when active_users >= 5 then active_users end                                    as weekly_active_users,
  case when active_users >= 5 then round(openings::numeric / active_users, 1) end     as openings_per_user,
  case when active_users >= 5 then round(user_days::numeric / active_users, 1) end    as days_used_per_user,
  checkins,
  case when active_users >= 5 then round(checkins::numeric / active_users, 1) end     as checkins_per_user,
  round(100.0 * openings_from_reminder / nullif(openings, 0))                          as openings_from_reminder_pct,
  case when users_reminder_known >= 5
       then round(100.0 * users_with_reminder / users_reminder_known) end              as reminder_on_pct,
  round(total_seconds / 60.0 / nullif(openings, 0), 1)                                 as minutes_per_opening,
  case when active_users >= 5 then round(total_seconds / 60.0 / active_users, 1) end   as minutes_per_user
from weeks
order by pilot_week;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 3. Retention and churn, week by week since each athlete's first opening
--    retention(k) = athletes who opened the app in their k-th week / athletes who started
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
    and cohort_week >= to_char(date '2026-10-05', 'IYYY-"W"IW')   -- only athletes who started during the pilot
    and week_since_first < 5
  group by 1
)
select
  a.life_week,
  s.devices                                                                      as started,
  a.devices                                                                      as still_active,
  case when s.devices >= 5 then round(100.0 * a.devices / s.devices) end         as retention_pct,
  case when s.devices >= 5 then round(100.0 - 100.0 * a.devices / s.devices) end as churn_pct
from active a cross join started s
order by a.life_week;

-- Note: an athlete who started in the pilot's last week can't have a week 5 yet, so read the later
-- weeks with that in mind — or, as with a team onboarded all together, count only week-1 starters:
-- add `and cohort_week = to_char(date '2026-10-05', 'IYYY-"W"IW')` to both parts above.

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 4. How use is spread across the team: athletes by days of use in each pilot week
--    The phone reports a week at its first visit in a later week. An athlete who never opens the
--    app again after a week (she stopped, or the pilot ended) can't report it: those are counted
--    in not_reported = weekly active athletes − reports.
-- ─────────────────────────────────────────────────────────────────────────────────────────────
with pilot as (select date '2026-10-05' as start),
pilot_weeks as (
  select n as pilot_week, to_char(pilot.start + 7 * (n - 1), 'IYYY-"W"IW') as week
  from pilot, generate_series(1, 5) as n
),
active as (
  select (day - pilot.start) / 7 + 1 as pilot_week, count(*) filter (where first_of_week) as active_users
  from usage_visits, pilot
  where day >= pilot.start and day < pilot.start + 35
  group by 1
),
counts as (
  select
    p.pilot_week,
    count(*) filter (where w.active_days = '1-2') as days_1_2,
    count(*) filter (where w.active_days = '3-4') as days_3_4,
    count(*) filter (where w.active_days = '5-7') as days_5_7,
    count(w.week)                                  as reported
  from pilot_weeks p left join usage_weeks w on w.week = p.week
  group by p.pilot_week
)
select
  c.pilot_week,
  case when a.active_users >= 5 then a.active_users end                    as weekly_active_users,
  case when c.reported >= 5 then c.days_1_2 end                            as athletes_1_2_days,
  case when c.reported >= 5 then c.days_3_4 end                            as athletes_3_4_days,
  case when c.reported >= 5 then c.days_5_7 end                            as athletes_5_7_days,
  case when a.active_users >= 5 then greatest(a.active_users - c.reported, 0) end as not_reported
from counts c left join active a using (pilot_week)
order by c.pilot_week;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 5. iPhone vs Android, per pilot week
-- ─────────────────────────────────────────────────────────────────────────────────────────────
with pilot as (select date '2026-10-05' as start),
weeks as (
  select
    (day - pilot.start) / 7 + 1               as pilot_week,
    platform,
    count(*) filter (where first_of_week)     as active_users,
    count(*) filter (where first_of_day)      as user_days,
    coalesce(sum(checkins), 0)                as checkins,
    sum(seconds)                              as total_seconds
  from usage_visits, pilot
  where day >= pilot.start and day < pilot.start + 35
  group by 1, 2
)
select
  pilot_week,
  platform,
  case when active_users >= 5 then active_users end                                   as weekly_active_users,
  case when active_users >= 5 then round(user_days::numeric / active_users, 1) end   as days_used_per_user,
  case when active_users >= 5 then round(checkins::numeric / active_users, 1) end    as checkins_per_user,
  case when active_users >= 5 then round(total_seconds / 60.0 / active_users, 1) end  as minutes_per_user
from weeks
order by pilot_week, platform;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 6. How long visits last, and how many end with a check-in
-- ─────────────────────────────────────────────────────────────────────────────────────────────
with pilot as (select date '2026-10-05' as start)
select
  case
    when seconds < 60  then '1. under 1 min'
    when seconds < 180 then '2. 1-3 min'
    when seconds < 300 then '3. 3-5 min'
    else                    '4. over 5 min'
  end                                                   as length,
  count(*)                                              as openings,
  count(*) filter (where checkins > 0)                  as with_check_in,
  round(100.0 * count(*) filter (where checkins > 0)
        / nullif(count(*) filter (where checkins is not null), 0)) as with_check_in_pct
from usage_visits, pilot
where day >= pilot.start and day < pilot.start + 35 and not continued
group by 1
order by 1;
