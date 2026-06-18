-- ============================================================================
-- NOTIFICAÇÕES INTERNAS DA PLATAFORMA
--
-- Sistema de notificações in-app (sino no header, dropdown, página, banners)
-- com foco inicial em avisar o paciente sobre o vencimento do plano, além de
-- avisos gerais do sistema.
--
-- PRINCÍPIOS DE SEGURANÇA / LGPD
--   • RLS: cada usuário só LÊ e ATUALIZA as próprias notificações.
--   • Sem policy de INSERT: linhas só nascem via funções SECURITY DEFINER
--     (o client nunca insere direto → não dá para forjar notificação de
--     terceiros).
--   • Um trigger de UPDATE congela o conteúdo: o usuário só pode alternar
--     is_read/read_at, nunca reescrever título/corpo/tipo.
--   • Textos NUNCA carregam dado clínico sensível (CPF, diagnóstico, receita,
--     nome de medicamento, URL de exame) — apenas rótulos e contagens. IDs
--     ficam em `metadata` para navegação, não no corpo.
--
-- DEDUPLICAÇÃO
--   `dedup_key` + índice único parcial garantem que a mesma notificação
--   (ex.: "plano vence em 5 dias" para a assinatura X com vencimento Y) seja
--   criada no máximo uma vez. `INSERT ... ON CONFLICT DO NOTHING` é a trava.
--
-- ROTINA DIÁRIA
--   `run_plan_expiry_notifications()` varre as assinaturas ativas e cria as
--   notificações dos marcos (15/10/5/1/0 dias e vencido). Agendada via pg_cron
--   (bloco guardado no fim) — também pode ser chamada manualmente pelo wrapper
--   admin ou por um scheduler externo / edge function.
--
-- ⚠️ Idempotente: pode rodar no SQL Editor do Supabase quantas vezes precisar.
-- ============================================================================

-- ─── Tabela ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  action_label  TEXT,
  action_url    TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  read_at       TIMESTAMPTZ,
  dedup_key     TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_check CHECK (type IN (
    'plan_expiring',           -- plano vencendo (15/10/5/1/0 dias)
    'plan_expired',            -- plano vencido
    'payment_pending',         -- pagamento pendente
    'payment_confirmed',       -- pagamento confirmado
    'consultation_scheduled',  -- consulta agendada
    'prescription_available',  -- receita disponível
    'exam_available',          -- exame disponível
    'certificate_available',   -- atestado disponível
    'general',                 -- aviso geral da plataforma
    'security_alert'           -- alerta de segurança
  ))
);

-- Deduplicação: no máximo uma linha por dedup_key (quando informado).
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup_key_uniq
  ON public.notifications (dedup_key) WHERE dedup_key IS NOT NULL;

-- Listagem por usuário (mais recentes primeiro).
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- Contagem de não lidas (índice parcial enxuto).
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id) WHERE is_read = false;

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Cada usuário lê as próprias notificações.
DROP POLICY IF EXISTS "notifications_own_read" ON public.notifications;
CREATE POLICY "notifications_own_read"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins leem todas (suporte / auditoria).
DROP POLICY IF EXISTS "notifications_admin_read" ON public.notifications;
CREATE POLICY "notifications_admin_read"
  ON public.notifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Cada usuário atualiza as próprias notificações (marcar lida/não lida).
-- O trigger abaixo restringe QUAIS colunas podem mudar.
DROP POLICY IF EXISTS "notifications_own_update" ON public.notifications;
CREATE POLICY "notifications_own_update"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Sem policy de INSERT/DELETE: escrita apenas via RPCs SECURITY DEFINER.

-- ─── Trigger: congela conteúdo no UPDATE ────────────────────────────────────
-- A policy own_update deixaria o usuário reescrever o texto. Este trigger
-- garante que só is_read/read_at mudem, preservando a integridade do registro.

