-- Allow users with role='doctor' (or 'admin') to read and update any prescription.
-- Needed for the teleconsultation queue: doctors must see pending records
-- and set status='in_progress' when they accept a patient.
--
-- Existing policy "Users can view their own prescriptions" covers patients.
-- These new policies are ORed with it, so patients are unaffected.

CREATE POLICY "Doctors can view all prescriptions"
  ON public.prescriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('doctor', 'admin')
    )
  );

CREATE POLICY "Doctors can update any prescription"
  ON public.prescriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('doctor', 'admin')
    )
  );
