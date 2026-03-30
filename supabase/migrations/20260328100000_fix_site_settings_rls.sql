-- Migration: Fix site_settings RLS — restrict reads to admins only
-- Date: 2026-03-28
--
-- Problem: "Anyone can read settings" policy used USING(true), exposing
-- sensitive data (resendApiKey, recaptchaSecretKey) to any user including
-- anonymous/unauthenticated requests.
--
-- Fix: Replace public SELECT policy with admin-only SELECT policy.

begin;

-- Drop the insecure public read policy
DROP POLICY IF EXISTS "Anyone can read settings" ON site_settings;

-- Only admins can read settings (API keys, secrets, etc.)
CREATE POLICY "Admins can read settings"
  ON site_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

commit;
