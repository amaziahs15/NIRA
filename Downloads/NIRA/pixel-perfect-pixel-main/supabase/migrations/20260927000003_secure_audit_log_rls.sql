-- Migration: Secure audit_log Row Level Security
-- Replaces overly-permissive "Allow all read audit_log" with strict case-level ownership

drop policy if exists "Allow all read audit_log" on public.audit_log;
drop policy if exists "Users can only read audit_log for their own case or role" on public.audit_log;

create policy "Users can only read audit_log for their own case or role"
on public.audit_log
for select
using (
  -- 1. System administrators
  exists (
    select 1 from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'
  )
  or
  -- 2. Assigned professional for this case (cases.assigned_professional is TEXT, auth.uid() is UUID)
  exists (
    select 1 from public.cases
    where cases.id = audit_log.case_id
      and cases.assigned_professional = auth.uid()::text
  )
  or
  -- 3. Victim who owns this case
  exists (
    select 1 from public.victims
    where victims.case_id = audit_log.case_id
      and victims.profile_id = auth.uid()
  )
);

