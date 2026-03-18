-- ============================================================
-- SEED: Farmácias parceiras + preços + receita de teste
-- ============================================================

-- 1. Farmácias parceiras
INSERT INTO pharmacies (id, name, logo_url, is_premium, commission_rate, monthly_fee, phone, email, active)
VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'Droga Raia',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Droga_Raia_logo.svg/320px-Droga_Raia_logo.svg.png',
    true, 12.00, 299.00, '(11) 3003-1234', 'parceiros@drogaraia.com.br', true
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'Farmácia Pague Menos',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Pague_Menos_logo.svg/320px-Pague_Menos_logo.svg.png',
    true, 14.00, 199.00, '(85) 3003-5678', 'parceiros@paguemenos.com.br', true
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'Ultrafarma',
    NULL,
    false, 18.00, 0.00, '(11) 3003-9999', 'parceiros@ultrafarma.com.br', true
  )
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de preços para Dipirona e outros medicamentos comuns
INSERT INTO pharmacy_prices (pharmacy_id, medication_name, price, delivery_days, in_stock)
VALUES
  -- Droga Raia
  ('a1000000-0000-0000-0000-000000000001', 'Dipirona sódica 500mg',  12.90, 1, true),
  ('a1000000-0000-0000-0000-000000000001', 'Ibuprofeno 400mg',        9.90, 1, true),
  ('a1000000-0000-0000-0000-000000000001', 'Amoxicilina 500mg',      28.50, 2, true),
  ('a1000000-0000-0000-0000-000000000001', 'Paracetamol 500mg',       7.90, 1, true),
  ('a1000000-0000-0000-0000-000000000001', 'Omeprazol 20mg',         14.90, 2, true),

  -- Pague Menos
  ('a1000000-0000-0000-0000-000000000002', 'Dipirona sódica 500mg',  10.50, 2, true),
  ('a1000000-0000-0000-0000-000000000002', 'Ibuprofeno 400mg',        8.70, 2, true),
  ('a1000000-0000-0000-0000-000000000002', 'Amoxicilina 500mg',      25.90, 3, true),
  ('a1000000-0000-0000-0000-000000000002', 'Paracetamol 500mg',       6.50, 2, true),
  ('a1000000-0000-0000-0000-000000000002', 'Omeprazol 20mg',         12.40, 2, false),

  -- Ultrafarma
  ('a1000000-0000-0000-0000-000000000003', 'Dipirona sódica 500mg',   8.90, 3, true),
  ('a1000000-0000-0000-0000-000000000003', 'Ibuprofeno 400mg',        7.20, 3, true),
  ('a1000000-0000-0000-0000-000000000003', 'Amoxicilina 500mg',      22.00, 4, true),
  ('a1000000-0000-0000-0000-000000000003', 'Paracetamol 500mg',       5.90, 3, true),
  ('a1000000-0000-0000-0000-000000000003', 'Omeprazol 20mg',         11.00, 3, true)
ON CONFLICT DO NOTHING;

-- 3. Receita de teste vinculada ao primeiro usuário cadastrado
-- (substitua o user_id se quiser usar um usuário específico)
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Nenhum usuário encontrado. Crie uma conta e rode novamente.';
    RETURN;
  END IF;

  INSERT INTO prescriptions (id, user_id, patient_name, doctor_name, doctor_crm, date, status)
  VALUES (
    'RX-DEMO-2026-001',
    v_user_id,
    'Lucas Santos',
    'Dra. Ana Paula Costa',
    'CRM-SP 87654',
    CURRENT_DATE,
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO medications (id, prescription_id, name, dosage, frequency, duration, price, in_stock)
  VALUES
    ('MED-DEMO-001', 'RX-DEMO-2026-001', 'Dipirona sódica 500mg',  '500mg',  '1 comprimido a cada 6h se dor ou febre', '5 dias',  0, true),
    ('MED-DEMO-002', 'RX-DEMO-2026-001', 'Ibuprofeno 400mg',        '400mg',  '1 comprimido a cada 8h após refeição',  '3 dias',  0, true),
    ('MED-DEMO-003', 'RX-DEMO-2026-001', 'Omeprazol 20mg',          '20mg',   '1 cápsula em jejum pela manhã',          '30 dias', 0, true)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Receita RX-DEMO-2026-001 criada para o usuário %', v_user_id;
END $$;
