-- Teleconsultation TRIAGE flow: insert an attendant ("atendente") stage between
-- the patient and the doctor.
--
-- BEFORE: patient submits intake -> consultation is 'pending' -> a doctor picks
--   it from the queue (MedicoSalaEspera) -> 'in_progress' -> 'completed'.
--
-- AFTER (this migration): the lifecycle gains an attendant stage and explicit
--   statuses:
--     waiting_attendant -> with_attendant -> waiting_doctor
--        -> routed_to_doctor -> in_consultation -> completed
--     (cancelled from any pre-consultation stage)
--
-- SECURITY / LGPD ----------------------------------------------------------------
-- The attendant must NOT see doctor-authored clinical data (clinical_data,
-- prescriptions, documents). The consultations table uses REPLICA IDENTITY FULL
-- (see 20260609010000_enable_realtime_consultations.sql), so Realtime emits the
-- WHOLE row — meaning ANY role with a SELECT policy on the table would receive
-- clinical_data over the wire. Therefore attendants get NO row policy on
-- `consultations`. Instead:
--   * they READ a SECURITY DEFINER view (`triage_queue`) exposing only
--     triage-safe columns (never clinical_data);
--   * they WRITE through SECURITY DEFINER RPCs that touch only triage columns.
-- The attendant panel polls the view (it does not subscribe to the table).

begin;

-- ============================================================
-- 1) Role: 'attendant' + recursion-safe helper (mirrors is_admin()/is_lab())
-- ============================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'doctor', 'patient', 'support', 'lab', 'attendant'));

CREATE OR REPLACE FUNCTION public.is_attendant()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('attendant', 'admin')   -- admins can operate triage too
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_attendant() TO anon, authenticated;

-- ============================================================
-- 2) New triage columns
-- ============================================================
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS attendant_id            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendant_name          TEXT,
  ADD COLUMN IF NOT EXISTS triage_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS routed_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority                TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS specialty               TEXT,
  ADD COLUMN IF NOT EXISTS doctor_id               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS triage_data             JSONB,
  ADD COLUMN IF NOT EXISTS consultation_started_at TIMESTAMPTZ,  -- legal start of the medical act
  ADD COLUMN IF NOT EXISTS cancel_reason           TEXT;

ALTER TABLE public.consultations DROP CONSTRAINT IF EXISTS consultations_priority_check;
ALTER TABLE public.consultations
  ADD CONSTRAINT consultations_priority_check
  CHECK (priority IN ('normal', 'priority', 'urgent'));

-- ============================================================
-- 3) Expand the status enum (CHECK) to the 7-stage lifecycle.
--    Drop the old constraint first so the backfill isn't blocked by it.
-- ============================================================
ALTER TABLE public.consultations DROP CONSTRAINT IF EXISTS consultations_status_check;

-- Backfill legacy rows onto the new vocabulary:
--   pending     -> waiting_doctor   (already past patient submission; predate
--                  triage, so treat as triaged to avoid stranding live rows)
--   in_progress -> in_consultation
--   completed / cancelled stay as-is.
UPDATE public.consultations SET status = 'waiting_doctor'  WHERE status = 'pending';
UPDATE public.consultations SET status = 'in_consultation' WHERE status = 'in_progress';

ALTER TABLE public.consultations
  ADD CONSTRAINT consultations_status_check
  CHECK (status IN (
    'waiting_attendant',   -- Aguardando atendimento
    'with_attendant',      -- Em atendimento com atendente
    'waiting_doctor',      -- Aguardando médico disponível
    'routed_to_doctor',    -- Encaminhado para médico (claimed/ringing)
    'in_consultation',     -- Em consulta médica
    'completed',           -- Consulta finalizada
    'cancelled'            -- Consulta cancelada
  ));

-- New consultations now enter the attendant queue.
ALTER TABLE public.consultations ALTER COLUMN status SET DEFAULT 'waiting_attendant';

CREATE INDEX IF NOT EXISTS idx_consultations_priority  ON public.consultations(priority);
CREATE INDEX IF NOT EXISTS idx_consultations_attendant ON public.consultations(attendant_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_id ON public.consultations(doctor_id);

-- ============================================================
-- 4) Attendant READ surface: triage-safe columns only.
--    SECURITY DEFINER (security_invoker = off) bypasses consultations RLS, but
--    the WHERE clause restricts rows to attendants + triage stages, and the
--    column list omits clinical_data entirely. This is the ONLY way attendants
--    read consultation data (no table policy, no Realtime subscription).
-- ============================================================
-- Drop the dependent functions first: they RETURN SETOF triage_queue, so on a
-- re-run they hold a dependency on the view's composite type and would block the
-- DROP VIEW below. They are recreated in section 5.
DROP FUNCTION IF EXISTS public.triage_claim(UUID);
DROP FUNCTION IF EXISTS public.triage_route(UUID, TEXT, TEXT, JSONB);

DROP VIEW IF EXISTS public.triage_queue;
CREATE VIEW public.triage_queue
WITH (security_invoker = off) AS
SELECT
  c.id,
  c.number,
  c.status,
  c.priority,
  c.specialty,
  c.type,
  c.patient_name,
  c.created_at,
  c.triage_at,
  c.routed_at,
  c.attendant_id,
  c.attendant_name,
  c.intake_data,                 -- patient-authored chief complaint (triage-safe)
  c.triage_data,                 -- attendant-authored notes
  p.phone      AS patient_phone,
  p.cpf        AS patient_cpf,
  p.birth_date AS patient_birth_date,
  p.gender     AS patient_gender
