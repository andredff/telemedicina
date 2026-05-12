-- ============================================================
-- Remove a farmácia de seed "Farmácia Vida+" e os medicamentos
-- de catálogo vinculados a ela.
-- ============================================================

DO $$
DECLARE
  vida_id UUID;
BEGIN
  SELECT id INTO vida_id FROM public.pharmacies WHERE name = 'Farmácia Vida+' LIMIT 1;

  IF vida_id IS NULL THEN
    RAISE NOTICE 'Farmácia Vida+ não encontrada — nada a fazer.';
    RETURN;
  END IF;

  -- Apaga medicamentos do catálogo vinculados (FK é SET NULL, então removemos manualmente)
  DELETE FROM public.medication_catalog WHERE pharmacy_id = vida_id;

  -- Apaga a farmácia (cart_items.pharmacy_id também é SET NULL e pharmacy_prices CASCADE)
  DELETE FROM public.pharmacies WHERE id = vida_id;
END $$;
