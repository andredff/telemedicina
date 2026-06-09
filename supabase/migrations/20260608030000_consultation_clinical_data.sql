-- Persist the full teleconsultation record in the database (previously localStorage-only).
--
-- intake_data   — patient-authored pre-consultation info (symptoms, medications, exam files)
-- clinical_data — doctor-authored documents (anamnese, prescription, exam requests,
--                 certificate, signature). Mirrors the ConsultationDraft shape.
--
-- Both are JSONB on the consultations row, so they inherit the existing RLS:
-- patients read/write their own row, doctors/admins read + update any row.

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS intake_data   JSONB,
  ADD COLUMN IF NOT EXISTS clinical_data JSONB;

-- Storage bucket for patient-uploaded exam files (images / PDFs).
-- Public read (URLs are unguessable; consistent with the existing `receitas` bucket),
-- authenticated users may upload.
INSERT INTO storage.buckets (id, name, public)
VALUES ('consulta-exames', 'consulta-exames', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Consulta exames public read" ON storage.objects;
CREATE POLICY "Consulta exames public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'consulta-exames');

DROP POLICY IF EXISTS "Consulta exames authenticated insert" ON storage.objects;
CREATE POLICY "Consulta exames authenticated insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'consulta-exames');
