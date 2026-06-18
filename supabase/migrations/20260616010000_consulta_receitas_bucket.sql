-- ============================================================================
-- Bucket PRIVADO para os PDFs de receita assinados na teleconsulta.
--
-- NÃO confundir com o bucket público `receitas` (20260512070000), que é só cache
-- de PDFs da Memed/Assemed. Este é privado e segue o mesmo modelo do bucket de
-- exames (`consulta-exames`, 20260610030000): pasta = consultation_id, leitura
-- via signed URL de curta duração.
--
--   • Leitura : paciente dono da consulta OU médico/admin.
--   • Escrita : médico/admin (o médico faz upload do PDF assinado).
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('consulta-receitas', 'consulta-receitas', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Consulta receitas participant read" ON storage.objects;
CREATE POLICY "Consulta receitas participant read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'consulta-receitas'
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

DROP POLICY IF EXISTS "Consulta receitas doctor insert" ON storage.objects;
CREATE POLICY "Consulta receitas doctor insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'consulta-receitas'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
    )
  );

DROP POLICY IF EXISTS "Consulta receitas doctor update" ON storage.objects;
CREATE POLICY "Consulta receitas doctor update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'consulta-receitas'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
    )
  );
