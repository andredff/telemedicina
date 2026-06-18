-- ============================================================================
-- Receita médica de 1ª classe emitida durante a teleconsulta.
--
-- Antes: os medicamentos viviam apenas em consultations.clinical_data (JSON) e
-- a lista do médico (MedicoPrescricoes) lia de localStorage — frágil, por
-- navegador, e sem o artefato assinado. Esta tabela passa a registrar a receita
-- assinada, vinculada ao PACIENTE (patient_id) e ao ATENDIMENTO (consultation_id),
-- com o caminho do PDF assinado no bucket privado `consulta-receitas`.
--
-- A assinatura digital começa como stub (signature_provider = 'stub') com o seam
-- pronto para o Bird ID (Soluti / ICP-Brasil) em produção.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consultation_prescriptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id    UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  patient_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  doctor_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  doctor_name        TEXT,
  doctor_crm         TEXT,
  medications        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- snapshot: [{name,dosage,quantity,instructions}]
  guidance           TEXT,                                -- orientações médicas gerais
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
  pdf_path           TEXT,                                -- caminho no bucket consulta-receitas
  signature_provider TEXT CHECK (signature_provider IN ('stub', 'bird_id')),
  signature_id       TEXT,                                -- id da transação (Bird ID) ou STUB-*
  signature_hash     TEXT,                                -- SHA-256 do PDF assinado
  signed_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uma receita por consulta (permite upsert por consultation_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultation_prescriptions_consultation
  ON public.consultation_prescriptions (consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultation_prescriptions_patient
  ON public.consultation_prescriptions (patient_id);
CREATE INDEX IF NOT EXISTS idx_consultation_prescriptions_doctor
  ON public.consultation_prescriptions (doctor_id);

ALTER TABLE public.consultation_prescriptions ENABLE ROW LEVEL SECURITY;

-- Leitura: o paciente dono OU médicos/admins (mesmo modelo do bucket de exames).
DROP POLICY IF EXISTS "Prescriptions read" ON public.consultation_prescriptions;
CREATE POLICY "Prescriptions read"
  ON public.consultation_prescriptions FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
    )
  );

-- Escrita: somente médicos/admins (quem emite e assina a receita).
DROP POLICY IF EXISTS "Prescriptions doctor insert" ON public.consultation_prescriptions;
CREATE POLICY "Prescriptions doctor insert"
  ON public.consultation_prescriptions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
    )
  );

DROP POLICY IF EXISTS "Prescriptions doctor update" ON public.consultation_prescriptions;
CREATE POLICY "Prescriptions doctor update"
  ON public.consultation_prescriptions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
    )
  );
