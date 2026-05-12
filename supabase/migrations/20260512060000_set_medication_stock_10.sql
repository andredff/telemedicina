-- ============================================================
-- Define estoque = 10 para todos os medicamentos do catálogo.
-- ============================================================

UPDATE public.medication_catalog
   SET stock = 10,
       updated_at = now();
