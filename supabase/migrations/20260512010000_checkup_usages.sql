-- ============================================================
-- Check-up usage tracking
-- ============================================================
-- Stores each check-up performed for a beneficiary, registered by a
-- laboratory user (role = 'lab'). Used to compute the patient's
-- available balance (limit from plan - count of usages).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.checkup_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  lab_name TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  plan_type TEXT,
  billing_cycle TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkup_usages_user ON public.checkup_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_checkup_usages_performed_at ON public.checkup_usages(performed_at DESC);

ALTER TABLE public.checkup_usages ENABLE ROW LEVEL SECURITY;

-- Patient can see their own check-ups
DROP POLICY IF EXISTS "Patients view own checkups" ON public.checkup_usages;
CREATE POLICY "Patients view own checkups"
  ON public.checkup_usages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Lab users can see all check-ups (to verify history when validating)
DROP POLICY IF EXISTS "Lab users view all checkups" ON public.checkup_usages;
CREATE POLICY "Lab users view all checkups"
  ON public.checkup_usages
  FOR SELECT
  USING (public.is_lab());

-- Lab users can register check-ups
DROP POLICY IF EXISTS "Lab users insert checkups" ON public.checkup_usages;
CREATE POLICY "Lab users insert checkups"
  ON public.checkup_usages
  FOR INSERT
  WITH CHECK (public.is_lab());

-- Admins have full access
DROP POLICY IF EXISTS "Admins manage checkups" ON public.checkup_usages;
CREATE POLICY "Admins manage checkups"
  ON public.checkup_usages
  FOR ALL
  USING (public.is_admin());
