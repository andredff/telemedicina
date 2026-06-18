-- ============================================================================
-- CARD-02 · Bucket de exames PRIVADO (AUDITORIA_TELECONSULTA.md risco C2)
--
-- Antes: `consulta-exames` era público — qualquer pessoa com a URL acessava
-- arquivos de saúde do paciente, para sempre, sem autenticação.
--
-- Agora: bucket privado. Leitura via signed URLs (TTL curto) geradas pelo
-- client autenticado; a geração da assinatura passa pelas policies abaixo:
--   • paciente dono da consulta (pasta = consultation_id)
--   • médicos/admins (modelo de fila aberta — restringir ao médico atribuído
--     quando a coluna doctor_id existir, CARD-06)
-- Upload: somente o dono da consulta, somente na pasta da própria consulta.
--
-- ATENÇÃO: URLs públicas antigas gravadas em intake_data.exames[].url passam
-- a retornar 403. Novos uploads gravam `path` e o front assina sob demanda.
-- ============================================================================

UPDATE storage.buckets SET public = false WHERE id = 'consulta-exames';

DROP POLICY IF EXISTS "Consulta exames public read" ON storage.objects;
DROP POLICY IF EXISTS "Consulta exames authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "Consulta exames participant read" ON storage.objects;
DROP POLICY IF EXISTS "Consulta exames owner insert" ON storage.objects;

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
        )
    )
  );

CREATE POLICY "Consulta exames owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'consulta-exames'
    AND EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.user_id = auth.uid()
    )
  );
