-- ============================================================================
-- Allow ATTENDANTS to read patient-uploaded exam files during triage.
--
-- The patient attaches documents in the consultation wizard ("Anexar exames");
-- they land in the private `consulta-exames` bucket and are referenced from
-- intake_data.exames[].path. The triage_queue view already exposes intake_data
-- to attendants, so the file *metadata* is visible — but the storage read policy
-- (20260610030000_private_exam_bucket.sql) granted SELECT only to the patient
-- owner + doctor/admin. Signing a URL therefore failed for attendants and the
-- files could not be opened from the triage panel.
--
-- Add an attendant branch, restricted to the pre-consultation triage stages
-- (mirrors the triage_queue view's WHERE clause) so an attendant can never pull
-- exam files from a consultation that has already left triage. Doctors/admins
-- and the patient owner keep their existing access unchanged.
-- ============================================================================

DROP POLICY IF EXISTS "Consulta exames participant read" ON storage.objects;

CREATE POLICY "Consulta exames participant read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'consulta-exames'
    AND EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
          )
          OR (
            c.status IN ('waiting_attendant', 'with_attendant', 'waiting_doctor', 'routed_to_doctor')
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.role IN ('attendant', 'admin')
            )
          )
        )
    )
  );
