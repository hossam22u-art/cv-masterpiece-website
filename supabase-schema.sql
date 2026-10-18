-- CV Masterpiece order system (Supabase / PostgreSQL)
-- Run this in Supabase SQL Editor. Then create the admin user in Authentication.
create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('CV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  customer_name text not null,
  email text,
  phone text not null,
  country text,
  currency text not null default 'EGP',
  service_name text not null,
  package_name text,
  price numeric(12,2) not null default 0 check (price >= 0),
  status text not null default 'New' check (status in ('New','In progress','Completed','Cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Customers can create an order, but cannot read or change orders through the public key.
drop policy if exists "Public can create orders" on public.orders;
create policy "Public can create orders"
on public.orders for insert
to anon, authenticated
with check (
  length(trim(customer_name)) between 2 and 150
  and length(trim(phone)) between 5 and 40
  and length(trim(service_name)) between 2 and 200
  and price >= 0
);

-- Only authenticated users can view and update orders.
-- IMPORTANT: disable public sign-ups in Supabase Auth and create admin users manually.
drop policy if exists "Admins can view orders" on public.orders;
create policy "Admins can view orders"
on public.orders for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
on public.orders for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

grant insert on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;