CREATE OR REPLACE FUNCTION public.notifications_guard_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type       IS DISTINCT FROM OLD.type
     OR NEW.title   IS DISTINCT FROM OLD.title
     OR NEW.body    IS DISTINCT FROM OLD.body
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.action_label IS DISTINCT FROM OLD.action_label
     OR NEW.action_url   IS DISTINCT FROM OLD.action_url
     OR NEW.dedup_key    IS DISTINCT FROM OLD.dedup_key
     OR NEW.metadata     IS DISTINCT FROM OLD.metadata
     OR NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'notifications: somente is_read/read_at podem ser atualizados';
  END IF;
  -- Carimba read_at automaticamente ao marcar como lida.
  IF NEW.is_read AND NOT OLD.is_read AND NEW.read_at IS NULL THEN
    NEW.read_at := now();
  END IF;
  IF NOT NEW.is_read THEN
    NEW.read_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notifications_guard_update ON public.notifications;
CREATE TRIGGER notifications_guard_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_guard_update();

-- ─── Trigger: pagamento confirmado encerra alertas de vencimento ────────────
-- Ao inserir uma notificação payment_confirmed, marca como lidas as pendências
-- de cobrança/vencimento ainda não lidas do mesmo usuário.

CREATE OR REPLACE FUNCTION public.notifications_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type = 'payment_confirmed' THEN
    UPDATE public.notifications
      SET is_read = true, read_at = now()
      WHERE user_id = NEW.user_id
        AND is_read = false
        AND id <> NEW.id
        AND type IN ('plan_expiring', 'plan_expired', 'payment_pending');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notifications_after_insert ON public.notifications;
CREATE TRIGGER notifications_after_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_after_insert();

-- ─── Auditoria leve (LGPD): registra eventos sem PII ────────────────────────
-- Encapsula a escrita em audit_events de forma tolerante (se a tabela ainda
-- não existir, não quebra). Apenas ids/contagens — nunca conteúdo.

