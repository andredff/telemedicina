-- Enable Supabase Realtime (postgres_changes) for the consultations table.
--
-- ROOT CAUSE of "notifications don't fire": a newly created table is NOT
-- automatically part of the `supabase_realtime` publication, so every
-- postgres_changes subscription on `consultations` (doctor queue in
-- MedicoSalaEspera, the patient "doctor is calling" ring in Teleconsultas,
-- status updates in ConsultaPage) silently receives nothing.
--
-- The WebRTC call still connects because signaling uses Realtime *broadcast*,
-- which is publication-independent — that's why the call works but the
-- notifications/queue live-updates don't.
--
-- This migration is self-contained and idempotent: run it once in the Supabase
-- SQL Editor and all Realtime on consultations starts working.

-- 1) Make sure the calling-signal column exists (idempotent).
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS doctor_calling_at TIMESTAMPTZ;

-- 2) Emit the full row in WAL so UPDATE payloads carry every column
--    (doctor_calling_at, doctor_name, status, ...) and server-side filters work.
ALTER TABLE public.consultations REPLICA IDENTITY FULL;

-- 3) Add the table to the realtime publication (guarded so re-running is safe).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'consultations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultations;
  END IF;
END $$;
