-- ============================================================================
-- CARD-01 · Sinalização WebRTC em canal PRIVADO (AUDITORIA_TELECONSULTA.md C1)
--
-- Antes: o canal broadcast `consultation:<id>` era público — qualquer portador
-- do anon key (presente no bundle do front) + o UUID da consulta conseguia
-- entrar na sinalização: ler o chat, receber offer/ICE e até atender a chamada.
--
-- Agora: o client assina o canal com `private: true` (src/hooks/useSignaling.ts)
-- e estas policies em `realtime.messages` autorizam APENAS:
--   • o paciente dono da consulta, ou
--   • médicos/admins (modelo de fila aberta — restringir ao médico atribuído
--     quando houver doctor_id, CARD-06)
-- e SOMENTE enquanto a consulta estiver aberta (pending|in_progress) —
-- o que também encerra a "sala" no servidor após finalização (CARD-05).
--
-- ⚠️ ORDEM DE DEPLOY: aplicar esta migration ANTES de publicar o front com
-- `private: true`. Clients antigos (canal público) continuam funcionando até
-- o deploy; o novo client falha o subscribe se a migration não existir.
-- ============================================================================

DROP POLICY IF EXISTS "consultation signaling read"  ON realtime.messages;
DROP POLICY IF EXISTS "consultation signaling write" ON realtime.messages;

CREATE POLICY "consultation signaling read"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'consultation:%'
    AND EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id::text = split_part(realtime.topic(), ':', 2)
        AND c.status IN ('pending', 'in_progress')
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
          )
        )
    )
  );

CREATE POLICY "consultation signaling write"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() LIKE 'consultation:%'
    AND EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id::text = split_part(realtime.topic(), ':', 2)
        AND c.status IN ('pending', 'in_progress')
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
          )
        )
    )
  );
