-- Create dedicated table for teleconsultation sessions.
-- The `prescriptions` table was being dual-used; this splits it cleanly.
-- `prescriptions` now handles only pharmacy/medication records.
-- `consultations` handles the entire teleconsultation lifecycle.

CREATE TABLE public.consultations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_name TEXT       NOT NULL,
  doctor_name  TEXT       NOT NULL DEFAULT '',
  doctor_crm   TEXT       NOT NULL DEFAULT '',
  type         TEXT       NOT NULL DEFAULT 'clinico_geral',
  status       TEXT       NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  date         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_consultations_user_id    ON public.consultations(user_id);
CREATE INDEX idx_consultations_status     ON public.consultations(status);
CREATE INDEX idx_consultations_created_at ON public.consultations(created_at);

-- updated_at auto-maintenance
CREATE TRIGGER update_consultations_updated_at
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Patients: full access to their own consultations
CREATE POLICY "Patients can view their own consultations"
  ON public.consultations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Patients can insert their own consultations"
  ON public.consultations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Patients can update their own consultations"
  ON public.consultations FOR UPDATE
  USING (auth.uid() = user_id);

-- Doctors: read + update any consultation (queue management + finish)
CREATE POLICY "Doctors can view all consultations"
  ON public.consultations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('doctor', 'admin')
    )
  );

CREATE POLICY "Doctors can update any consultation"
  ON public.consultations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('doctor', 'admin')
    )
  );

-- Doctors can also insert consultations (for demo/testing purposes)
CREATE POLICY "Doctors can insert consultations"
  ON public.consultations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('doctor', 'admin')
    )
  );

-- Update consultation_credits: change consultation_id from INTEGER (Assemed API)
-- to UUID pointing to the new consultations table.
ALTER TABLE public.consultation_credits
  DROP COLUMN IF EXISTS consultation_id;

ALTER TABLE public.consultation_credits
  ADD COLUMN consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL;
