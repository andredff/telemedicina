-- Migration: Add diamante enum and update subscription plans
-- Execute this in your Supabase SQL Editor: https://supabase.com/dashboard/project/wtedhqhqducvwadjjgii/sql/new

-- Step 1: Add new enum values
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'diamante';
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'bronze-coletivo';
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'prata-coletivo';
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'ouro-coletivo';
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'diamante-coletivo';

-- Step 2: Remove UNIQUE constraint on type column
ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_type_key;

-- Step 3: Update existing plans
UPDATE public.subscription_plans
SET description = 'Consultas médicas ilimitadas',
    price_monthly = 29.90,
    price_yearly = 322.92,
    specialist_consultations_per_year = 0,
    includes_checkup = false,
    max_dependents = 0,
    features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)"]'::jsonb
WHERE type = 'bronze';

UPDATE public.subscription_plans
SET description = 'Consulta garantida com especialista',
    price_monthly = 49.90,
    price_yearly = 538.92,
    specialist_consultations_per_year = 1,
    includes_checkup = false,
    max_dependents = 0,
    features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "1 consulta com médico especialista por ano"]'::jsonb
WHERE type = 'prata';

UPDATE public.subscription_plans
SET description = 'Maiores cuidados em saúde',
    price_monthly = 79.90,
    price_yearly = 862.92,
    specialist_consultations_per_year = 2,
    includes_checkup = true,
    max_dependents = 0,
    features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "2 consultas com médico especialista por ano", "1 check-up anual (sorologia)"]'::jsonb
WHERE type = 'ouro';

-- Step 4: Convert platina to diamante
UPDATE public.subscription_plans
SET name = 'Diamante',
    type = 'diamante',
    description = 'Melhor e mais avançado controle da saúde',
    price_monthly = 99.90,
    price_yearly = 1078.92,
    specialist_consultations_per_year = 4,
    includes_checkup = true,
    max_dependents = 0,
    features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "4 consultas com médico especialista por ano", "1 check-up anual (sorologia)"]'::jsonb
WHERE type = 'platina';

-- Step 5: Update coletivo to Bronze Familiar
UPDATE public.subscription_plans
SET name = 'Bronze Familiar',
    type = 'bronze-coletivo',
    description = 'Consultas médicas ilimitadas para toda a família',
    price_monthly = 79.90,
    price_yearly = 862.92,
    specialist_consultations_per_year = 0,
    includes_checkup = false,
    max_dependents = 2,
    features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "Até 3 beneficiários (titular + 2 dependentes)"]'::jsonb
WHERE type = 'coletivo';

-- Step 6: Insert new family plans
INSERT INTO public.subscription_plans (name, type, description, price_monthly, price_yearly, specialist_consultations_per_year, includes_checkup, max_dependents, features)
VALUES
  ('Prata Familiar', 'prata-coletivo', 'Consultas com especialista para toda a família', 109.90, 1186.92, 2, false, 2,
   '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "Até 3 beneficiários (titular + 2 dependentes)", "2 consultas com médico especialista por ano"]'::jsonb),
  ('Ouro Familiar', 'ouro-coletivo', 'Maiores cuidados em saúde para toda a família', 159.90, 1726.92, 4, true, 2,
   '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "Até 3 beneficiários (titular + 2 dependentes)", "4 consultas com médico especialista por ano", "2 check-ups anuais (sorologia)"]'::jsonb),
  ('Diamante Familiar', 'diamante-coletivo', 'O melhor plano para toda a família', 199.90, 2158.92, 6, true, 2,
   '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "Até 3 beneficiários (titular + 2 dependentes)", "6 consultas com médico especialista por ano", "2 check-ups anuais (sorologia)"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Step 7: Orders persistence & logistics tracking
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name text,
  customer_email text,
  customer_phone text,
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  shipping numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text,
  payment_status text,
  payment_id text,
  pix_qr_code text,
  pix_qr_code_url text,
  pix_expires_at timestamptz,
  delivery_address text,
  tracking_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  medication_id text,
  prescription_id text,
  name text NOT NULL,
  dosage text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items(order_id);

CREATE TABLE IF NOT EXISTS public.order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_email text,
  customer_name text,
  status public.order_status NOT NULL,
  subject text,
  body text,
  sent_at timestamptz,
  tracking_code text,
  estimated_delivery text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_notifications_order_id_idx ON public.order_notifications(order_id);

CREATE TABLE IF NOT EXISTS public.logistics_service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_name text,
  customer_email text,
  customer_phone text,
  delivery_address text,
  items jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS logistics_service_orders_order_id_idx ON public.logistics_service_orders(order_id);
