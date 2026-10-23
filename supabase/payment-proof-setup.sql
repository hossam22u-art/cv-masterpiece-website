-- CV Masterpiece payment-proof storage setup
-- Run once in Supabase SQL Editor for project boyaotdatuquzuqolglk.
-- Payment proof files are stored in a private bucket; admins need a signed URL to view them.

alter table public.orders
  add column if not exists payment_screenshot_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Customers may upload proofs without signing in. The app should generate a random
-- object path and never allow clients to read or delete proof files.
drop policy if exists "Public can upload payment proofs" on storage.objects;
create policy "Public can upload payment proofs"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'payment-proofs');

-- Only authenticated users who are authorized in order_admins may read proof files.
drop policy if exists "Order admins can view payment proofs" on storage.objects;
create policy "Order admins can view payment proofs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and exists (
    select 1 from public.order_admins
    where order_admins.user_id = (select auth.uid())
  )
);
