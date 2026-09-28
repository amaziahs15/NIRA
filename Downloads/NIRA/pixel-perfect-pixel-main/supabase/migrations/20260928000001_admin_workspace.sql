-- Migration: Admin Workspace (Phase 4)
-- Rewrites get_admin_aggregate_metrics with real data only
-- Adds helper functions for RBAC
-- Adds missed check-in detection
-- FULLY IDEMPOTENT: Safe to run repeatedly and in any order.

-- 1. ROLE HELPER FUNCTIONS (security definer, search_path = public)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_professional()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'professional'
  );
$$;

create or replace function public.is_professional_for_case(p_case_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cases c
    where c.id = p_case_id
      and c.assigned_professional = auth.uid()::text
  );
$$;

create or replace function public.is_victim_of_case(p_case_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cases c
    join public.victims v on v.id = c.victim_id
    where c.id = p_case_id
      and v.profile_id = auth.uid()
  );
$$;

create or replace function public.is_own_victim(p_victim_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.victims
    where id = p_victim_id and profile_id = auth.uid()
  );
$$;

create or replace function public.can_access_case(p_case_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cases
    where id = p_case_id
      and (
        public.is_admin()
        or public.is_victim_of_case(p_case_id)
        or public.is_professional_for_case(p_case_id)
        or (public.is_professional() and assigned_professional is null)
      )
  );
$$;

-- Grant execute privileges
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_professional() to authenticated;
grant execute on function public.is_professional_for_case(uuid) to authenticated;
grant execute on function public.is_victim_of_case(uuid) to authenticated;
grant execute on function public.is_own_victim(uuid) to authenticated;
grant execute on function public.can_access_case(uuid) to authenticated;

-- 2. REWRITE get_admin_aggregate_metrics — real data only, no fake COALESCE fallbacks
create or replace function public.get_admin_aggregate_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_cases        int;
  v_total_victims       int;
  v_total_professionals int;
  v_unassigned_cases    int;
  v_priority_alerts     int;
  v_open_alerts         int;
  v_open_sos            int;
  v_improving           int;
  v_checkins_last7      int;
  v_missed_checkins     int;
  v_stages              jsonb;
  v_severity            jsonb;
  v_districts           jsonb;
  v_trajectories        jsonb;
  v_interventions       jsonb;
  v_checkin_series      jsonb;
  v_alert_series        jsonb;
