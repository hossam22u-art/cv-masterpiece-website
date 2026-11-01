-- CV Masterpiece admin authorization hardening
-- Run this in the production Supabase SQL Editor before deploying the admin page.
-- Then add the real administrator account using the INSERT statement at the bottom.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
grant all on public.admin_users to service_role;

create or replace function public.is_cvm_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_cvm_admin() from public, anon;
grant execute on function public.is_cvm_admin() to authenticated;

alter table public.orders enable row level security;

drop policy if exists "Admins can view orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Authenticated users can view orders" on public.orders;
drop policy if exists "Authenticated users can update orders" on public.orders;

create policy "Only CVM admins can view orders"
on public.orders for select
to authenticated
using (public.is_cvm_admin());

create policy "Only CVM admins can update orders"
on public.orders for update
to authenticated
using (public.is_cvm_admin())
with check (public.is_cvm_admin());

-- Keep the customer INSERT policy already used by the order form.
-- Do not create anon/authenticated SELECT, UPDATE, or DELETE policies.

-- After creating the administrator in Supabase Authentication, run:
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
-- on conflict (user_id) do nothing;
