-- Seed data for Novita Supabase project
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Seed users (admin, doctors, support, patients)
CREATE TEMP TABLE seed_users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL,
  password text NOT NULL,
  address text,
  city text,
  state text,
  zip_code text
);

INSERT INTO seed_users (id, email, full_name, role, password, address, city, state, zip_code) VALUES
  (gen_random_uuid(), 'admin@novita.com', 'Admin Novita', 'admin', 'Admin#123', 'Av. Principal, 1000', 'Brasilia', 'DF', '70000-000'),
  (gen_random_uuid(), 'doctor1@novita.com', 'Dr. Carlos Silva', 'doctor', 'Doctor#123', 'Rua Medica, 10', 'Sao Paulo', 'SP', '01000-000'),
  (gen_random_uuid(), 'doctor2@novita.com', 'Dra. Ana Costa', 'doctor', 'Doctor#123', 'Rua Saude, 20', 'Rio de Janeiro', 'RJ', '20000-000'),
  (gen_random_uuid(), 'support1@novita.com', 'Suporte Novita 1', 'support', 'Support#123', 'Rua Ajuda, 50', 'Brasilia', 'DF', '70010-000'),
  (gen_random_uuid(), 'support2@novita.com', 'Suporte Novita 2', 'support', 'Support#123', 'Rua Ajuda, 60', 'Brasilia', 'DF', '70020-000');

INSERT INTO seed_users (id, email, full_name, role, password, address, city, state, zip_code)
SELECT
  gen_random_uuid(),
  format('paciente%02s@novita.com', gs),
  format('Paciente %02s', gs),
  'patient',
  'Paciente#123',
  format('Rua das Flores, %s', gs),
  'Brasilia',
  'DF',
  format('70%03s-000', gs)
FROM generate_series(1, 20) gs;

-- Create auth users
INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT
  id,
  'authenticated',
  'authenticated',
  email,
  crypt(password, gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name),
  now(),
  now()
FROM seed_users
ON CONFLICT (id) DO NOTHING;

-- Create identities (email)
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id::text,
  id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
FROM seed_users
ON CONFLICT (provider_id, provider) DO NOTHING;

-- Update profiles with role and address data
UPDATE public.profiles p
SET
  full_name = u.full_name,
  email = u.email,
  role = u.role,
  address = u.address,
  city = u.city,
  state = u.state,
  zip_code = u.zip_code
FROM seed_users u
WHERE p.id = u.id;

-- Subscriptions for patients
WITH patients AS (
  SELECT id, row_number() OVER (ORDER BY email) AS rn
  FROM seed_users
  WHERE role = 'patient'
),
plan_choice AS (
  SELECT
    id,
    rn,
    CASE (rn % 8)
      WHEN 0 THEN 'diamante-coletivo'
      WHEN 1 THEN 'ouro-coletivo'
      WHEN 2 THEN 'prata-coletivo'
      WHEN 3 THEN 'bronze-coletivo'
      WHEN 4 THEN 'diamante'
      WHEN 5 THEN 'ouro'
      WHEN 6 THEN 'prata'
      ELSE 'bronze'
    END AS plan_type
  FROM patients
),
plans AS (
  SELECT id, type FROM public.subscription_plans
)
INSERT INTO public.user_subscriptions (
  user_id,
  plan_id,
  status,
  billing_cycle,
  started_at,
  expires_at
)
SELECT
  pc.id,
  pl.id,
  'active',
  CASE WHEN (pc.rn % 2) = 0 THEN 'monthly' ELSE 'yearly' END,
  now() - (pc.rn || ' days')::interval,
  now() + interval '1 year'
FROM plan_choice pc
JOIN plans pl ON pl.type::text = pc.plan_type;

-- Dependents for family plans
INSERT INTO public.dependents (subscription_id, full_name, cpf, birth_date, relationship)
SELECT
  us.id,
  format('Dependente %s-%s', us.user_id::text, gs),
  lpad(((random() * 1e11)::bigint)::text, 11, '0'),
  (current_date - (365 * (10 + gs)) * interval '1 day')::date,
  CASE gs WHEN 1 THEN 'Filho(a)' ELSE 'Conjuge' END
FROM public.user_subscriptions us
JOIN public.subscription_plans sp ON sp.id = us.plan_id
JOIN generate_series(1, 2) gs ON sp.max_dependents > 0 AND gs <= sp.max_dependents;

-- Prescriptions (2 per patient)
WITH patients AS (
  SELECT id, full_name
  FROM seed_users
  WHERE role = 'patient'
),
presc AS (
  SELECT
    p.id AS user_id,
    p.full_name AS patient_name,
    gs AS seq,
    row_number() OVER (ORDER BY p.id, gs) AS global_seq
  FROM patients p
  CROSS JOIN generate_series(1, 2) gs
)
INSERT INTO public.prescriptions (
  id,
  user_id,
  patient_name,
  doctor_name,
  doctor_crm,
  date,
  status,
  created_at,
  updated_at
)
SELECT
  format('RX-2026-%04s', global_seq),
  user_id,
  patient_name,
  CASE WHEN (global_seq % 2) = 0 THEN 'Dr. Carlos Silva' ELSE 'Dra. Ana Costa' END,
  CASE WHEN (global_seq % 2) = 0 THEN 'CRM-DF 12345' ELSE 'CRM-SP 54321' END,
  (current_date - ((global_seq % 90)::int))::date,
  CASE (global_seq % 3) WHEN 0 THEN 'completed' WHEN 1 THEN 'pending' ELSE 'partial' END,
  now(),
  now()
