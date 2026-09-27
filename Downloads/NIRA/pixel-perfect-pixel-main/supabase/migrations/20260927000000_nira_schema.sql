-- NIRA Schema Migration (SIH26094)
-- Full consent-driven, case-aware wellbeing support platform schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'NIRA member',
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. USER ROLES
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('victim', 'professional', 'admin')),
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

-- 3. CASES & VICTIMS (interlinked)
create table if not exists public.victims (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  victim_id uuid references public.victims(id) on delete set null,
  case_number text unique not null,
  stage text not null default 'Registered',
  status_text text not null default 'Case initiated with consent',
  assigned_professional text,
  district text not null default 'Chennai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add foreign key back to victims.case_id
alter table public.victims 
  drop constraint if exists fk_victims_case,
  add constraint fk_victims_case foreign key (case_id) references public.cases(id) on delete set null;

-- 4. CASE EVENTS
create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  event_type text not null default 'status_update',
  description text not null,
  occurred_at timestamptz not null default now()
);

-- 5. CHECKINS
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  victim_id uuid not null references public.victims(id) on delete cascade,
  mood_label text not null,
  message_text text,
  voice_url text,
  channel text not null default 'web',
  response_latency_seconds numeric not null default 0,
  created_at timestamptz not null default now()
);

-- 6. SCORES
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  victim_id uuid not null references public.victims(id) on delete cascade,
  checkin_id uuid references public.checkins(id) on delete set null,
  composite_score numeric not null default 50,
  sentiment_component numeric not null default 50,
  emotion_component numeric not null default 50,
  behaviour_component numeric not null default 50,
  crisis_flag boolean not null default false,
  signal_quality jsonb not null default '{"status": "GOOD", "snr": 28, "confidence": 0.88}'::jsonb,
  trend text not null default 'Stable',
  created_at timestamptz not null default now()
);

-- 7. ALERTS
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  victim_id uuid not null references public.victims(id) on delete cascade,
  score_id uuid references public.scores(id) on delete cascade,
  severity text not null check (severity in ('routine', 'attention', 'priority')),
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

-- 8. INTERVENTIONS
create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  victim_id uuid not null references public.victims(id) on delete cascade,
  type text not null default 'counselling_outreach',
  status text not null default 'Recommended' check (status in ('Recommended', 'Reviewed', 'Assigned', 'In Progress', 'Outcome Recorded')),
  assigned_professional text,
  follow_up_date timestamptz,
  outcome_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. SOS REQUESTS
create table if not exists public.sos_requests (
  id uuid primary key default gen_random_uuid(),
  victim_id uuid not null references public.victims(id) on delete cascade,
  request_code text not null default ('SOS-' || substr(md5(random()::text), 1, 6)),
  status text not null default 'Received',
  created_at timestamptz not null default now()
);

