-- ─── Tabela: consultation_reminders ─────────────────────────────────────────
-- Registra consultas agendadas para controle de envio de lembretes.
-- Populada pelo endpoint POST /api/notifications/consulta-agendada.
-- O scheduler verifica esta tabela a cada 5 minutos.

create table if not exists public.consultation_reminders (
  id               uuid        default gen_random_uuid() primary key,
  consultation_id  text        not null,
  user_id          uuid        references public.profiles(id) on delete set null,
  user_email       text        not null,
  user_name        text        not null,
  especialidade    text,
  profissional     text,
  scheduled_at     timestamptz not null,
  reminder_sent    boolean     default false,
  reminded_at      timestamptz,
  created_at       timestamptz default now()
);

-- Índices para performance nas queries do scheduler
create index if not exists idx_consultation_reminders_scheduled
  on public.consultation_reminders (scheduled_at)
  where reminder_sent = false;

create index if not exists idx_consultation_reminders_user
  on public.consultation_reminders (user_id);

-- RLS: apenas o service role do servidor acessa esta tabela
alter table public.consultation_reminders enable row level security;

create policy "Service role acessa tudo"
  on public.consultation_reminders
  using (true)
  with check (true);

comment on table public.consultation_reminders is
  'Consultas agendadas aguardando lembrete de 30 minutos. Populada via API.';

-- ─── Tabela: notification_events_log ─────────────────────────────────────────
-- Auditoria de todos os eventos de notificação disparados (não apenas pedidos).

create table if not exists public.notification_events_log (
  id          uuid        default gen_random_uuid() primary key,
  event_type  text        not null,   -- UsuarioCadastrado, SenhaAlterada, etc.
  recipient   text        not null,   -- e-mail destinatário
  job_id      text,                   -- ID do job na fila
  payload     jsonb,                  -- dados completos do evento
  created_at  timestamptz default now()
);

create index if not exists idx_notification_events_log_type
  on public.notification_events_log (event_type);

create index if not exists idx_notification_events_log_created
  on public.notification_events_log (created_at desc);

alter table public.notification_events_log enable row level security;

create policy "Service role acessa tudo"
  on public.notification_events_log
  using (true)
  with check (true);

comment on table public.notification_events_log is
  'Log de auditoria de todos os eventos de notificação por e-mail.';
