-- NIRA Migration: Audit Log & Post-OAuth User Onboarding
-- Aligned with PS SIH26094 (Consent transparency & Human-in-the-loop accountability)

-- 1. AUDIT LOG TABLE
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default 'Authorized Case Officer',
  actor_role text not null default 'professional',
  action text not null, -- e.g. 'Viewed Wellbeing Trajectory', 'Updated Case Stage', 'Case Space Created'
  details text,
  occurred_at timestamptz not null default now()
);

-- Index for speedy case audit lookups
create index if not exists idx_audit_log_case_id on public.audit_log(case_id);
create index if not exists idx_audit_log_occurred_at on public.audit_log(occurred_at desc);

-- RLS for audit_log
alter table public.audit_log enable row level security;
create policy "Allow all read audit_log" on public.audit_log for select using (true);
create policy "Allow all insert audit_log" on public.audit_log for insert with check (true);

-- 2. COMPLETE USER SETUP RPC (Post-Google OAuth & Direct onboarding)
create or replace function public.complete_user_setup(
  user_role text default 'victim',
  user_name text default null,
  user_lang text default 'en'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  curr_user_id uuid;
  resolved_name text;
  new_victim_id uuid;
  new_case_id uuid;
  random_case_num text;
  existing_role text;
begin
  curr_user_id := auth.uid();
  if curr_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Verify role value is valid
  if user_role not in ('victim', 'professional', 'admin') then
    user_role := 'victim';
  end if;

  -- Check existing role
  select role into existing_role from public.user_roles where user_id = curr_user_id limit 1;
  if existing_role is not null then
    return jsonb_build_object('success', true, 'role', existing_role, 'already_exists', true);
  end if;

  -- Fallback name from auth metadata or default
  resolved_name := coalesce(
    user_name,
    (select raw_user_meta_data->>'full_name' from auth.users where id = curr_user_id),
    (select raw_user_meta_data->>'name' from auth.users where id = curr_user_id),
    'NIRA Member'
  );

  -- Insert or update profile
  insert into public.profiles (id, name, language)
  values (curr_user_id, resolved_name, coalesce(user_lang, 'en'))
  on conflict (id) do update set name = excluded.name, language = excluded.language;

  -- Insert user role
  insert into public.user_roles (user_id, role)
  values (curr_user_id, user_role)
  on conflict (user_id, role) do nothing;

  -- If victim, create victim record & case
  if user_role = 'victim' then
    random_case_num := 'NIRA-' || floor(1000 + random() * 9000)::text;

    insert into public.victims (profile_id)
    values (curr_user_id)
    returning id into new_victim_id;

    insert into public.cases (victim_id, case_number, stage, status_text, district)
    values (new_victim_id, random_case_num, 'Registered', 'Consent registered. Supportive monitoring active.', 'Chennai')
    returning id into new_case_id;

    update public.victims
    set case_id = new_case_id
    where id = new_victim_id;

    insert into public.case_events (case_id, event_type, description)
    values (new_case_id, 'case_registered', 'Case space created with consent via Google OAuth.');

    -- Initial transparency audit entry
    insert into public.audit_log (case_id, actor_id, actor_name, actor_role, action, details)
    values (new_case_id, curr_user_id, resolved_name, 'victim', 'Case Space Created', 'Encrypted case profile and consent initialized.');
  end if;

  return jsonb_build_object('success', true, 'role', user_role, 'already_exists', false);
end;
$$;
