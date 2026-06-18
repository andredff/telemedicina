-- ============================================================================
-- NOTIFICAÇÃO AO PACIENTE: DOCUMENTOS EMITIDOS PELO MÉDICO
--
-- Quando o médico emite um documento (receita, pedido de exame ou atestado)
-- ele grava em consultations.clinical_data — tanto DURANTE a consulta
-- (persistência debounced em MedicoAtendimento) quanto APÓS, ao finalizar.
-- Este trigger observa essas gravações e cria uma notificação in-app para o
-- paciente (consultations.user_id), que aparece ao vivo no sino/dropdown
-- (Realtime já configurado em 20260612000000_notifications.sql) e leva à
-- página de detalhes da consulta, onde o documento já é exibido.
--
-- POR QUE NO BANCO (e não no client do médico)
--   • A tabela `notifications` não tem policy de INSERT: linhas só nascem por
--     funções SECURITY DEFINER. O client do médico NÃO pode criar notificação
--     para outro usuário (só `create_notification` p/ si mesmo, ou a admin-only
--     `admin_create_notification`). Um trigger SECURITY DEFINER resolve isso de
--     forma segura e independe de qual caminho do client salvou os dados.
--
-- DEDUPLICAÇÃO (sem spam)
--   O médico salva clinical_data várias vezes (debounce + finalização). O
--   `dedup_key = consultation_doc:<consulta>:<tipo>` + o índice único parcial
--   garantem no máximo UMA notificação por tipo de documento por consulta:
--   a 1ª aparição de cada documento notifica; as gravações seguintes não.
--
-- SEM PII CLÍNICA (LGPD)
--   Textos genéricos (sem medicamento, CID ou diagnóstico). Só ids/contagens
--   em `metadata`, apenas para navegação — igual ao restante das notificações.
--
-- ⚠️ Idempotente: pode rodar no SQL Editor do Supabase quantas vezes precisar.
-- Depende de: 20260608030000 (clinical_data), 20260610000000 (number),
--             20260612000000 (notifications + notifications_audit).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_patient_documents()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cd      JSONB := NEW.clinical_data;
  v_url     TEXT;
  v_has_rx  BOOLEAN := false;
  v_has_ex  BOOLEAN := false;
  v_has_ce  BOOLEAN := false;
  v_created TEXT[] := '{}';
BEGIN
  -- Sem documentos ainda: nada a fazer.
  IF v_cd IS NULL OR jsonb_typeof(v_cd) <> 'object' THEN
    RETURN NEW;
  END IF;

  -- Checagem de tipo aninhada: jsonb_array_length só roda quando É array
  -- (o AND do Postgres não garante curto-circuito → evita erro em dado malformado).
  IF jsonb_typeof(v_cd->'medications') = 'array' THEN
    v_has_rx := jsonb_array_length(v_cd->'medications') > 0;
  END IF;
  IF jsonb_typeof(v_cd->'examRequests') = 'array' THEN
    v_has_ex := jsonb_array_length(v_cd->'examRequests') > 0;
  END IF;
  v_has_ce := jsonb_typeof(v_cd->'certificate') = 'object';

  IF NOT (v_has_rx OR v_has_ex OR v_has_ce) THEN
    RETURN NEW;
  END IF;

  v_url := '/consulta/' || NEW.id || '/detalhes';

  -- Receita disponível
  IF v_has_rx THEN
    INSERT INTO public.notifications
      (user_id, type, title, body, action_label, action_url, dedup_key, metadata)
    VALUES (
      NEW.user_id, 'prescription_available',
      'Receita disponível',
      'Seu médico emitiu uma receita para você. Toque para visualizar.',
      'Ver receita', v_url,
      'consultation_doc:' || NEW.id || ':prescription',
      jsonb_build_object('consultation_id', NEW.id, 'consultation_number', NEW.number, 'document_type', 'prescription')
    )
    ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;
    IF FOUND THEN v_created := array_append(v_created, 'prescription'); END IF;
  END IF;

  -- Pedido de exame disponível
  IF v_has_ex THEN
    INSERT INTO public.notifications
      (user_id, type, title, body, action_label, action_url, dedup_key, metadata)
    VALUES (
      NEW.user_id, 'exam_available',
      'Pedido de exame disponível',
      'Seu médico emitiu um pedido de exame. Toque para visualizar.',
      'Ver pedido', v_url,
      'consultation_doc:' || NEW.id || ':exam',
      jsonb_build_object('consultation_id', NEW.id, 'consultation_number', NEW.number, 'document_type', 'exam')
    )
    ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;
    IF FOUND THEN v_created := array_append(v_created, 'exam'); END IF;
  END IF;

  -- Atestado disponível
  IF v_has_ce THEN
    INSERT INTO public.notifications
      (user_id, type, title, body, action_label, action_url, dedup_key, metadata)
    VALUES (
      NEW.user_id, 'certificate_available',
      'Atestado disponível',
      'Seu médico emitiu um atestado para você. Toque para visualizar.',
      'Ver atestado', v_url,
      'consultation_doc:' || NEW.id || ':certificate',
      jsonb_build_object('consultation_id', NEW.id, 'consultation_number', NEW.number, 'document_type', 'certificate')
    )
    ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;
    IF FOUND THEN v_created := array_append(v_created, 'certificate'); END IF;
  END IF;

  -- Auditoria leve só quando algo novo foi de fato notificado (evita ruído nos
  -- vários saves debounced). notifications_audit é tolerante (sem PII).
  IF array_length(v_created, 1) > 0 THEN
    PERFORM public.notifications_audit(
      'patient_documents_notified',
      jsonb_build_object('consultation_id', NEW.id, 'types', to_jsonb(v_created))
    );
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.notify_patient_documents() IS
  'Notifica o paciente (in-app) quando o médico emite receita/exame/atestado em consultations.clinical_data. Deduplicado por documento (dedup_key). Sem PII.';

