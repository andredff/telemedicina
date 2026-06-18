-- Allow the attendant to ring the patient into the video room during the
-- first-contact (triage) stage. Reuses the existing `doctor_calling_at` signal
-- (the patient app already listens to it via Realtime) so no new column or
-- patient-side subscription is needed.
--
-- The patient app distinguishes "attendant calling" from "doctor calling" by the
-- consultation status at ring time (with_attendant vs in_consultation).
--
-- Attendant-gated and limited to the with_attendant stage, consistent with the
-- other triage_* RPCs (attendants have no direct UPDATE on consultations).

CREATE OR REPLACE FUNCTION public.triage_ring(p_consultation_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_attendant() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.consultations
     SET doctor_calling_at = now(),
         updated_at        = now()
   WHERE id = p_consultation_id
     AND status = 'with_attendant';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'consultation not in attendant stage';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.triage_ring(UUID) TO authenticated;
