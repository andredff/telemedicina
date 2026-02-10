-- Migration: Fix infinite recursion in admin RLS policies
-- Date: 2026-02-10
--
-- We previously added policies that referenced public.profiles from within
-- public.profiles policies (and from other policies via EXISTS), which can
-- trigger: "infinite recursion detected in policy for relation \"profiles\"".
--
-- Fix: create a SECURITY DEFINER helper (public.is_admin()) that checks the
-- current user's role bypassing RLS, then rewrite admin policies to use it.

begin;

-- Helper: admin check (bypasses RLS because it's SECURITY DEFINER owned by table owner)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- Allow PostgREST roles to execute the helper inside RLS policies.
grant execute on function public.is_admin() to anon, authenticated;

-- ==========================
-- PROFILES
-- ==========================
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles
  for select
  using (public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- ==========================
-- ORDERS
-- ==========================
drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders"
  on public.orders
  for select
  using (public.is_admin());

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
  on public.orders
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- ==========================
-- PRESCRIPTIONS
-- ==========================
drop policy if exists "Admins can view all prescriptions" on public.prescriptions;
create policy "Admins can view all prescriptions"
  on public.prescriptions
  for select
  using (public.is_admin());

drop policy if exists "Admins can update prescriptions" on public.prescriptions;
create policy "Admins can update prescriptions"
  on public.prescriptions
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- ==========================
-- MEDICATIONS
-- ==========================
drop policy if exists "Admins can view all medications" on public.medications;
create policy "Admins can view all medications"
  on public.medications
  for select
  using (public.is_admin());

-- ==========================
-- USER_SUBSCRIPTIONS
-- ==========================
drop policy if exists "Admins can view all subscriptions" on public.user_subscriptions;
create policy "Admins can view all subscriptions"
  on public.user_subscriptions
  for select
  using (public.is_admin());

-- ==========================
-- ORDER_NOTIFICATIONS
-- ==========================
drop policy if exists "Admins can view all notifications" on public.order_notifications;
create policy "Admins can view all notifications"
  on public.order_notifications
  for select
  using (public.is_admin());

drop policy if exists "Admins can insert notifications" on public.order_notifications;
create policy "Admins can insert notifications"
  on public.order_notifications
  for insert
  with check (public.is_admin());

-- ==========================
-- LOGISTICS_SERVICE_ORDERS
-- ==========================
drop policy if exists "Admins can view all logistics service orders" on public.logistics_service_orders;
create policy "Admins can view all logistics service orders"
  on public.logistics_service_orders
  for select
  using (public.is_admin());

drop policy if exists "Admins can insert logistics service orders" on public.logistics_service_orders;
create policy "Admins can insert logistics service orders"
  on public.logistics_service_orders
  for insert
  with check (public.is_admin());

drop policy if exists "Admins can update logistics service orders" on public.logistics_service_orders;
create policy "Admins can update logistics service orders"
  on public.logistics_service_orders
  for update
  using (public.is_admin())
  with check (public.is_admin());

commit;

