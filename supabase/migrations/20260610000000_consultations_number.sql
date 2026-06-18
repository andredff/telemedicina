-- Friendly numbers-only consultation code for patient/doctor communication ("Consulta #1024").
-- The primary id stays a UUID; this is a short sequential number shown in the UI.

CREATE SEQUENCE IF NOT EXISTS consultations_number_seq START 1000;

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS number BIGINT;

ALTER TABLE public.consultations
  ALTER COLUMN number SET DEFAULT nextval('consultations_number_seq');

-- Backfill existing rows sequentially, in creation order.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.consultations WHERE number IS NULL ORDER BY created_at LOOP
    UPDATE public.consultations SET number = nextval('consultations_number_seq') WHERE id = r.id;
  END LOOP;
END $$;

ALTER SEQUENCE consultations_number_seq OWNED BY public.consultations.number;