-- Dispara só quando clinical_data está no UPDATE (eficiente) ou em qualquer
-- INSERT. A função faz early-return se ainda não houver documentos.
DROP TRIGGER IF EXISTS consultations_notify_documents ON public.consultations;
CREATE TRIGGER consultations_notify_documents
  AFTER INSERT OR UPDATE OF clinical_data ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.notify_patient_documents();

-- ─── Receita de 1ª classe: consultation_prescriptions ───────────────────────
-- A receita assinada vive em consultation_prescriptions (PDF + medications),
-- nem sempre espelhada em consultations.clinical_data. Este trigger garante que
-- o paciente seja notificado da receita emitida por esse caminho também.
-- Usa o MESMO dedup_key da receita do clinical_data → no máximo 1 notificação de
-- receita por consulta, qualquer que seja a fonte.

CREATE OR REPLACE FUNCTION public.notify_patient_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_number BIGINT;
BEGIN
  -- Sem dono identificado: não há para quem notificar.
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_number := (SELECT number FROM public.consultations WHERE id = NEW.consultation_id);

  INSERT INTO public.notifications
    (user_id, type, title, body, action_label, action_url, dedup_key, metadata)
  VALUES (
    NEW.patient_id, 'prescription_available',
    'Receita disponível',
    'Seu médico emitiu uma receita para você. Toque para visualizar.',
    'Ver receita', '/consulta/' || NEW.consultation_id || '/detalhes',
    'consultation_doc:' || NEW.consultation_id || ':prescription',
    jsonb_build_object('consultation_id', NEW.consultation_id, 'consultation_number', v_number, 'document_type', 'prescription')
  )
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

  IF FOUND THEN
    PERFORM public.notifications_audit(
      'patient_documents_notified',
      jsonb_build_object('consultation_id', NEW.consultation_id, 'types', to_jsonb(ARRAY['prescription']))
    );
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.notify_patient_prescription() IS
  'Notifica o paciente quando uma receita é registrada em consultation_prescriptions. Mesmo dedup_key da receita do clinical_data (sem duplicata). Sem PII.';

DROP TRIGGER IF EXISTS consultation_prescriptions_notify ON public.consultation_prescriptions;
CREATE TRIGGER consultation_prescriptions_notify
  AFTER INSERT OR UPDATE OF status, pdf_path, medications ON public.consultation_prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_patient_prescription();