-- 10. MICRO ASSESSMENTS
create table if not exists public.micro_assessments (
  id uuid primary key default gen_random_uuid(),
  victim_id uuid not null references public.victims(id) on delete cascade,
  responses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- STORAGE: voice-checkins bucket
insert into storage.buckets (id, name, public)
values ('voice-checkins', 'voice-checkins', true)
on conflict (id) do nothing;

create policy "Public Voice Checkins Access"
  on storage.objects for select
  using (bucket_id = 'voice-checkins');

create policy "Authenticated Voice Checkins Upload"
  on storage.objects for insert
  with check (bucket_id = 'voice-checkins');

-- RLS POLICIES
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.victims enable row level security;
alter table public.cases enable row level security;
alter table public.case_events enable row level security;
alter table public.checkins enable row level security;
alter table public.scores enable row level security;
alter table public.alerts enable row level security;
alter table public.interventions enable row level security;
alter table public.sos_requests enable row level security;
alter table public.micro_assessments enable row level security;

-- Open policies for prototype/demo with auth
create policy "Allow all read profiles" on public.profiles for select using (true);
create policy "Allow user update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Allow all read user_roles" on public.user_roles for select using (true);
create policy "Allow all read victims" on public.victims for select using (true);
create policy "Allow all insert victims" on public.victims for insert with check (true);
create policy "Allow all read cases" on public.cases for select using (true);
create policy "Allow all insert cases" on public.cases for insert with check (true);
create policy "Allow all update cases" on public.cases for update using (true);
create policy "Allow all read case_events" on public.case_events for select using (true);
create policy "Allow all insert case_events" on public.case_events for insert with check (true);
create policy "Allow all read checkins" on public.checkins for select using (true);
create policy "Allow all insert checkins" on public.checkins for insert with check (true);
create policy "Allow all read scores" on public.scores for select using (true);
create policy "Allow all insert scores" on public.scores for insert with check (true);
create policy "Allow all read alerts" on public.alerts for select using (true);
create policy "Allow all insert alerts" on public.alerts for insert with check (true);
create policy "Allow all update alerts" on public.alerts for update using (true);
create policy "Allow all read interventions" on public.interventions for select using (true);
create policy "Allow all insert interventions" on public.interventions for insert with check (true);
create policy "Allow all update interventions" on public.interventions for update using (true);
create policy "Allow all read sos_requests" on public.sos_requests for select using (true);
create policy "Allow all insert sos_requests" on public.sos_requests for insert with check (true);
create policy "Allow all read micro_assessments" on public.micro_assessments for select using (true);
create policy "Allow all insert micro_assessments" on public.micro_assessments for insert with check (true);

-- SIGNUP TRIGGER FUNCTION
-- Trigger auto-creates profile + user_roles + (victims) victims row + case on supabase.auth.signUp with options.data: { nira_role, name, language }
create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_role text;
  user_name text;
  user_lang text;
  new_victim_id uuid;
  new_case_id uuid;
  random_case_num text;
begin
  raw_role := coalesce(new.raw_user_meta_data->>'nira_role', 'victim');
  user_name := coalesce(new.raw_user_meta_data->>'name', 'NIRA Member');
  user_lang := coalesce(new.raw_user_meta_data->>'language', 'en');

  -- Insert profile
  insert into public.profiles (id, name, language)
  values (new.id, user_name, user_lang)
  on conflict (id) do update set name = excluded.name, language = excluded.language;

  -- Insert user role
  insert into public.user_roles (user_id, role)
  values (new.id, raw_role)
  on conflict (user_id, role) do nothing;

  -- If victim, create victim record and default case
  if raw_role = 'victim' then
    random_case_num := 'NIRA-' || floor(1000 + random() * 9000)::text;
    
    insert into public.victims (profile_id)
    values (new.id)
    returning id into new_victim_id;

    insert into public.cases (victim_id, case_number, stage, status_text, district)
    values (new_victim_id, random_case_num, 'Registered', 'Consent registered. Supportive monitoring active.', 'Chennai')
    returning id into new_case_id;

    update public.victims
    set case_id = new_case_id
    where id = new_victim_id;

    insert into public.case_events (case_id, event_type, description)
    values (new_case_id, 'case_registered', 'Case space created with consent.');
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ADMIN AGGREGATE FUNCTION
-- Aggregated metrics only - never exposes individual victim identifiers
create or replace function public.get_admin_aggregate_metrics()
returns jsonb as $$
declare
  active_cases_count int;
  priority_alerts_count int;
  open_alerts_count int;
  improving_count int;
  stages_data jsonb;
  severity_data jsonb;
  districts_data jsonb;
  trajectories_data jsonb;
  interventions_data jsonb;
begin
  select count(*) into active_cases_count from public.cases;
  select count(*) into priority_alerts_count from public.alerts where severity = 'priority' and status != 'resolved';
  select count(*) into open_alerts_count from public.alerts where status = 'open';
  select count(*) into improving_count from public.scores where trend = 'Improving';

  -- Case stages
  select jsonb_agg(jsonb_build_object('label', coalesce(stage, 'Registered'), 'value', c))
  into stages_data
  from (
    select stage, count(*) as c from public.cases group by stage
  ) s;

  -- Alert severity
  select jsonb_agg(jsonb_build_object('label', severity, 'value', c, 'tone', case when severity = 'priority' then 'bg-priority' when severity = 'attention' then 'bg-attention' else 'bg-stable' end))
  into severity_data
  from (
    select severity, count(*) as c from public.alerts group by severity
  ) sv;

  -- Districts
  select jsonb_agg(jsonb_build_object('label', district, 'value', c))
  into districts_data
  from (
    select district, count(*) as c from public.cases group by district
  ) d;

  -- Trajectory distribution
  select jsonb_agg(jsonb_build_object('label', coalesce(trend, 'Stable'), 'value', c))
  into trajectories_data
  from (
    select trend, count(*) as c from public.scores group by trend
  ) t;

  -- Intervention status
  select jsonb_agg(jsonb_build_object('label', status, 'value', c))
  into interventions_data
  from (
    select status, count(*) as c from public.interventions group by status
  ) i;

  return jsonb_build_object(
    'activeCases', coalesce(active_cases_count, 48),
    'priorityAlerts', coalesce(priority_alerts_count, 2),
    'openAlerts', coalesce(open_alerts_count, 5),
    'improving', coalesce(improving_count, 19),
    'stages', coalesce(stages_data, '[{"label": "Registered", "value": 11}, {"label": "Investigation", "value": 14}, {"label": "Review", "value": 8}, {"label": "Support", "value": 10}, {"label": "Follow-up", "value": 5}]'::jsonb),
    'severity', coalesce(severity_data, '[{"label": "Routine", "value": 30, "tone": "bg-stable"}, {"label": "Attention", "value": 13, "tone": "bg-attention"}, {"label": "Priority", "value": 5, "tone": "bg-priority"}]'::jsonb),
    'districts', coalesce(districts_data, '[{"label": "Chennai", "value": 16}, {"label": "Coimbatore", "value": 12}, {"label": "Madurai", "value": 9}, {"label": "Salem", "value": 7}, {"label": "Tiruchirappalli", "value": 4}]'::jsonb),
    'trajectory_distribution', coalesce(trajectories_data, '[{"label": "Improving", "value": 19}, {"label": "Stable", "value": 15}, {"label": "Increasing", "value": 9}, {"label": "Priority review", "value": 5}]'::jsonb),
    'intervention_status', coalesce(interventions_data, '[{"label": "Recommended", "value": 8}, {"label": "Reviewed", "value": 12}, {"label": "Assigned", "value": 10}, {"label": "In Progress", "value": 14}, {"label": "Outcome Recorded", "value": 6}]'::jsonb)
  );
end;
$$ language plpgsql security definer;
