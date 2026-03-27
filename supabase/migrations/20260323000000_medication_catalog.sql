-- ============================================================
-- Medication catalog + pharmacy fields extension
-- ============================================================

-- 1. Extend pharmacies with CNPJ, razão social, address, whatsapp
ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS razao_social   TEXT,
  ADD COLUMN IF NOT EXISTS cnpj           TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp       TEXT,
  ADD COLUMN IF NOT EXISTS address        TEXT,
  ADD COLUMN IF NOT EXISTS city           TEXT,
  ADD COLUMN IF NOT EXISTS state          CHAR(2),
  ADD COLUMN IF NOT EXISTS zip_code       TEXT;

-- 2. Medication catalog (independent of prescriptions)
CREATE TABLE IF NOT EXISTS medication_catalog (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  active_ingredient TEXT,
  category         TEXT,
  dosage           TEXT,
  manufacturer     TEXT,
  price            DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock            INTEGER NOT NULL DEFAULT 0,
  pharmacy_id      UUID REFERENCES pharmacies(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medication_catalog_pharmacy  ON medication_catalog(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_medication_catalog_name      ON medication_catalog(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_medication_catalog_category  ON medication_catalog(category);

-- 3. RLS
ALTER TABLE medication_catalog ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "medication_catalog_read" ON medication_catalog
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admins full access
CREATE POLICY "medication_catalog_admin" ON medication_catalog
  FOR ALL USING (public.is_admin());

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_medication_catalog_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_medication_catalog_updated_at ON medication_catalog;
CREATE TRIGGER trg_medication_catalog_updated_at
  BEFORE UPDATE ON medication_catalog
  FOR EACH ROW EXECUTE FUNCTION update_medication_catalog_updated_at();
