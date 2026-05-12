-- ============================================================
-- Seed: Create a test laboratory (master) account
-- ============================================================
-- Steps:
--   1. Go to Supabase Dashboard > Authentication > Users
--   2. Click "Add user" > "Create new user"
--   3. Email: lab@novita.com  |  Password: Lab123!
--   4. Run this SQL in the SQL Editor
-- ============================================================

DO $$
DECLARE
  lab_uid UUID;
BEGIN
  SELECT id INTO lab_uid FROM auth.users WHERE email = 'lab@novita.com' LIMIT 1;

  IF lab_uid IS NULL THEN
    RAISE NOTICE 'Lab user not found in auth.users. Create the user first in Authentication > Users.';
    RETURN;
  END IF;

  INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (lab_uid, 'lab@novita.com', 'Laboratório Novità', 'lab', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    full_name = 'Laboratório Novità',
    role = 'lab',
    updated_at = now();

  RAISE NOTICE 'Lab profile created for user %', lab_uid;
END $$;
