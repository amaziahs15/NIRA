-- Migration: Safety plans and Case notes for NIRA
-- Supports personal safety planning (victim) and private case notes (professional)

-- 1. SAFETY PLANS
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

-- 2. CASE NOTES
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

-- RLS
alter table public.safety_plans enable row level security;
alter table public.case_notes enable row level security;

-- Policies for safety_plans
create policy "Users can view their own safety plan"
  on public.safety_plans for select
  to authenticated
  using (
    victim_id in (select id from public.victims where profile_id = auth.uid())
    or exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('professional', 'admin'))
  );

create policy "Users can insert their own safety plan"
  on public.safety_plans for insert
  to authenticated
  with check (
    victim_id in (select id from public.victims where profile_id = auth.uid())
    or exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('professional', 'admin'))
  );

create policy "Users can update their own safety plan"
  on public.safety_plans for update
  to authenticated
  using (
    victim_id in (select id from public.victims where profile_id = auth.uid())
    or exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('professional', 'admin'))
  );

-- Policies for case_notes
create policy "Staff can view case notes"
  on public.case_notes for select
  to authenticated
  using (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('professional', 'admin'))
  );

create policy "Staff can insert case notes"
  on public.case_notes for insert
  to authenticated
  with check (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('professional', 'admin'))
  );

create policy "Staff can update case notes"
  on public.case_notes for update
  to authenticated
  using (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('professional', 'admin'))
  );
