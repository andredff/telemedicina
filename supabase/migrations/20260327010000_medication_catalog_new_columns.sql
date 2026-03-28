-- Add new columns to medication_catalog to support the required Excel import model
ALTER TABLE medication_catalog
  ADD COLUMN IF NOT EXISTS external_id   text,
  ADD COLUMN IF NOT EXISTS form          text,        -- Forma Farmacêutica
  ADD COLUMN IF NOT EXISTS batch         text,        -- Lote
  ADD COLUMN IF NOT EXISTS expiry_date   date,        -- Validade
  ADD COLUMN IF NOT EXISTS supplier      text;        -- Fornecedor

-- Unique constraint used for upsert deduplication (nome + dosagem)
ALTER TABLE medication_catalog
  DROP CONSTRAINT IF EXISTS medication_catalog_name_dosage_key;

ALTER TABLE medication_catalog
  ADD CONSTRAINT medication_catalog_name_dosage_key UNIQUE (name, dosage);
