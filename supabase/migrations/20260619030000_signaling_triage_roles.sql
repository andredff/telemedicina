-- ============================================================================
-- Update WebRTC signaling authorization for the triage flow.
--
-- The original policies (20260610040000_private_signaling.sql) allowed only the
-- patient + doctor/admin, and ONLY while status IN ('pending','in_progress').
-- After the triage migration (20260619000000) those status values no longer
-- exist, which silently broke ALL signaling — including the doctor's call (now
-- 'in_consultation') — and never allowed the attendant.
--
-- New rules (realtime.messages on topic 'consultation:<id>'):
--   • Room is OPEN while the consultation is not finished/cancelled
--     (status NOT IN ('completed','cancelled')) — preserves the CARD-05 intent
--     of closing the room server-side after finalization.
--   • Allowed participants:
--       - the patient who owns the consultation (always), and
--       - doctors/admins (open-queue model, any open stage), and
--       - attendants/admins ONLY while status = 'with_attendant' (first contact),
--         so an attendant can never join a doctor's medical call.
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
        AND c.status NOT IN ('completed', 'cancelled')
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
          )
          OR (
            c.status = 'with_attendant'
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.role IN ('attendant', 'admin')
            )
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
        AND c.status NOT IN ('completed', 'cancelled')
        AND (
          c.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('doctor', 'admin')
          )
          OR (
            c.status = 'with_attendant'
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.role IN ('attendant', 'admin')
            )
          )
        )
    )
  );
