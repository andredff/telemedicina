-- ============================================================
-- Seed: Create a test attendant (triagem) account
-- ============================================================
-- Steps:
--   1. Go to Supabase Dashboard > Authentication > Users
--   2. Click "Add user" > "Create new user"
--   3. Email: atendente@novita.com  |  Password: Atendente123!
--      (check "Auto Confirm User" so it can log in immediately)
--   4. Run this SQL in the SQL Editor
--   5. Log in and open /atendente
-- ============================================================

DO $$
DECLARE
  att_uid UUID;
BEGIN
  SELECT id INTO att_uid FROM auth.users WHERE email = 'atendente@novita.com' LIMIT 1;

  IF att_uid IS NULL THEN
    RAISE NOTICE 'Attendant user not found in auth.users. Create the user first in Authentication > Users.';
    RETURN;
  END IF;

  INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (att_uid, 'atendente@novita.com', 'Atendente Novità', 'attendant', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    full_name = 'Atendente Novità',
    role = 'attendant',
    updated_at = now();

  RAISE NOTICE 'Attendant profile created for user %', att_uid;
END $$;
