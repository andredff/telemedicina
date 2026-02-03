-- Migration: Fix orders status constraint and add update policy
-- Executed: 2026-01-30

-- Fix the status check constraint to match frontend values
-- Old values: processing, confirmed, in_transit, delivered, cancelled
-- New values: pending, processing, shipped, delivered, cancelled

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text]));

-- Add UPDATE policy for authenticated users (Postgres 14 compatible)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders'
      AND policyname = 'allow_authenticated_update'
  ) THEN
    CREATE POLICY "allow_authenticated_update"
      ON public.orders
      FOR UPDATE
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
