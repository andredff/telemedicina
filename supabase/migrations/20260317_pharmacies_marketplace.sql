-- ============================================================
-- MARKETPLACE DE FARMÁCIAS
-- ============================================================

-- Tabela de farmácias parceiras
CREATE TABLE IF NOT EXISTS pharmacies (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  logo_url    TEXT,
  is_premium  BOOLEAN NOT NULL DEFAULT false,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  phone       TEXT,
  email       TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de preços por farmácia × medicamento
CREATE TABLE IF NOT EXISTS pharmacy_prices (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id   UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  delivery_days INTEGER NOT NULL DEFAULT 2,
  in_stock      BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_prices_pharmacy_id ON pharmacy_prices(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_prices_med_name ON pharmacy_prices(LOWER(medication_name));

-- Adiciona colunas de farmácia na tabela de pedidos
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pharmacy_id   UUID REFERENCES pharmacies(id),
  ADD COLUMN IF NOT EXISTS pharmacy_name TEXT,
  ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS pharmacy_amount DECIMAL(10,2);

-- RLS
ALTER TABLE pharmacies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_prices ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler farmácias ativas
CREATE POLICY "Leitura pública de farmácias ativas"
  ON pharmacies FOR SELECT
  USING (active = true);

-- Admin tem controle total em farmácias
CREATE POLICY "Admin gerencia farmácias"
  ON pharmacies FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Qualquer usuário pode ler preços
CREATE POLICY "Leitura pública de preços"
  ON pharmacy_prices FOR SELECT
  USING (true);

-- Admin tem controle total em preços
CREATE POLICY "Admin gerencia preços"
  ON pharmacy_prices FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
