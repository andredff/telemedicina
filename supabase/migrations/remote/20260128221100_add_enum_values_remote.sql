-- Migration: Add diamante enum values (Step 1 of 2)
-- Run this on Supabase remote

-- Add 'diamante' to the enum
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'diamante';

-- Add coletivo variants to the enum
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'bronze-coletivo';
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'prata-coletivo';
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'ouro-coletivo';
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'diamante-coletivo';

-- Remove UNIQUE constraint on type column to allow multiple plan variants
ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_type_key;
