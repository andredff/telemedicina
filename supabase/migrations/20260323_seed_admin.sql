-- ============================================================
-- Seed: Create a test admin account
-- ============================================================
-- Steps:
--   1. Go to Supabase Dashboard > Authentication > Users
--   2. Click "Add user" > "Create new user"
--   3. Email: admin@novita.com  |  Password: Admin123!
--   4. Run this SQL in the SQL Editor
-- ============================================================

DO $$
DECLARE
  admin_uid UUID;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'admin@novita.com' LIMIT 1;

  IF admin_uid IS NULL THEN
    RAISE NOTICE 'Admin user not found in auth.users. Create the user first in Authentication > Users.';
    RETURN;
  END IF;

  INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (admin_uid, 'admin@novita.com', 'Administrador Novità', 'admin', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    full_name = 'Administrador Novità',
    role = 'admin',
    updated_at = now();

  RAISE NOTICE 'Admin profile created for user %', admin_uid;
END $$;
