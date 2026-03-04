-- Add birth_date column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;

-- Add optional gender column as well (useful for Assemed integration)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('M', 'F'));

-- Add optional phone column (may already exist in user_metadata)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Add optional cpf column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text;

-- Grant permission to auth trigger
GRANT INSERT ON public.profiles TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Update the handle_new_user trigger to copy all fields from user_metadata
-- SECURITY DEFINER allows the function to bypass RLS when creating the profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, cpf, phone, birth_date, gender)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    new.email,
    new.raw_user_meta_data->>'cpf',
    new.raw_user_meta_data->>'phone',
    CASE 
      WHEN new.raw_user_meta_data->>'birth_date' IS NOT NULL 
           AND new.raw_user_meta_data->>'birth_date' != '' 
      THEN (new.raw_user_meta_data->>'birth_date')::date 
      ELSE NULL 
    END,
    new.raw_user_meta_data->>'gender'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql;
