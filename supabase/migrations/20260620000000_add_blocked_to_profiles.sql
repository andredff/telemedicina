-- ============================================================
-- Add "blocked" flag to profiles
-- ============================================================
-- Used by the admin panel to block/unblock user access. The actual
-- login block is enforced via Supabase Auth ban (ban_duration) on the
-- backend; this column mirrors that state so the admin UI can display it.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;