begin
  -- Caller must be admin
  if not public.is_admin() then
    raise exception 'Access denied: admin role required';
  end if;

  -- Core metrics
  select count(*) into v_active_cases        from public.cases where stage <> 'Closed';
  select count(*) into v_total_victims       from public.victims;
  select count(*) into v_unassigned_cases    from public.cases where assigned_professional is null and stage <> 'Closed';
  select count(*) into v_priority_alerts     from public.alerts where severity = 'priority' and status <> 'resolved';
  select count(*) into v_open_alerts         from public.alerts where status = 'open';
  select count(*) into v_open_sos            from public.sos_requests where status not in ('Handled', 'resolved');
  select count(*) into v_checkins_last7      from public.checkins where created_at > now() - interval '7 days';

  select count(distinct ur.user_id) into v_total_professionals
  from public.user_roles ur
  where ur.role = 'professional';

  -- Improving: count distinct victims whose LATEST score trend is 'Improving'
  select count(*) into v_improving
  from (
    select distinct on (victim_id) victim_id, trend
    from public.scores
    order by victim_id, created_at desc
  ) latest
  where trend = 'Improving';

  -- Missed check-ins: victims with no check-in in the last 3 days and at least one prior
  select count(*) into v_missed_checkins
  from public.victims v
  where exists (select 1 from public.checkins c where c.victim_id = v.id)
    and not exists (
      select 1 from public.checkins c
      where c.victim_id = v.id
        and c.created_at > now() - interval '3 days'
    );

  -- Case stages breakdown
  select jsonb_agg(jsonb_build_object('label', stage, 'value', cnt))
  into v_stages
  from (select stage, count(*) as cnt from public.cases group by stage order by cnt desc) s;

  -- Alert severity breakdown
  select jsonb_agg(jsonb_build_object('label', severity, 'value', cnt))
  into v_severity
  from (select severity, count(*) as cnt from public.alerts group by severity) s;

  -- District breakdown
  select jsonb_agg(jsonb_build_object('label', district, 'value', cnt))
  into v_districts
  from (select district, count(*) as cnt from public.cases group by district order by cnt desc) d;

  -- Trajectory distribution (latest score per victim)
  select jsonb_agg(jsonb_build_object('label', trend, 'value', cnt))
  into v_trajectories
  from (
    select trend, count(*) as cnt
    from (
      select distinct on (victim_id) victim_id, trend
      from public.scores
      order by victim_id, created_at desc
    ) latest
    group by trend
  ) t;

  -- Intervention status breakdown
  select jsonb_agg(jsonb_build_object('label', status, 'value', cnt))
  into v_interventions
  from (select status, count(*) as cnt from public.interventions group by status) i;

  -- 30-day check-in time series (daily counts)
  select jsonb_agg(jsonb_build_object('date', day::text, 'checkins', cnt) order by day)
  into v_checkin_series
  from (
    select date_trunc('day', created_at)::date as day, count(*) as cnt
    from public.checkins
    where created_at > now() - interval '30 days'
    group by day
  ) cs;

  -- 30-day alert time series (daily counts)
  select jsonb_agg(jsonb_build_object('date', day::text, 'alerts', cnt) order by day)
  into v_alert_series
  from (
    select date_trunc('day', created_at)::date as day, count(*) as cnt
    from public.alerts
    where created_at > now() - interval '30 days'
    group by day
  ) as_data;

  return jsonb_build_object(
    'activeCases',           coalesce(v_active_cases, 0),
    'totalVictims',          coalesce(v_total_victims, 0),
    'totalProfessionals',    coalesce(v_total_professionals, 0),
    'unassignedCases',       coalesce(v_unassigned_cases, 0),
    'priorityAlerts',        coalesce(v_priority_alerts, 0),
    'openAlerts',            coalesce(v_open_alerts, 0),
    'openSOS',               coalesce(v_open_sos, 0),
    'improving',             coalesce(v_improving, 0),
    'missedCheckins',        coalesce(v_missed_checkins, 0),
    'checkinsLast7Days',     coalesce(v_checkins_last7, 0),
    'stages',                coalesce(v_stages, '[]'::jsonb),
    'severity',              coalesce(v_severity, '[]'::jsonb),
    'districts',             coalesce(v_districts, '[]'::jsonb),
    'trajectory_distribution', coalesce(v_trajectories, '[]'::jsonb),
    'intervention_status',   coalesce(v_interventions, '[]'::jsonb),
    'checkinSeries',         coalesce(v_checkin_series, '[]'::jsonb),
    'alertSeries',           coalesce(v_alert_series, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_admin_aggregate_metrics() to authenticated;

-- 3. MISSED CHECKIN FLAG FUNCTION (called by edge function / cron)
create or replace function public.flag_missed_checkins(threshold_days int default 3)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  flagged int := 0;
  v record;
begin
  for v in
    select vi.id as victim_id, c.id as case_id
    from public.victims vi
    join public.cases c on c.victim_id = vi.id
    where c.stage <> 'Closed'
      and exists (select 1 from public.checkins ch where ch.victim_id = vi.id)
      and not exists (
        select 1 from public.checkins ch
        where ch.victim_id = vi.id
          and ch.created_at > now() - (threshold_days || ' days')::interval
      )
      -- Don't create duplicate open alerts for missed check-ins
      and not exists (
        select 1 from public.alerts a
        where a.victim_id = vi.id
          and a.severity = 'attention'
          and a.status = 'open'
          and a.created_at > now() - interval '1 day'
      )
  loop
    insert into public.alerts (victim_id, severity, status)
    values (v.victim_id, 'attention', 'open');

    insert into public.case_events (case_id, event_type, description, visible_to_victim)
    values (v.case_id, 'missed_checkin',
      'No check-in received for ' || threshold_days || ' days. A supportive follow-up has been flagged.',
      false);

    flagged := flagged + 1;
  end loop;

  return flagged;
end;
$$;

grant execute on function public.flag_missed_checkins(int) to authenticated;

-- 4. ADMIN AUDIT TRIGGER: write audit_log for admin actions
create or replace function public.log_admin_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, details)
  values (
    auth.uid(),
    'admin',
    tg_op || ' on ' || tg_table_name,
    'Row id: ' || coalesce(new.id::text, old.id::text)
  );
  return new;
end;
$$;

-- 5. TABLES FROM PHASES 1-4 (ensure existence)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('victim', 'professional')),
  body text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_messages_case_created on public.messages (case_id, created_at);

