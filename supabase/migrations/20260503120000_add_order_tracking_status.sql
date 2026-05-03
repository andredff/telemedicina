-- Store Correios tracking integration state instead of only the typed code.

alter table public.orders
  add column if not exists tracking_carrier text,
  add column if not exists tracking_status text,
  add column if not exists tracking_status_label text,
  add column if not exists tracking_last_event_at timestamptz,
  add column if not exists tracking_last_checked_at timestamptz,
  add column if not exists tracking_estimated_delivery text,
  add column if not exists tracking_url text,
  add column if not exists tracking_events jsonb not null default '[]'::jsonb;

create index if not exists idx_orders_tracking_code
  on public.orders(tracking_code)
  where tracking_code is not null;

create index if not exists idx_orders_tracking_refresh
  on public.orders(tracking_last_checked_at)
  where tracking_code is not null
    and status not in ('delivered', 'cancelled');

comment on column public.orders.tracking_status is
  'Latest normalized carrier status, e.g. pending_tracking, in_transit, delivered, exception.';

comment on column public.orders.tracking_events is
  'Latest tracking events returned by the carrier API.';
