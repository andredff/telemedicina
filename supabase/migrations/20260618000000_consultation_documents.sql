-- ============================================================================
-- Documentos médicos assinados (pedido de exame e atestado) da teleconsulta.
--
-- Espelha consultation_prescriptions (20260616000000): a receita já tinha tabela
-- + PDF assinado próprios; esta tabela faz o mesmo para PEDIDO DE EXAME e
-- ATESTADO, que antes viviam só em consultations.clinical_data (sem artefato
-- assinado). Cada documento referencia o PACIENTE (patient_id) e o ATENDIMENTO
-- (consultation_id); o PDF assinado fica no bucket privado `consulta-receitas`
-- (reutilizado — pasta = consultation_id, arquivos exame.pdf / atestado.pdf).
--
-- Assinatura digital começa como stub (signature_provider = 'stub'), com o seam
-- pronto para o Bird ID (ICP-Brasil), igual à receita.
--
-- ⚠️ Idempotente. Depende de: 20260608020000 (consultations), 20260612000000
--    (notifications + notifications_audit), 20260616010000 (bucket consulta-receitas).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consultation_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id    UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  patient_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  doctor_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  doctor_name        TEXT,
  doctor_crm         TEXT,
  doc_type           TEXT NOT NULL CHECK (doc_type IN ('exam_request', 'certificate')),
  content            JSONB NOT NULL DEFAULT '{}'::jsonb,  -- snapshot do documento
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
  pdf_path           TEXT,                                -- caminho no bucket consulta-receitas
  signature_provider TEXT CHECK (signature_provider IN ('stub', 'bird_id')),
  signature_id       TEXT,
  signature_hash     TEXT,                                -- SHA-256 do PDF assinado
  signed_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Um documento de cada tipo por consulta (permite upsert por consulta+tipo).
CREATE UNIQUE INDEX IF NOT EXISTS uq_consultation_documents_consultation_type
  ON public.consultation_documents (consultation_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_consultation_documents_patient
  ON public.consultation_documents (patient_id);
CREATE INDEX IF NOT EXISTS idx_consultation_documents_doctor
  ON public.consultation_documents (doctor_id);

ALTER TABLE public.consultation_documents ENABLE ROW LEVEL SECURITY;

-- Leitura: o paciente dono OU médicos/admins (mesmo modelo da receita).
DROP POLICY IF EXISTS "Documents read" ON public.consultation_documents;
CREATE POLICY "Documents read"
  ON public.consultation_documents FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
    )
  );

-- Escrita: somente médicos/admins (quem emite e assina).
DROP POLICY IF EXISTS "Documents doctor insert" ON public.consultation_documents;
CREATE POLICY "Documents doctor insert"
  ON public.consultation_documents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
    )
  );

DROP POLICY IF EXISTS "Documents doctor update" ON public.consultation_documents;
CREATE POLICY "Documents doctor update"
  ON public.consultation_documents FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
    )
  );

-- ─── Notificação ao paciente ────────────────────────────────────────────────
-- Notifica exame/atestado assinado. Usa o MESMO dedup_key do trigger de
-- clinical_data (20260617000000) → no máximo 1 notificação por tipo por consulta,
-- qualquer que seja a fonte (rascunho ou documento assinado).

CREATE OR REPLACE FUNCTION public.notify_patient_signed_documents()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_number BIGINT;
  v_type   TEXT;
  v_title  TEXT;
  v_body   TEXT;
  v_label  TEXT;
  v_tag    TEXT;
BEGIN
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.doc_type = 'exam_request' THEN
    v_type  := 'exam_available';
    v_title := 'Pedido de exame disponível';
    v_body  := 'Seu médico emitiu um pedido de exame. Toque para visualizar.';
    v_label := 'Ver pedido';
    v_tag   := 'exam';
  ELSIF NEW.doc_type = 'certificate' THEN
    v_type  := 'certificate_available';
    v_title := 'Atestado disponível';
    v_body  := 'Seu médico emitiu um atestado para você. Toque para visualizar.';
    v_label := 'Ver atestado';
    v_tag   := 'certificate';
  ELSE
    RETURN NEW;
  END IF;

  v_number := (SELECT number FROM public.consultations WHERE id = NEW.consultation_id);

  INSERT INTO public.notifications
    (user_id, type, title, body, action_label, action_url, dedup_key, metadata)
  VALUES (
    NEW.patient_id, v_type, v_title, v_body, v_label,
    '/consulta/' || NEW.consultation_id || '/detalhes',
    'consultation_doc:' || NEW.consultation_id || ':' || v_tag,
    jsonb_build_object('consultation_id', NEW.consultation_id, 'consultation_number', v_number, 'document_type', v_tag)
  )
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

  IF FOUND THEN
    PERFORM public.notifications_audit(
      'patient_documents_notified',
      jsonb_build_object('consultation_id', NEW.consultation_id, 'types', to_jsonb(ARRAY[v_tag]))
    );
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.notify_patient_signed_documents() IS
  'Notifica o paciente quando exame/atestado é registrado em consultation_documents. Mesmo dedup_key do trigger de clinical_data (sem duplicata). Sem PII.';

DROP TRIGGER IF EXISTS consultation_documents_notify ON public.consultation_documents;
CREATE TRIGGER consultation_documents_notify
  AFTER INSERT OR UPDATE OF status, pdf_path, content ON public.consultation_documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_patient_signed_documents();

COMMENT ON TABLE public.consultation_documents IS
  'Pedidos de exame e atestados assinados na teleconsulta (PDF no bucket consulta-receitas). Espelha consultation_prescriptions.';