alter table public.cases
  add column if not exists follow_up_date timestamptz;

alter table public.case_events
  add column if not exists visible_to_victim boolean default true,
  add column if not exists author_id uuid references auth.users(id) on delete set null;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  scheduled_at timestamptz not null,
  mode text not null default 'call' check (mode in ('call', 'in_person', 'video')),
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'reschedule_requested', 'completed', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_appointments_case on public.appointments (case_id);

alter table public.victims
  add column if not exists consent_wellbeing_monitoring boolean default true,
  add column if not exists consent_share_voice boolean default true,
  add column if not exists consent_share_text boolean default true,
  add column if not exists consent_updated_at timestamptz default now();

create table if not exists public.safety_plans (
  id uuid primary key default gen_random_uuid(),
  victim_id uuid not null references public.victims(id) on delete cascade unique,
  trusted_contacts jsonb not null default '[]'::jsonb,
  safe_places jsonb not null default '[]'::jsonb,
  warning_signs jsonb not null default '[]'::jsonb,
  coping_strategies jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  victim_id uuid references public.victims(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'Professional',
  note text not null,
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- Seed initial default settings
insert into public.system_settings (key, value)
values
  ('escalation_timeout_minutes', '30'::jsonb),
  ('missed_checkin_days', '3'::jsonb),
  ('crisis_keywords', '["suicide", "kill myself", "harm myself", "emergency", "beaten", "threatened", "weapon", "danger", "trapped"]'::jsonb),
  ('announcement_banner', '{"enabled": false, "message": ""}'::jsonb)
on conflict (key) do nothing;

-- 6. FINE-GRAINED ROW LEVEL SECURITY (Strict, Idempotent)

-- PROFILES
alter table public.profiles enable row level security;
drop policy if exists "Allow all read profiles" on public.profiles;
drop policy if exists "Allow user update own profile" on public.profiles;
drop policy if exists "Read profiles policy" on public.profiles;
drop policy if exists "Update profiles policy" on public.profiles;

create policy "Read profiles policy" on public.profiles
  for select using (auth.uid() = id or public.is_admin() or public.is_professional());

create policy "Update profiles policy" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- USER ROLES
alter table public.user_roles enable row level security;
drop policy if exists "Allow all read user_roles" on public.user_roles;
drop policy if exists "Read user_roles policy" on public.user_roles;
drop policy if exists "Admin manage user_roles policy" on public.user_roles;

create policy "Read user_roles policy" on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin() or public.is_professional());

create policy "Admin manage user_roles policy" on public.user_roles
  for all using (public.is_admin());

-- VICTIMS
alter table public.victims enable row level security;
drop policy if exists "Allow all read victims" on public.victims;
drop policy if exists "Allow all insert victims" on public.victims;
drop policy if exists "Read victims policy" on public.victims;
drop policy if exists "Insert victims policy" on public.victims;
drop policy if exists "Update victims policy" on public.victims;

create policy "Read victims policy" on public.victims
  for select using (profile_id = auth.uid() or public.is_admin() or public.is_professional());

create policy "Insert victims policy" on public.victims
  for insert with check (profile_id = auth.uid() or public.is_admin());

create policy "Update victims policy" on public.victims
  for update using (profile_id = auth.uid() or public.is_admin());

-- CASES
alter table public.cases enable row level security;
drop policy if exists "Allow all read cases" on public.cases;
drop policy if exists "Allow all insert cases" on public.cases;
drop policy if exists "Allow all update cases" on public.cases;
drop policy if exists "Read cases policy" on public.cases;
drop policy if exists "Insert cases policy" on public.cases;
drop policy if exists "Update cases policy" on public.cases;

create policy "Read cases policy" on public.cases
  for select using (public.can_access_case(id));

create policy "Insert cases policy" on public.cases
  for insert with check (public.is_admin() or public.is_professional() or exists (select 1 from public.victims where id = victim_id and profile_id = auth.uid()));

create policy "Update cases policy" on public.cases
  for update using (public.is_admin() or public.is_professional_for_case(id) or (public.is_professional() and assigned_professional is null));

-- CASE EVENTS
alter table public.case_events enable row level security;
drop policy if exists "Allow all read case_events" on public.case_events;
drop policy if exists "Allow all insert case_events" on public.case_events;
drop policy if exists "Read case_events policy" on public.case_events;
drop policy if exists "Insert case_events policy" on public.case_events;

create policy "Read case_events policy" on public.case_events
  for select using ((public.is_victim_of_case(case_id) and coalesce(visible_to_victim, true) = true) or public.is_professional_for_case(case_id) or public.is_admin());

create policy "Insert case_events policy" on public.case_events
  for insert with check (public.is_professional_for_case(case_id) or public.is_admin() or public.is_victim_of_case(case_id));

-- CHECKINS
alter table public.checkins enable row level security;
drop policy if exists "Allow all read checkins" on public.checkins;
drop policy if exists "Allow all insert checkins" on public.checkins;
drop policy if exists "Read checkins policy" on public.checkins;
drop policy if exists "Insert checkins policy" on public.checkins;
drop policy if exists "Update checkins policy" on public.checkins;

create policy "Read checkins policy" on public.checkins
  for select using (
    public.is_own_victim(victim_id)
    or (
      public.is_professional()
      and exists (
        select 1 from public.cases c
        where c.victim_id = checkins.victim_id
          and (c.assigned_professional = auth.uid()::text or c.assigned_professional is null)
      )
    )
    or public.is_admin()
  );

create policy "Insert checkins policy" on public.checkins
  for insert with check (public.is_own_victim(victim_id));

create policy "Update checkins policy" on public.checkins
  for update using (public.is_own_victim(victim_id) or public.is_admin() or public.is_professional());

-- SCORES
alter table public.scores enable row level security;
drop policy if exists "Allow all read scores" on public.scores;
drop policy if exists "Allow all insert scores" on public.scores;
drop policy if exists "Read scores policy" on public.scores;
drop policy if exists "Insert scores policy" on public.scores;

create policy "Read scores policy" on public.scores
  for select using (
    public.is_own_victim(victim_id)
    or public.is_admin()
    or (
      public.is_professional()
      and exists (
        select 1 from public.cases c
        where c.victim_id = scores.victim_id
          and (c.assigned_professional = auth.uid()::text or c.assigned_professional is null)
      )
    )
  );

create policy "Insert scores policy" on public.scores
  for insert with check (public.is_own_victim(victim_id) or public.is_professional() or public.is_admin());

-- ALERTS
alter table public.alerts enable row level security;
drop policy if exists "Allow all read alerts" on public.alerts;
drop policy if exists "Allow all insert alerts" on public.alerts;
drop policy if exists "Allow all update alerts" on public.alerts;
drop policy if exists "Read alerts policy" on public.alerts;
drop policy if exists "Insert alerts policy" on public.alerts;
drop policy if exists "Update alerts policy" on public.alerts;

create policy "Read alerts policy" on public.alerts
  for select using (public.is_own_victim(victim_id) or public.is_professional() or public.is_admin());

create policy "Insert alerts policy" on public.alerts
  for insert with check (public.is_own_victim(victim_id) or public.is_professional() or public.is_admin());

create policy "Update alerts policy" on public.alerts
  for update using (public.is_professional() or public.is_admin());

-- SOS REQUESTS
alter table public.sos_requests enable row level security;
drop policy if exists "Allow all read sos_requests" on public.sos_requests;
drop policy if exists "Allow all insert sos_requests" on public.sos_requests;
drop policy if exists "Read sos_requests policy" on public.sos_requests;
drop policy if exists "Insert sos_requests policy" on public.sos_requests;
drop policy if exists "Update sos_requests policy" on public.sos_requests;

create policy "Read sos_requests policy" on public.sos_requests
  for select using (public.is_own_victim(victim_id) or public.is_professional() or public.is_admin());

create policy "Insert sos_requests policy" on public.sos_requests
  for insert with check (public.is_own_victim(victim_id));

create policy "Update sos_requests policy" on public.sos_requests
  for update using (public.is_professional() or public.is_admin());

-- INTERVENTIONS
alter table public.interventions enable row level security;
drop policy if exists "Allow all read interventions" on public.interventions;
drop policy if exists "Allow all insert interventions" on public.interventions;
drop policy if exists "Allow all update interventions" on public.interventions;
drop policy if exists "Read interventions policy" on public.interventions;
drop policy if exists "Insert interventions policy" on public.interventions;
drop policy if exists "Update interventions policy" on public.interventions;

create policy "Read interventions policy" on public.interventions
  for select using (public.is_professional() or public.is_admin());

create policy "Insert interventions policy" on public.interventions
  for insert with check (public.is_professional() or public.is_admin());

create policy "Update interventions policy" on public.interventions
  for update using (public.is_professional() or public.is_admin());

-- MICRO ASSESSMENTS
alter table public.micro_assessments enable row level security;
drop policy if exists "Allow all read micro_assessments" on public.micro_assessments;
drop policy if exists "Allow all insert micro_assessments" on public.micro_assessments;
drop policy if exists "Read micro_assessments policy" on public.micro_assessments;
drop policy if exists "Insert micro_assessments policy" on public.micro_assessments;

create policy "Read micro_assessments policy" on public.micro_assessments
  for select using (public.is_own_victim(victim_id) or public.is_professional() or public.is_admin());

create policy "Insert micro_assessments policy" on public.micro_assessments
  for insert with check (public.is_own_victim(victim_id));

-- MESSAGES
alter table public.messages enable row level security;
drop policy if exists "Allow authenticated read messages" on public.messages;
drop policy if exists "Allow authenticated insert messages" on public.messages;
drop policy if exists "Allow authenticated update messages" on public.messages;
drop policy if exists "Read messages policy" on public.messages;
drop policy if exists "Insert messages policy" on public.messages;
drop policy if exists "Update messages policy" on public.messages;

create policy "Read messages policy" on public.messages
  for select using (public.is_victim_of_case(case_id) or public.is_professional_for_case(case_id) or public.is_admin());

create policy "Insert messages policy" on public.messages
  for insert with check ((public.is_victim_of_case(case_id) or public.is_professional_for_case(case_id) or public.is_admin()) and sender_id = auth.uid());

create policy "Update messages policy" on public.messages
  for update using (public.is_victim_of_case(case_id) or public.is_professional_for_case(case_id) or public.is_admin());

-- APPOINTMENTS
alter table public.appointments enable row level security;
drop policy if exists "Allow authenticated read appointments" on public.appointments;
drop policy if exists "Allow authenticated insert appointments" on public.appointments;
drop policy if exists "Allow authenticated update appointments" on public.appointments;
drop policy if exists "Read appointments policy" on public.appointments;
drop policy if exists "Insert appointments policy" on public.appointments;
drop policy if exists "Update appointments policy" on public.appointments;

create policy "Read appointments policy" on public.appointments
  for select using (public.is_victim_of_case(case_id) or public.is_professional_for_case(case_id) or public.is_admin());

create policy "Insert appointments policy" on public.appointments
  for insert with check (public.is_professional_for_case(case_id) or public.is_admin());

create policy "Update appointments policy" on public.appointments
  for update using (public.is_victim_of_case(case_id) or public.is_professional_for_case(case_id) or public.is_admin());

-- SAFETY PLANS
alter table public.safety_plans enable row level security;
drop policy if exists "Allow authenticated read safety_plans" on public.safety_plans;
drop policy if exists "Allow authenticated insert safety_plans" on public.safety_plans;
drop policy if exists "Allow authenticated update safety_plans" on public.safety_plans;
drop policy if exists "Read safety_plans policy" on public.safety_plans;
drop policy if exists "Insert safety_plans policy" on public.safety_plans;
drop policy if exists "Update safety_plans policy" on public.safety_plans;

create policy "Read safety_plans policy" on public.safety_plans
  for select using (
    public.is_own_victim(victim_id)
    or public.is_admin()
    or (
      public.is_professional()
      and exists (
        select 1 from public.cases c
        where c.victim_id = safety_plans.victim_id
          and (c.assigned_professional = auth.uid()::text or c.assigned_professional is null)
      )
    )
  );

create policy "Insert safety_plans policy" on public.safety_plans
  for insert with check (public.is_own_victim(victim_id) or public.is_professional() or public.is_admin());

create policy "Update safety_plans policy" on public.safety_plans
  for update using (public.is_own_victim(victim_id) or public.is_professional() or public.is_admin());

-- CASE NOTES
alter table public.case_notes enable row level security;
drop policy if exists "Allow authenticated read case_notes" on public.case_notes;
drop policy if exists "Allow authenticated insert case_notes" on public.case_notes;
drop policy if exists "Allow authenticated update case_notes" on public.case_notes;
drop policy if exists "Read case_notes policy" on public.case_notes;
drop policy if exists "Insert case_notes policy" on public.case_notes;
drop policy if exists "Update case_notes policy" on public.case_notes;

create policy "Read case_notes policy" on public.case_notes
  for select using (public.is_professional_for_case(case_id) or public.is_admin());

create policy "Insert case_notes policy" on public.case_notes
  for insert with check (public.is_professional_for_case(case_id) or public.is_admin());

create policy "Update case_notes policy" on public.case_notes
  for update using (public.is_professional_for_case(case_id) or public.is_admin());

-- SYSTEM SETTINGS
alter table public.system_settings enable row level security;
drop policy if exists "Read system_settings policy" on public.system_settings;
drop policy if exists "Write system_settings policy" on public.system_settings;

create policy "Read system_settings policy" on public.system_settings
  for select using (true);

create policy "Write system_settings policy" on public.system_settings
  for all using (public.is_admin());

-- 7. STORAGE: Make voice-checkins bucket private and configure RLS
update storage.buckets set public = false where id = 'voice-checkins';

drop policy if exists "Public Voice Checkins Access" on storage.objects;
drop policy if exists "Authenticated Voice Checkins Upload" on storage.objects;
drop policy if exists "Authenticated Voice Checkins Select" on storage.objects;

create policy "Authenticated Voice Checkins Upload"
  on storage.objects for insert
  with check (bucket_id = 'voice-checkins' and auth.role() = 'authenticated');

create policy "Authenticated Voice Checkins Select"
  on storage.objects for select
  using (bucket_id = 'voice-checkins' and auth.role() = 'authenticated');

-- Sanitize existing full URLs in checkins.voice_url to relative storage paths
update public.checkins
set voice_url = regexp_replace(voice_url, '^https?://[^/]+/storage/v1/object/public/voice-checkins/', '')
where voice_url like '%/voice-checkins/%';

-- 8. SCHEDULE MISSED CHECK-INS (pg_cron)
-- To enable in Supabase: Dashboard -> Database -> Extensions -> Enable "pg_cron".
-- Then schedule daily at 02:00 UTC:
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'nira-daily-missed-checkins') then
      perform cron.unschedule('nira-daily-missed-checkins');
    end if;
    perform cron.schedule(
      'nira-daily-missed-checkins',
      '0 2 * * *',
      'select public.flag_missed_checkins(3);'
    );
  end if;
exception when others then null;
end $$;
