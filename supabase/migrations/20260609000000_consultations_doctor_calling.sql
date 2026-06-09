-- "Doctor is calling" signal for re-joining a dropped/closed call.
--
-- When the doctor (re)opens the video on an in_progress consultation, this
-- timestamp is bumped. The patient's app listens for the change via Realtime
-- and shows a "the doctor is calling you to join" prompt — even if the patient
-- left the call screen and went back to /teleconsultas.

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS doctor_calling_at TIMESTAMPTZ;