FROM public.consultations c
LEFT JOIN public.profiles p ON p.id = c.user_id
WHERE public.is_attendant()
  AND c.status IN ('waiting_attendant', 'with_attendant', 'waiting_doctor', 'routed_to_doctor');

GRANT SELECT ON public.triage_queue TO authenticated;

-- ============================================================
-- 5) Attendant WRITE actions (SECURITY DEFINER, attendant-gated).
--    Attendants have NO direct UPDATE on consultations. These functions touch
--    only triage columns and return the triage-safe view row (never clinical_data).
-- ============================================================

-- Claim a patient from the queue -> 'with_attendant' (selecting == starting).
CREATE OR REPLACE FUNCTION public.triage_claim(p_consultation_id UUID)
RETURNS SETOF public.triage_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF NOT public.is_attendant() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.consultations
     SET status         = 'with_attendant',
         attendant_id   = auth.uid(),
         attendant_name = COALESCE(v_name, attendant_name),
         triage_at      = COALESCE(triage_at, now()),
         updated_at     = now()
   WHERE id = p_consultation_id
     AND (status = 'waiting_attendant'
          OR (status = 'with_attendant' AND attendant_id = auth.uid())); -- re-open own

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consultation not available for triage';
  END IF;

  RETURN QUERY SELECT * FROM public.triage_queue WHERE id = p_consultation_id;
END;
$$;

-- Confirm triage and route to the doctor pool -> 'waiting_doctor'.
CREATE OR REPLACE FUNCTION public.triage_route(
  p_consultation_id UUID,
  p_priority        TEXT  DEFAULT 'normal',
  p_specialty       TEXT  DEFAULT NULL,
  p_triage_data     JSONB DEFAULT NULL
)
RETURNS SETOF public.triage_queue
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_attendant() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.consultations
     SET status       = 'waiting_doctor',
         priority     = COALESCE(NULLIF(p_priority, ''), 'normal'),
         specialty    = COALESCE(p_specialty, specialty),
         triage_data  = COALESCE(p_triage_data, triage_data),
         attendant_id = COALESCE(attendant_id, auth.uid()),
         routed_at    = now(),
         updated_at   = now()
   WHERE id = p_consultation_id
     AND status IN ('with_attendant', 'waiting_attendant');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consultation not in a triable state';
  END IF;

  RETURN QUERY SELECT * FROM public.triage_queue WHERE id = p_consultation_id;
END;
$$;

-- Cancel during any pre-consultation stage.
CREATE OR REPLACE FUNCTION public.triage_cancel(
  p_consultation_id UUID,
  p_reason          TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_attendant() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.consultations
     SET status        = 'cancelled',
         cancel_reason = p_reason,
         updated_at    = now()
   WHERE id = p_consultation_id
     AND status IN ('waiting_attendant', 'with_attendant', 'waiting_doctor', 'routed_to_doctor');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consultation cannot be cancelled in its current state';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.triage_claim(UUID)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.triage_route(UUID, TEXT, TEXT, JSONB)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.triage_cancel(UUID, TEXT)               TO authenticated;

-- ============================================================
-- 6) Doctor-side transitions (race-guarded, set the legal start timestamp).
--    Doctors already have "update any consultation" RLS; these RPCs keep the
--    accept/start transitions atomic and stamp consultation_started_at — the
--    point at which the *medical act* legally begins (LGPD / CFM).
-- ============================================================

-- Accept from the doctor queue -> 'routed_to_doctor' (rings the patient).
CREATE OR REPLACE FUNCTION public.doctor_accept(
  p_consultation_id UUID,
  p_doctor_name     TEXT DEFAULT NULL,   -- name/CRM live in user_metadata, passed by client
  p_doctor_crm      TEXT DEFAULT NULL
)
RETURNS public.consultations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.consultations;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('doctor', 'admin')
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.consultations
     SET status            = 'routed_to_doctor',
         doctor_id         = auth.uid(),
         doctor_name       = COALESCE(NULLIF(p_doctor_name, ''), doctor_name),
         doctor_crm        = COALESCE(NULLIF(p_doctor_crm, ''),  doctor_crm),
         doctor_calling_at = now(),
         updated_at        = now()
   WHERE id = p_consultation_id
     AND status = 'waiting_doctor'   -- race guard: only one doctor wins
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'consultation already taken or not waiting';
  END IF;

  RETURN v_row;
END;
$$;

-- Start the video / medical act -> 'in_consultation'; stamps the legal start once.
CREATE OR REPLACE FUNCTION public.doctor_start(p_consultation_id UUID)
RETURNS public.consultations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.consultations;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('doctor', 'admin')
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.consultations
     SET status                  = 'in_consultation',
         consultation_started_at = COALESCE(consultation_started_at, now()),
         doctor_calling_at       = now(),
         updated_at              = now()
   WHERE id = p_consultation_id
     AND status IN ('routed_to_doctor', 'in_consultation')
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'consultation not ready to start';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.doctor_accept(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.doctor_start(UUID)             TO authenticated;

commit;
