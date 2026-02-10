-- Migration: Admin RBAC policies + logistics service orders
-- Date: 2026-02-10
--
-- Goals:
-- 1) Fix admin panel access to real data (RLS policies for admin SELECT/UPDATE).
-- 2) Remove insecure orders UPDATE policy that allowed any authenticated user to update any order.
-- 3) Lock down order_notifications RLS (was public), while still allowing order owner inserts.
-- 4) Create logistics_service_orders table (required by ESCOPO_FECHADO.md).

begin;

-- ============================================================
-- Helpers (inline EXISTS checks)
-- ============================================================
-- We intentionally inline the "is admin" check in each policy to avoid
-- depending on custom SQL functions across environments.

-- ============================================================
-- PROFILES: admin can view/update all profiles (for /admin/usuarios)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Admins can view all profiles'
  ) then
    create policy "Admins can view all profiles"
      on public.profiles
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Admins can update profiles'
  ) then
    create policy "Admins can update profiles"
      on public.profiles
      for update
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

-- ============================================================
-- ORDERS: allow admin SELECT; restrict UPDATE; keep user cancel
-- ============================================================

-- Insecure policy created in earlier migrations: any authenticated user could UPDATE any order.
drop policy if exists "allow_authenticated_update" on public.orders;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Admins can view all orders'
  ) then
    create policy "Admins can view all orders"
      on public.orders
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Users can cancel their own orders'
  ) then
    create policy "Users can cancel their own orders"
      on public.orders
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id and status = 'cancelled');
  end if;
end $$;

-- ============================================================
-- PRESCRIPTIONS: admin can SELECT/UPDATE (for /admin/receitas)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'prescriptions'
      and policyname = 'Admins can view all prescriptions'
  ) then
    create policy "Admins can view all prescriptions"
      on public.prescriptions
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'prescriptions'
      and policyname = 'Admins can update prescriptions'
  ) then
    create policy "Admins can update prescriptions"
      on public.prescriptions
      for update
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

-- ============================================================
-- MEDICATIONS: admin can SELECT (join in admin/search)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'medications'
      and policyname = 'Admins can view all medications'
  ) then
    create policy "Admins can view all medications"
      on public.medications
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

-- ============================================================
-- USER_SUBSCRIPTIONS: admin can SELECT (admin dashboard metrics)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_subscriptions'
      and policyname = 'Admins can view all subscriptions'
  ) then
    create policy "Admins can view all subscriptions"
      on public.user_subscriptions
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

-- ============================================================
-- ORDER_NOTIFICATIONS: lock down + allow order owner insert/select
-- ============================================================

-- Replace overly-permissive policies (they used USING true / WITH CHECK true).
drop policy if exists "Admin can view all notifications" on public.order_notifications;
drop policy if exists "Admin can insert notifications" on public.order_notifications;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_notifications'
      and policyname = 'Admins can view all notifications'
  ) then
    create policy "Admins can view all notifications"
      on public.order_notifications
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_notifications'
      and policyname = 'Admins can insert notifications'
  ) then
    create policy "Admins can insert notifications"
      on public.order_notifications
      for insert
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_notifications'
      and policyname = 'Users can view notifications for their orders'
  ) then
    create policy "Users can view notifications for their orders"
      on public.order_notifications
      for select
      using (
        exists (
          select 1 from public.orders o
          where o.id = order_notifications.order_id
            and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_notifications'
      and policyname = 'Users can insert notifications for their orders'
  ) then
    create policy "Users can insert notifications for their orders"
      on public.order_notifications
      for insert
      with check (
        exists (
          select 1 from public.orders o
          where o.id = order_notifications.order_id
            and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- ============================================================
-- LOGISTICS_SERVICE_ORDERS: create table + RLS policies
-- ============================================================

create table if not exists public.logistics_service_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  customer_name text,
  customer_email text,
  customer_phone text,
  delivery_address text,
  items jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_logistics_service_orders_order_id
  on public.logistics_service_orders(order_id);

alter table public.logistics_service_orders enable row level security;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'update_logistics_service_orders_updated_at') then
    create trigger update_logistics_service_orders_updated_at
      before update on public.logistics_service_orders
      for each row
      execute function public.update_updated_at_column();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'logistics_service_orders'
      and policyname = 'Admins can view all logistics service orders'
  ) then
    create policy "Admins can view all logistics service orders"
      on public.logistics_service_orders
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'logistics_service_orders'
      and policyname = 'Admins can insert logistics service orders'
  ) then
    create policy "Admins can insert logistics service orders"
      on public.logistics_service_orders
      for insert
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'logistics_service_orders'
      and policyname = 'Admins can update logistics service orders'
  ) then
    create policy "Admins can update logistics service orders"
      on public.logistics_service_orders
      for update
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'logistics_service_orders'
      and policyname = 'Users can view logistics service orders for their orders'
  ) then
    create policy "Users can view logistics service orders for their orders"
      on public.logistics_service_orders
      for select
      using (
        exists (
          select 1 from public.orders o
          where o.id = logistics_service_orders.order_id
            and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'logistics_service_orders'
      and policyname = 'Users can insert logistics service orders for their orders'
  ) then
    create policy "Users can insert logistics service orders for their orders"
      on public.logistics_service_orders
      for insert
      with check (
        exists (
          select 1 from public.orders o
          where o.id = logistics_service_orders.order_id
            and o.user_id = auth.uid()
        )
      );
  end if;
end $$;

commit;

