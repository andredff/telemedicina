-- Migration: alinha subscription_plans aos preços e regras do
-- "Contrato de Adesão — Plano de Telemedicina (v3)" (Tabelas I e II — promocionais).
--
-- Motivo: a tela /planos lê do catálogo estático (src/data/plansData.ts), que já
-- reflete o contrato, mas o CHECKOUT e o LIMITE de consultas com especialista vêm
-- do banco (subscription_plans), que estava com valores antigos do seed de jan/2026.
-- Esta migration torna o banco a mesma fonte de verdade do contrato v3.
--
-- price_yearly = price_monthly × 12 × 0,90 (desconto anual de 10%).
-- includes_checkup é booleano no schema (contagem por ano fica nas features).

-- ── INDIVIDUAIS ────────────────────────────────────────────────────────────

UPDATE public.subscription_plans SET
  price_monthly = 29.90,
  price_yearly  = 322.92,
  specialist_consultations_per_year = 0,
  includes_checkup = false,
  max_dependents = 0
WHERE type = 'bronze';

UPDATE public.subscription_plans SET
  price_monthly = 49.90,
  price_yearly  = 538.92,
  specialist_consultations_per_year = 1,
  includes_checkup = false,
  max_dependents = 0
WHERE type = 'prata';

UPDATE public.subscription_plans SET
  price_monthly = 69.90,
  price_yearly  = 754.92,
  specialist_consultations_per_year = 1,
  includes_checkup = true,
  max_dependents = 0,
  features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "1 consulta com médico especialista por ano", "1 check-up anual (sorologia)"]'::jsonb
WHERE type = 'ouro';

UPDATE public.subscription_plans SET
  price_monthly = 89.90,
  price_yearly  = 970.92,
  specialist_consultations_per_year = 2,
  includes_checkup = true,
  max_dependents = 0,
  features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "2 consultas com médico especialista por ano", "1 check-up anual (sorologia)"]'::jsonb
WHERE type = 'diamante';

-- ── COLETIVOS (até 3 vidas) ──────────────────────────────────────────────────

UPDATE public.subscription_plans SET
  price_monthly = 79.90,
  price_yearly  = 862.92,
  specialist_consultations_per_year = 0,
  includes_checkup = false,
  max_dependents = 2
WHERE type = 'bronze-coletivo';

UPDATE public.subscription_plans SET
  price_monthly = 139.90,
  price_yearly  = 1510.92,
  specialist_consultations_per_year = 2,
  includes_checkup = false,
  max_dependents = 2,
  features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "Até 3 beneficiários (titular + 2 dependentes)", "2 consultas com médico especialista por ano"]'::jsonb
WHERE type = 'prata-coletivo';

UPDATE public.subscription_plans SET
  price_monthly = 199.90,
  price_yearly  = 2158.92,
  specialist_consultations_per_year = 2,
  includes_checkup = true,
  max_dependents = 2,
  features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "Até 3 beneficiários (titular + 2 dependentes)", "2 consultas com médico especialista por ano", "2 check-ups anuais (sorologia)"]'::jsonb
WHERE type = 'ouro-coletivo';

UPDATE public.subscription_plans SET
  price_monthly = 259.90,
  price_yearly  = 2806.92,
  specialist_consultations_per_year = 4,
  includes_checkup = true,
  max_dependents = 2,
  features = '["Consultas ilimitadas com clínico geral, sem agendamento", "Atendimento 24h por dia, 7 dias por semana", "Receitas e atestados médicos digitais com validade CFM", "Descontos em medicamentos", "Programa Medicamento em Casa (DF e entorno)", "Até 3 beneficiários (titular + 2 dependentes)", "4 consultas com médico especialista por ano", "2 check-ups anuais (sorologia)"]'::jsonb
WHERE type = 'diamante-coletivo';
