-- Migration: Pro-Victim Link (Phases 1-3)
-- Connects professional to real victim data, messaging, appointments, case events, and consent management
-- FULLY IDEMPOTENT: Safe to run repeatedly and in any order.

-- 1. MESSAGES TABLE
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

-- 2. CASE ENHANCEMENTS
alter table public.cases
  add column if not exists follow_up_date timestamptz;

alter table public.case_events
  add column if not exists visible_to_victim boolean default true,
  add column if not exists author_id uuid references auth.users(id) on delete set null;

-- 3. APPOINTMENTS TABLE
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

-- 4. VICTIM CONSENT CONTROLS
alter table public.victims
  add column if not exists consent_wellbeing_monitoring boolean default true,
  add column if not exists consent_share_voice boolean default true,
  add column if not exists consent_share_text boolean default true,
  add column if not exists consent_updated_at timestamptz default now();

-- 5. SAFETY PLANS & CASE NOTES
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

-- 6. REALTIME REPLICATION CONFIGURATION (safe exception blocks)
do $$
begin
  begin
    alter publication supabase_realtime add table public.checkins;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.alerts;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.sos_requests;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.messages;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.case_events;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.cases;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.appointments;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.safety_plans;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.case_notes;
  exception when others then null;
  end;
end $$;

-- 7. ROLE HELPER FUNCTIONS (required for secure RLS policies)
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

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_professional() to authenticated;
grant execute on function public.is_professional_for_case(uuid) to authenticated;
grant execute on function public.is_victim_of_case(uuid) to authenticated;
grant execute on function public.is_own_victim(uuid) to authenticated;
grant execute on function public.can_access_case(uuid) to authenticated;

-- 8. ROW LEVEL SECURITY (Strict, Idempotent)
alter table public.messages enable row level security;
alter table public.appointments enable row level security;
alter table public.safety_plans enable row level security;
alter table public.case_notes enable row level security;

-- Drop any prior open development policies or duplicate policies
drop policy if exists "Allow authenticated read messages" on public.messages;
drop policy if exists "Allow authenticated insert messages" on public.messages;
drop policy if exists "Allow authenticated update messages" on public.messages;
drop policy if exists "Read messages policy" on public.messages;
drop policy if exists "Insert messages policy" on public.messages;
drop policy if exists "Update messages policy" on public.messages;

-- MESSAGES: Readable and writable only by the case's victim and assigned professional
create policy "Read messages policy" on public.messages
  for select using (public.is_victim_of_case(case_id) or public.is_professional_for_case(case_id) or public.is_admin());

create policy "Insert messages policy" on public.messages
  for insert with check ((public.is_victim_of_case(case_id) or public.is_professional_for_case(case_id) or public.is_admin()) and sender_id = auth.uid());

create policy "Update messages policy" on public.messages
  for update using (public.is_victim_of_case(case_id) or public.is_professional_for_case(case_id) or public.is_admin());

-- APPOINTMENTS: Dropped first, then strictly created
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

-- SAFETY PLANS: Dropped first, then strictly created
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

-- CASE NOTES: Dropped first, then strictly created
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
