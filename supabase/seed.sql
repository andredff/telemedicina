-- Seed data for Novita Supabase project
-- This file is executed after migrations

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create users directly (CTE approach for compatibility)
DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
  novoadmin_id uuid := gen_random_uuid();
  doctor1_id uuid := gen_random_uuid();
  doctor2_id uuid := gen_random_uuid();
  support1_id uuid := gen_random_uuid();
  support2_id uuid := gen_random_uuid();
BEGIN
  -- Admin user (legacy)
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (admin_id, 'authenticated', 'authenticated', 'admin@novita.com', crypt('Admin123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Admin Novita"}'::jsonb, now(), now())
  ON CONFLICT DO NOTHING;

  -- Novo Admin user (primary admin account)
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (novoadmin_id, 'authenticated', 'authenticated', 'novoadmin@novita.com', crypt('Admin123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Novo Admin Novita"}'::jsonb, now(), now())
  ON CONFLICT DO NOTHING;
  
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (novoadmin_id::text, novoadmin_id, jsonb_build_object('sub', novoadmin_id::text, 'email', 'novoadmin@novita.com', 'email_verified', true), 'email', now(), now(), now())
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET full_name = 'Novo Admin Novita', role = 'admin', address = 'Av. Principal, 1001', city = 'Brasilia', state = 'DF', zip_code = '70000-000' WHERE id = novoadmin_id;
  
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (admin_id::text, admin_id, jsonb_build_object('sub', admin_id::text, 'email', 'admin@novita.com', 'email_verified', true), 'email', now(), now(), now())
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET full_name = 'Admin Novita', role = 'admin', address = 'Av. Principal, 1000', city = 'Brasilia', state = 'DF', zip_code = '70000-000' WHERE id = admin_id;

  -- Doctor 1
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (doctor1_id, 'authenticated', 'authenticated', 'doctor1@novita.com', crypt('Doctor123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dr. Carlos Silva"}'::jsonb, now(), now())
  ON CONFLICT DO NOTHING;
  
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (doctor1_id::text, doctor1_id, jsonb_build_object('sub', doctor1_id::text, 'email', 'doctor1@novita.com', 'email_verified', true), 'email', now(), now(), now())
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET full_name = 'Dr. Carlos Silva', role = 'doctor', address = 'Rua Medica, 10', city = 'Sao Paulo', state = 'SP', zip_code = '01000-000' WHERE id = doctor1_id;

  -- Doctor 2
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (doctor2_id, 'authenticated', 'authenticated', 'doctor2@novita.com', crypt('Doctor123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dra. Ana Costa"}'::jsonb, now(), now())
  ON CONFLICT DO NOTHING;
  
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (doctor2_id::text, doctor2_id, jsonb_build_object('sub', doctor2_id::text, 'email', 'doctor2@novita.com', 'email_verified', true), 'email', now(), now(), now())
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET full_name = 'Dra. Ana Costa', role = 'doctor', address = 'Rua Saude, 20', city = 'Rio de Janeiro', state = 'RJ', zip_code = '20000-000' WHERE id = doctor2_id;

  -- Support 1
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (support1_id, 'authenticated', 'authenticated', 'support1@novita.com', crypt('Support123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Suporte Novita 1"}'::jsonb, now(), now())
  ON CONFLICT DO NOTHING;
  
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (support1_id::text, support1_id, jsonb_build_object('sub', support1_id::text, 'email', 'support1@novita.com', 'email_verified', true), 'email', now(), now(), now())
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET full_name = 'Suporte Novita 1', role = 'support', address = 'Rua Ajuda, 50', city = 'Brasilia', state = 'DF', zip_code = '70010-000' WHERE id = support1_id;

  -- Support 2
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (support2_id, 'authenticated', 'authenticated', 'support2@novita.com', crypt('Support123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Suporte Novita 2"}'::jsonb, now(), now())
  ON CONFLICT DO NOTHING;
  
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (support2_id::text, support2_id, jsonb_build_object('sub', support2_id::text, 'email', 'support2@novita.com', 'email_verified', true), 'email', now(), now(), now())
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET full_name = 'Suporte Novita 2', role = 'support', address = 'Rua Ajuda, 60', city = 'Brasilia', state = 'DF', zip_code = '70020-000' WHERE id = support2_id;

END;
$$;

-- Create test patient
DO $$
DECLARE
  patient_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (patient_id, 'authenticated', 'authenticated', 'paciente@novita.com', crypt('Paciente123!', gen_salt('bf', 10)), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Paciente Teste"}'::jsonb, now(), now())
  ON CONFLICT DO NOTHING;
  
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (patient_id::text, patient_id, jsonb_build_object('sub', patient_id::text, 'email', 'paciente@novita.com', 'email_verified', true), 'email', now(), now(), now())
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles SET full_name = 'Paciente Teste', role = 'patient', address = 'Rua das Flores, 100', city = 'Brasilia', state = 'DF', zip_code = '70000-001' WHERE id = patient_id;
END;
$$;