CREATE OR REPLACE FUNCTION public.notifications_audit(
  p_event TEXT, p_payload JSONB
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    INSERT INTO public.audit_events (event_name, actor_id, status, payload)
    VALUES (left(p_event, 80), auth.uid(), 'success', coalesce(p_payload, '{}'::jsonb));
  EXCEPTION WHEN undefined_table THEN
    NULL; -- audit_events ausente: telemetria nunca bloqueia a feature
  END;
END $$;

-- ============================================================================
-- RPCs (endpoints)
-- ============================================================================

-- Quantidade de notificações não lidas do usuário autenticado.
CREATE OR REPLACE FUNCTION public.unread_notification_count()
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT count(*)::int FROM public.notifications
  WHERE user_id = auth.uid() AND is_read = false;
$$;

-- Marca UMA notificação como lida (somente do próprio usuário).
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.notifications
    SET is_read = true, read_at = coalesce(read_at, now())
    WHERE id = p_id AND user_id = auth.uid();
  PERFORM public.notifications_audit('notification_read', jsonb_build_object('id', p_id));
END $$;

-- Marca TODAS as não lidas do usuário como lidas. Retorna quantas mudaram.
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  WITH upd AS (
    UPDATE public.notifications
      SET is_read = true, read_at = now()
      WHERE user_id = auth.uid() AND is_read = false
      RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM upd;
  PERFORM public.notifications_audit('notification_read_all', jsonb_build_object('count', v_count));
  RETURN v_count;
END $$;

-- Cria uma notificação para o PRÓPRIO usuário (uso geral pelo front).
-- Deduplicada por dedup_key. Retorna o id (novo ou o pré-existente).
CREATE OR REPLACE FUNCTION public.create_notification(
  p_type         TEXT,
  p_title        TEXT,
  p_body         TEXT,
  p_action_label TEXT  DEFAULT NULL,
  p_action_url   TEXT  DEFAULT NULL,
  p_dedup_key    TEXT  DEFAULT NULL,
  p_metadata     JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, action_label, action_url, dedup_key, metadata)
  VALUES (auth.uid(), p_type, p_title, p_body, p_action_label, p_action_url, p_dedup_key, coalesce(p_metadata, '{}'::jsonb))
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL AND p_dedup_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.notifications WHERE dedup_key = p_dedup_key;
  END IF;
  RETURN v_id;
END $$;

-- Cria notificação para QUALQUER usuário. Restrito a admin ou service_role.
-- Usado para "aviso geral" direcionado e "alerta de segurança".
CREATE OR REPLACE FUNCTION public.admin_create_notification(
  p_user_id      UUID,
  p_type         TEXT,
  p_title        TEXT,
  p_body         TEXT,
  p_action_label TEXT  DEFAULT NULL,
  p_action_url   TEXT  DEFAULT NULL,
  p_dedup_key    TEXT  DEFAULT NULL,
  p_metadata     JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT (
    coalesce((SELECT role FROM public.profiles WHERE id = auth.uid()), '') = 'admin'
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, action_label, action_url, dedup_key, metadata)
  VALUES (p_user_id, p_type, p_title, p_body, p_action_label, p_action_url, p_dedup_key, coalesce(p_metadata, '{}'::jsonb))
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL AND p_dedup_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.notifications WHERE dedup_key = p_dedup_key;
  END IF;

  PERFORM public.notifications_audit('admin_notification_created',
    jsonb_build_object('target', p_user_id, 'type', p_type));
  RETURN v_id;
END $$;

-- Aviso geral para TODOS os usuários com perfil. Restrito a admin/service_role.
-- dedup_key por usuário evita reenvio do mesmo comunicado.
CREATE OR REPLACE FUNCTION public.broadcast_notification(
  p_type         TEXT,
  p_title        TEXT,
  p_body         TEXT,
  p_action_label TEXT DEFAULT NULL,
  p_action_url   TEXT DEFAULT NULL,
  p_dedup_tag    TEXT DEFAULT NULL   -- ex.: 'manutencao-2026-06-12'
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  IF NOT (
    coalesce((SELECT role FROM public.profiles WHERE id = auth.uid()), '') = 'admin'
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH ins AS (
    INSERT INTO public.notifications (user_id, type, title, body, action_label, action_url, dedup_key)
    SELECT p.id, p_type, p_title, p_body, p_action_label, p_action_url,
           CASE WHEN p_dedup_tag IS NOT NULL THEN 'broadcast:' || p_dedup_tag || ':' || p.id END
    FROM public.profiles p
    ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM ins;
  PERFORM public.notifications_audit('notification_broadcast',
    jsonb_build_object('type', p_type, 'count', v_count));
  RETURN v_count;
END $$;

-- Status do plano atual do usuário autenticado (snapshot p/ banner/alertas).
CREATE OR REPLACE FUNCTION public.get_plan_status()
RETURNS TABLE (
  has_plan       BOOLEAN,
  status         TEXT,
  plan_name      TEXT,
  expires_at     TIMESTAMPTZ,
  days_remaining INTEGER,
  bucket         TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT
    s.id IS NOT NULL                                   AS has_plan,
    s.status::text                                     AS status,
    p.name                                             AS plan_name,
    s.expires_at                                       AS expires_at,
    CASE WHEN s.expires_at IS NOT NULL
         THEN (s.expires_at::date - current_date) END  AS days_remaining,
    CASE
      WHEN s.expires_at IS NULL THEN NULL
      WHEN s.expires_at::date - current_date < 0  THEN 'expired'
      WHEN s.expires_at::date - current_date = 0  THEN 'd0'
      WHEN s.expires_at::date - current_date <= 1 THEN 'd1'
      WHEN s.expires_at::date - current_date <= 5 THEN 'd5'
      WHEN s.expires_at::date - current_date <= 10 THEN 'd10'
      WHEN s.expires_at::date - current_date <= 15 THEN 'd15'
      ELSE 'ok'
    END                                                AS bucket
  FROM (SELECT auth.uid() AS uid) ctx
  LEFT JOIN public.user_subscriptions s
    ON s.user_id = ctx.uid AND s.status = 'active'
  LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
  LIMIT 1;
$$;

-- ============================================================================
-- Rotina diária: cria notificações de vencimento de plano
-- ============================================================================
-- Marcos: 15, 10, 5, 1, 0 dias e vencido. dedup_key inclui a data de
-- vencimento da assinatura, de modo que uma RENOVAÇÃO (novo expires_at) volte
-- a gerar os avisos do novo ciclo, sem reabrir os do ciclo anterior.
-- NÃO concedida a `authenticated` (cria notificação para todos) — apenas
-- pg_cron/postgres e o wrapper admin abaixo a executam.

CREATE OR REPLACE FUNCTION public.run_plan_expiry_notifications()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        RECORD;
  v_days   INTEGER;
  v_bucket TEXT;
  v_type   TEXT;
  v_title  TEXT;
  v_body   TEXT;
  v_id     UUID;
  v_count  INTEGER := 0;
BEGIN
  FOR r IN
    SELECT s.id, s.user_id, s.expires_at, p.name AS plan_name
    FROM public.user_subscriptions s
    LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
    WHERE s.status = 'active' AND s.expires_at IS NOT NULL
  LOOP
    v_days := (r.expires_at::date - current_date);

    v_bucket := CASE
      WHEN v_days = 15 THEN 'd15'
      WHEN v_days = 10 THEN 'd10'
      WHEN v_days = 5  THEN 'd5'
      WHEN v_days = 1  THEN 'd1'
      WHEN v_days = 0  THEN 'd0'
      WHEN v_days < 0  THEN 'expired'
      ELSE NULL
    END;
    IF v_bucket IS NULL THEN CONTINUE; END IF;

    IF v_bucket = 'expired' THEN
      v_type  := 'plan_expired';
      v_title := 'Seu plano expirou';
      v_body  := 'Seu plano expirou. Algumas funcionalidades podem estar indisponíveis até a renovação.';
    ELSE
      v_type  := 'plan_expiring';
      v_title := 'Seu plano está próximo do vencimento';
      v_body  := CASE v_bucket
        WHEN 'd15' THEN 'Seu plano termina em 15 dias. Renove para continuar usando a plataforma sem interrupções.'
        WHEN 'd10' THEN 'Seu plano termina em 10 dias. Mantenha seu acesso ativo renovando antes do vencimento.'
        WHEN 'd5'  THEN 'Faltam 5 dias para o fim do seu plano. Evite bloqueios renovando sua assinatura.'
        WHEN 'd1'  THEN 'Seu plano termina amanhã. Renove para continuar usando a plataforma normalmente.'
        WHEN 'd0'  THEN 'Seu plano vence hoje. Renove agora para evitar limitações de acesso.'
      END;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, action_label, action_url, dedup_key, metadata)
    VALUES (
      r.user_id, v_type, v_title, v_body, 'Renovar plano', '/meu-plano',
      'plan_expiry:' || r.id || ':' || r.expires_at::date || ':' || v_bucket,
      jsonb_build_object('subscription_id', r.id, 'days_remaining', v_days, 'bucket', v_bucket)
    )
    ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN v_count := v_count + 1; END IF;
  END LOOP;

  PERFORM public.notifications_audit('plan_expiry_sweep', jsonb_build_object('created', v_count));
  RETURN v_count;
END $$;

-- Wrapper admin para disparar a varredura manualmente (testes / sem pg_cron).
CREATE OR REPLACE FUNCTION public.admin_run_plan_expiry_notifications()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    coalesce((SELECT role FROM public.profiles WHERE id = auth.uid()), '') = 'admin'
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN public.run_plan_expiry_notifications();
END $$;

-- ─── Grants ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.unread_notification_count()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_notification(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_notification(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_status()                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_run_plan_expiry_notifications()         TO authenticated;
-- run_plan_expiry_notifications() NÃO é concedida a authenticated de propósito.

-- ─── Realtime ───────────────────────────────────────────────────────────────
-- O sino atualiza ao vivo via postgres_changes; a tabela precisa estar na
-- publication e emitir a linha cheia.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ─── Agendamento diário (pg_cron) ───────────────────────────────────────────
-- Requer a extensão pg_cron habilitada (Dashboard → Database → Extensions, ou
-- `CREATE EXTENSION pg_cron;`). Bloco guardado: se a extensão não existir, a
-- migration NÃO falha — a função continua disponível para chamada manual via
-- admin_run_plan_expiry_notifications() ou por um scheduler externo.
-- Horário: 12:00 UTC ≈ 09:00 BRT.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'plan-expiry-notifications') THEN
      PERFORM cron.unschedule('plan-expiry-notifications');
    END IF;
    PERFORM cron.schedule(
      'plan-expiry-notifications',
      '0 12 * * *',
      $cron$ SELECT public.run_plan_expiry_notifications(); $cron$
    );
  END IF;
END $$;

COMMENT ON TABLE public.notifications IS
  'Notificações in-app por usuário. Escrita só via RPCs SECURITY DEFINER; leitura/marcação via RLS própria. Sem PII clínica no conteúdo (LGPD).';
