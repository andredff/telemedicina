-- ============================================================================
-- CARD-04 · Trilha de auditoria (AUDITORIA_TELECONSULTA.md)
--
-- Tabela INSERT-only de eventos de auditoria/segurança. Usuários nunca
-- escrevem/leem diretamente: a escrita acontece via RPC `log_event`
-- (SECURITY DEFINER), que também captura ip_hash e user-agent dos headers
-- da requisição PostgREST (à prova de adulteração pelo client).
-- Leitura: somente admins.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.audit_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name       TEXT NOT NULL,
  actor_id         UUID,
  actor_role       TEXT,
  consultation_id  UUID,
  status           TEXT NOT NULL DEFAULT 'success',
  error_code       TEXT,
  ip_hash          TEXT,
  user_agent       TEXT,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_consultation ON public.audit_events(consultation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_name_time    ON public.audit_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor        ON public.audit_events(actor_id, created_at);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Sem policy de INSERT/UPDATE/DELETE: tabela imutável para usuários.
-- Leitura apenas para admins.
DROP POLICY IF EXISTS "audit_events_admin_read" ON public.audit_events;
CREATE POLICY "audit_events_admin_read"
  ON public.audit_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- RPC de escrita. SECURITY DEFINER ignora RLS; valida autenticação e captura
-- contexto da requisição no servidor.
CREATE OR REPLACE FUNCTION public.log_event(
  p_event_name      TEXT,
  p_consultation_id UUID DEFAULT NULL,
  p_status          TEXT DEFAULT 'success',
  p_error_code      TEXT DEFAULT NULL,
  p_payload         JSONB DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_headers JSON;
  v_ip      TEXT;
  v_ua      TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_headers := nullif(current_setting('request.headers', true), '')::json;
  v_ip := split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1);
  v_ua := coalesce(v_headers->>'user-agent', '');

  INSERT INTO public.audit_events
    (event_name, actor_id, actor_role, consultation_id, status, error_code, ip_hash, user_agent, payload)
  VALUES (
    left(p_event_name, 80),
    auth.uid(),
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    p_consultation_id,
    left(coalesce(p_status, 'success'), 20),
    left(p_error_code, 80),
    CASE WHEN v_ip <> '' THEN encode(digest(v_ip || ':novita-audit', 'sha256'), 'hex') END,
    left(v_ua, 400),
    coalesce(p_payload, '{}'::jsonb)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.log_event(TEXT, UUID, TEXT, TEXT, JSONB) TO authenticated;
