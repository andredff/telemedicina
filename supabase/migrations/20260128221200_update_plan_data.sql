-- Migration: Update plan data (Step 2 of 2)
-- This runs after the enum values have been added

-- Update existing plans
UPDATE public.subscription_plans
SET
  description = 'Consultas médicas ilimitadas',
  price_monthly = 29.90,
  price_yearly = 322.92,
  specialist_consultations_per_year = 0,
  includes_checkup = false,
  max_dependents = 0,
  features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)"]'::jsonb
WHERE type = 'bronze';

UPDATE public.subscription_plans
SET
  description = 'Consulta garantida com especialista',
  price_monthly = 49.90,
  price_yearly = 538.92,
  specialist_consultations_per_year = 1,
  includes_checkup = false,
  max_dependents = 0,
  features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "1 consulta com médico especialista por ano"]'::jsonb
WHERE type = 'prata';

UPDATE public.subscription_plans
SET
  description = 'Maiores cuidados em saúde',
  price_monthly = 79.90,
  price_yearly = 862.92,
  specialist_consultations_per_year = 2,
  includes_checkup = true,
  max_dependents = 0,
  features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "2 consultas com médico especialista por ano", "1 check-up anual (sorologia)"]'::jsonb
WHERE type = 'ouro';

-- Convert platina to diamante (individual)
UPDATE public.subscription_plans
SET
  name = 'Diamante',
  type = 'diamante',
  description = 'Melhor e mais avançado controle da saúde',
  price_monthly = 99.90,
  price_yearly = 1078.92,
  specialist_consultations_per_year = 4,
  includes_checkup = true,
  max_dependents = 0,
  features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "4 consultas com médico especialista por ano", "1 check-up anual (sorologia)"]'::jsonb
WHERE type = 'platina';

-- Update coletivo plan to Bronze Familiar
UPDATE public.subscription_plans
SET
  name = 'Bronze Familiar',
  type = 'bronze-coletivo',
  description = 'Consultas médicas ilimitadas para toda a família',
  price_monthly = 79.90,
  price_yearly = 862.92,
  specialist_consultations_per_year = 0,
  includes_checkup = false,
  max_dependents = 2,
  features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "Até 3 beneficiários (titular + 2 dependentes)"]'::jsonb
WHERE type = 'coletivo';

-- Insert new Coletivo/Family plans
INSERT INTO public.subscription_plans (name, type, description, price_monthly, price_yearly, specialist_consultations_per_year, includes_checkup, max_dependents, features)
VALUES
  ('Prata Familiar', 'prata-coletivo', 'Consultas com especialista para toda a família', 109.90, 1186.92, 2, false, 2,
   '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "Até 3 beneficiários (titular + 2 dependentes)", "2 consultas com médico especialista por ano"]'::jsonb),

  ('Ouro Familiar', 'ouro-coletivo', 'Maiores cuidados em saúde para toda a família', 159.90, 1726.92, 4, true, 2,
   '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "Até 3 beneficiários (titular + 2 dependentes)", "4 consultas com médico especialista por ano", "2 check-ups anuais (sorologia)"]'::jsonb),

  ('Diamante Familiar', 'diamante-coletivo', 'O melhor plano para toda a família', 199.90, 2158.92, 6, true, 2,
   '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "Até 3 beneficiários (titular + 2 dependentes)", "6 consultas com médico especialista por ano", "2 check-ups anuais (sorologia)"]'::jsonb)
ON CONFLICT DO NOTHING;
