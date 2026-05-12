-- ============================================================
-- Helper: is_lab() — checks if current user has role = 'lab'
-- ============================================================
-- Mirrors the existing public.is_admin() pattern to avoid RLS
-- recursion when policies need to check the lab role.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_lab()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'lab'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_lab() TO anon, authenticated;

-- ============================================================
-- PROFILES — allow lab users to look up beneficiaries by CPF
-- ============================================================
DROP POLICY IF EXISTS "Lab users can view profiles" ON public.profiles;
CREATE POLICY "Lab users can view profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_lab());

-- ============================================================
-- USER_SUBSCRIPTIONS — allow lab users to read subscriptions
-- (needed to compute checkup balance during validation)
-- ============================================================
DROP POLICY IF EXISTS "Lab users can view subscriptions" ON public.user_subscriptions;
CREATE POLICY "Lab users can view subscriptions"
  ON public.user_subscriptions
  FOR SELECT
  USING (public.is_lab());
