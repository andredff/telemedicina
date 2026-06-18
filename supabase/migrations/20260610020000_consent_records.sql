-- ============================================================================
-- CARD-03 · Consentimento livre e esclarecido para telemedicina
-- (Res. CFM 2.314/2022 art. 6º · AUDITORIA_TELECONSULTA.md)
--
-- O aceite é registrado via RPC `accept_telemedicine_consent` (SECURITY
-- DEFINER) que captura ip_hash e user-agent dos headers da requisição —
-- o client não consegue forjar esses campos. Registros são imutáveis
-- (sem policy de UPDATE/DELETE). A consulta referencia o consentimento
-- via `consultations.consent_id`.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.consent_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term_id       TEXT NOT NULL,
  term_version  TEXT NOT NULL,
  term_hash     TEXT,
  ip_hash       TEXT,
  user_agent    TEXT,
  accepted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_records_user ON public.consent_records(user_id, accepted_at);

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- Titular lê os próprios aceites; admins leem todos. Escrita só via RPC.
DROP POLICY IF EXISTS "consent_own_read" ON public.consent_records;
CREATE POLICY "consent_own_read"
  ON public.consent_records FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "consent_admin_read" ON public.consent_records;
CREATE POLICY "consent_admin_read"
  ON public.consent_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Vínculo consulta → consentimento
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS consent_id UUID REFERENCES public.consent_records(id);

CREATE OR REPLACE FUNCTION public.accept_telemedicine_consent(
  p_term_id      TEXT,
  p_term_version TEXT,
  p_term_hash    TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id      UUID;
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

  INSERT INTO public.consent_records (user_id, term_id, term_version, term_hash, ip_hash, user_agent)
  VALUES (
    auth.uid(),
    left(p_term_id, 80),
    left(p_term_version, 40),
    left(p_term_hash, 128),
    CASE WHEN v_ip <> '' THEN encode(digest(v_ip || ':novita-consent', 'sha256'), 'hex') END,
    left(v_ua, 400)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION public.accept_telemedicine_consent(TEXT, TEXT, TEXT) TO authenticated;
