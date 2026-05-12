-- ============================================================
-- Cria a farmácia padrão "NOVITA" usada como pharmacy_id default
-- para os medicamentos importados no admin.
-- ============================================================

INSERT INTO public.pharmacies (
  name, razao_social, cnpj,
  phone, whatsapp, email,
  address, city, state, zip_code,
  is_premium, commission_rate, monthly_fee, active
)
VALUES (
  'NOVITA',
  'Novità Telemedicina LTDA',
  '00.000.000/0001-00',
  '(81) 0000-0000',
  '(81) 90000-0000',
  'farmacia@novitatelemedicina.com.br',
  '-', '-', 'PE', '50000-000',
  true, 0.00, 0.00, true
)
ON CONFLICT DO NOTHING;
