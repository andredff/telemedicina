-- Expand prescriptions.status CHECK constraint to include teleconsultation statuses.
-- Original: ('pending', 'partial', 'completed')
-- Added:    'cancelled' and 'in_progress' for the native WebRTC teleconsultation flow.

ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_status_check;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_status_check
  CHECK (status IN ('pending', 'partial', 'completed', 'cancelled', 'in_progress'));
