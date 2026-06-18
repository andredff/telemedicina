-- ============================================================================
-- FIX · Atendente não conecta na chamada com o paciente.
--
-- As policies de sinalização (20260619030000_signaling_triage_roles.sql) faziam
-- uma subconsulta DIRETA em public.consultations dentro da USING/WITH CHECK de
-- realtime.messages:
--
--     SELECT 1 FROM public.consultations c WHERE c.id::text = split_part(...)
--
-- Essa subconsulta é avaliada SOB A RLS DO PRÓPRIO USUÁRIO. O atendente, por
-- design (20260619000000), NÃO tem policy de SELECT em consultations — ele lê a
-- view triage_queue (SECURITY DEFINER) e escreve via RPCs. Logo a subconsulta
-- retorna 0 linhas para o atendente, o EXISTS falha e o subscribe do canal
-- `private: true` é REJEITADO. Paciente (SELECT da própria) e médico (SELECT de
-- todas) enxergam a linha e por isso funcionam — o bug é exclusivo do atendente.
--
-- Correção: mover a verificação para uma função SECURITY DEFINER, que enxerga a
-- consulta independentemente da RLS da tabela, mantendo exatamente as mesmas
-- regras de participação (paciente dono; médico/admin em qualquer etapa aberta;
-- atendente/admin apenas em 'with_attendant').
-- ============================================================================

-- Recebe o id como TEXT (vindo de split_part do tópico) para não estourar em
-- cast de uuid caso o tópico venha malformado.
CREATE OR REPLACE FUNCTION public.can_access_consultation_signaling(p_consultation_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consultations c
    WHERE c.id::text = p_consultation_id
      AND c.status NOT IN ('completed', 'cancelled')
      AND (
        -- paciente dono da consulta (qualquer etapa aberta)
        c.user_id = auth.uid()
        -- médicos/admins (modelo de fila aberta, qualquer etapa)
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
        )
        -- atendentes/admins SOMENTE no primeiro contato (nunca na consulta médica)
        OR (
          c.status = 'with_attendant'
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('attendant', 'admin')
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_consultation_signaling(TEXT) TO authenticated;

DROP POLICY IF EXISTS "consultation signaling read"  ON realtime.messages;
DROP POLICY IF EXISTS "consultation signaling write" ON realtime.messages;

CREATE POLICY "consultation signaling read"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'consultation:%'
    AND public.can_access_consultation_signaling(split_part(realtime.topic(), ':', 2))
  );

CREATE POLICY "consultation signaling write"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() LIKE 'consultation:%'
    AND public.can_access_consultation_signaling(split_part(realtime.topic(), ':', 2))
  );
