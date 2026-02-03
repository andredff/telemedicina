-- Add role column to profiles for RBAC
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'patient';

-- Backfill any existing rows
UPDATE public.profiles
SET role = 'patient'
WHERE role IS NULL;

-- Optional role constraint
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'doctor', 'patient', 'support'));
