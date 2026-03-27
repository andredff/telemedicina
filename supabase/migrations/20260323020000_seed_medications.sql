-- ============================================================
-- Seed: Farmácia de teste + medicamentos para demonstração
-- ============================================================

DO $$
DECLARE
  pharmacy_id UUID;
BEGIN
  -- 1. Inserir farmácia de teste
  INSERT INTO pharmacies (
    name, razao_social, cnpj,
    phone, whatsapp, email,
    address, city, state, zip_code,
    is_premium, commission_rate, monthly_fee, active
  )
  VALUES (
    'Farmácia Vida+',
    'Farmácia Vida Mais LTDA',
    '12.345.678/0001-90',
    '(81) 3333-4444',
    '(81) 99999-8888',
    'contato@farmaciavida.com.br',
    'Rua do Hospício, 123 – Centro',
    'Recife', 'PE', '50050-050',
    true, 12.00, 299.00, true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO pharmacy_id;

  -- Se já existia, buscar o id
  IF pharmacy_id IS NULL THEN
    SELECT id INTO pharmacy_id FROM pharmacies WHERE name = 'Farmácia Vida+' LIMIT 1;
  END IF;

  IF pharmacy_id IS NULL THEN
    RAISE NOTICE 'Não foi possível criar/encontrar a farmácia.';
    RETURN;
  END IF;

  -- 2. Inserir medicamentos
  INSERT INTO medication_catalog
    (name, active_ingredient, category, dosage, manufacturer, price, stock, pharmacy_id)
  VALUES
    ('Dipirona 500mg',       'Dipirona Sódica',         'Analgésico',       '500mg comprimido',   'EMS',            8.90,  120, pharmacy_id),
    ('Dipirona Gotas 500mg', 'Dipirona Sódica',         'Analgésico',       '500mg/ml 20ml',      'Medley',        12.50,   80, pharmacy_id),
    ('Amoxicilina 500mg',    'Amoxicilina',             'Antibiótico',      '500mg cápsula',      'Teuto',         22.50,   60, pharmacy_id),
    ('Ibuprofeno 400mg',     'Ibuprofeno',              'Anti-inflamatório','400mg comprimido',   'Eurofarma',     15.00,   80, pharmacy_id),
    ('Paracetamol 500mg',    'Paracetamol',             'Analgésico',       '500mg comprimido',   'EMS',            6.90,  200, pharmacy_id),
    ('Losartana 50mg',       'Losartana Potássica',     'Anti-hipertensivo','50mg comprimido',    'Sandoz',        18.00,   90, pharmacy_id),
    ('Omeprazol 20mg',       'Omeprazol',               'Antiácido',        '20mg cápsula',       'Medley',        14.00,  110, pharmacy_id),
    ('Azitromicina 500mg',   'Azitromicina',            'Antibiótico',      '500mg comprimido',   'EMS',           28.90,   45, pharmacy_id),
    ('Metformina 850mg',     'Cloridrato de Metformina','Antidiabético',    '850mg comprimido',   'Germed',        12.00,   75, pharmacy_id),
    ('Atorvastatina 20mg',   'Atorvastatina Cálcica',   'Hipolipemiante',   '20mg comprimido',    'Eurofarma',     22.00,   55, pharmacy_id),
    ('Simeticona 40mg',      'Simeticona',              'Antiflatulento',   '40mg comprimido',    'EMS',            9.50,  130, pharmacy_id),
    ('Vitamina C 1g',        'Ácido Ascórbico',         'Suplemento',       '1g efervescente',    'Bayer',         18.90,   95, pharmacy_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed concluído: farmácia % com 12 medicamentos.', pharmacy_id;
END $$;
