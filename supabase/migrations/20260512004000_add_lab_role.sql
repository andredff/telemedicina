-- Add 'lab' to the allowed roles in profiles.role check constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'doctor', 'patient', 'support', 'lab'));
