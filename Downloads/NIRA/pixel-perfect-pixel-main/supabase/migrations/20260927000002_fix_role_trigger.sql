-- Migration: Fix role assignment on signup and OAuth onboarding
-- Root cause: handle_new_user() was defaulting raw_role to 'victim' via coalesce(new.raw_user_meta_data->>'nira_role', 'victim')
-- even when role was not yet selected (e.g. OAuth), and was ignoring 'role' key.

-- 1. FIX TRIGGER FUNCTION
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
  -- Check both 'nira_role' and 'role' from user_metadata; DO NOT default to victim if missing
  raw_role := coalesce(new.raw_user_meta_data->>'nira_role', new.raw_user_meta_data->>'role', null);
  user_name := coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', 'NIRA Member');
  user_lang := coalesce(new.raw_user_meta_data->>'language', 'en');

  -- Insert profile
  insert into public.profiles (id, name, language)
  values (new.id, user_name, user_lang)
  on conflict (id) do update set name = excluded.name, language = excluded.language;

  -- Only write user_roles if an explicit role was sent in metadata
  if raw_role is not null and raw_role in ('victim', 'professional', 'admin') then
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
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 2. FIX COMPLETE_USER_SETUP RPC
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
begin
  curr_user_id := auth.uid();
  if curr_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if user_role not in ('victim', 'professional', 'admin') then
    user_role := 'victim';
  end if;

  resolved_name := coalesce(
    user_name,
    (select raw_user_meta_data->>'full_name' from auth.users where id = curr_user_id),
    (select raw_user_meta_data->>'name' from auth.users where id = curr_user_id),
    'NIRA Member'
  );

  -- Profile
  insert into public.profiles (id, name, language)
  values (curr_user_id, resolved_name, coalesce(user_lang, 'en'))
  on conflict (id) do update set name = excluded.name, language = excluded.language;

  -- Insert or update user role (overriding any unintended default)
  insert into public.user_roles (user_id, role)
  values (curr_user_id, user_role)
  on conflict (user_id, role) do nothing;

  update public.user_roles
  set role = user_role
  where user_id = curr_user_id;

  -- If victim and no case exists yet, provision case space
  if user_role = 'victim' then
    if not exists (select 1 from public.victims where profile_id = curr_user_id) then
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
      values (new_case_id, 'case_registered', 'Case space created with consent.');
    end if;
  elsif user_role = 'professional' then
    -- Clean up any placeholder victim row created inadvertently
    delete from public.victims where profile_id = curr_user_id;
  end if;

  return jsonb_build_object('success', true, 'role', user_role);
end;
$$;

-- 3. ADMINISTRATIVE ROLE UPDATE RPC (for manual fixes and professional promotions)
create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns jsonb
language plpgsql
security definer
as $$
begin
  if new_role not in ('victim', 'professional', 'admin') then
    raise exception 'Invalid role';
  end if;

  update public.user_roles
  set role = new_role
  where user_id = target_user_id;

  if not found then
    insert into public.user_roles (user_id, role)
    values (target_user_id, new_role);
  end if;

  -- Clean up victim record if transitioning to professional
  if new_role = 'professional' then
    delete from public.victims where profile_id = target_user_id;
  end if;

  return jsonb_build_object('success', true, 'user_id', target_user_id, 'role', new_role);
end;
$$;