FROM presc;

-- Medications (2 per prescription)
WITH meds AS (
  SELECT
    p.id AS prescription_id,
    row_number() OVER (PARTITION BY p.id ORDER BY gs) AS mseq
  FROM public.prescriptions p
  JOIN seed_users u ON u.id = p.user_id
  CROSS JOIN generate_series(1, 2) gs
)
INSERT INTO public.medications (
  id,
  prescription_id,
  name,
  dosage,
  frequency,
  duration,
  price,
  in_stock,
  image_url,
  created_at
)
SELECT
  format('MED-%s-%02s', prescription_id, mseq),
  prescription_id,
  CASE mseq WHEN 1 THEN 'Amoxicilina' ELSE 'Ibuprofeno' END,
  CASE mseq WHEN 1 THEN '500mg' ELSE '600mg' END,
  CASE mseq WHEN 1 THEN '8/8h' ELSE '12/12h' END,
  CASE mseq WHEN 1 THEN '7 dias' ELSE '5 dias' END,
  CASE mseq WHEN 1 THEN 49.90 ELSE 39.90 END,
  (random() > 0.1),
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=60',
  now()
FROM meds;

-- Cart items (1 per patient)
WITH first_med AS (
  SELECT
    p.user_id,
    p.id AS prescription_id,
    m.id AS medication_id,
    row_number() OVER (PARTITION BY p.user_id ORDER BY p.created_at) AS rn
  FROM public.prescriptions p
  JOIN public.medications m ON m.prescription_id = p.id
)
INSERT INTO public.cart_items (id, user_id, medication_id, prescription_id, quantity)
SELECT
  gen_random_uuid(),
  user_id,
  medication_id,
  prescription_id,
  (rn % 3) + 1
FROM first_med
WHERE rn = 1;

-- Orders (1 per patient)
WITH first_med AS (
  SELECT
    p.user_id,
    p.id AS prescription_id,
    m.id AS medication_id,
    m.name,
    m.price,
    row_number() OVER (PARTITION BY p.user_id ORDER BY p.created_at) AS rn
  FROM public.prescriptions p
  JOIN public.medications m ON m.prescription_id = p.id
),
order_base AS (
  SELECT
    fm.user_id,
    fm.prescription_id,
    fm.medication_id,
    fm.name,
    fm.price,
    pr.address,
    pr.city,
    pr.state,
    row_number() OVER (ORDER BY fm.user_id) AS seq
  FROM first_med fm
  JOIN public.profiles pr ON pr.id = fm.user_id
  WHERE fm.rn = 1
)
INSERT INTO public.orders (
  id,
  user_id,
  date,
  status,
  total,
  items,
  delivery_address,
  payment_id,
  payment_method,
  installments,
  shipping_cost,
  subtotal,
  tracking_code,
  created_at,
  updated_at
)
SELECT
  format('ORD-2026-%04s', seq),
  user_id,
  now() - (seq || ' days')::interval,
  CASE (seq % 5)
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'processing'
    WHEN 2 THEN 'shipped'
    WHEN 3 THEN 'delivered'
    ELSE 'cancelled'
  END,
  price + 12.90,
  jsonb_build_array(
    jsonb_build_object(
      'medication_id', medication_id,
      'name', name,
      'quantity', 1,
      'price', price
    )
  ),
  COALESCE(address, city || ', ' || state, 'Endereco nao informado'),
  NULL,
  CASE (seq % 3)
    WHEN 0 THEN 'pix'
    WHEN 1 THEN 'credit_card'
    ELSE 'boleto'
  END,
  CASE WHEN (seq % 3) = 1 THEN 2 ELSE 1 END,
  12.90,
  price,
  CASE WHEN (seq % 5) IN (2,3) THEN format('TRK-%04s', seq) ELSE NULL END,
  now(),
  now()
FROM order_base;

-- Order notifications
INSERT INTO public.order_notifications (
  order_id,
  customer_email,
  customer_name,
  status,
  subject,
  body,
  tracking_code,
  estimated_delivery,
  sent_at,
  created_at
)
SELECT
  o.id,
  p.email,
  p.full_name,
  o.status,
  'Atualizacao de pedido',
  format('Seu pedido %s esta com status %s.', o.id, o.status),
  o.tracking_code,
  to_char(now() + interval '3 days', 'YYYY-MM-DD'),
  now(),
  now()
FROM public.orders o
JOIN public.profiles p ON p.id = o.user_id;

COMMIT;
