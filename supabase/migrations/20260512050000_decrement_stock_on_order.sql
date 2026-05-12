-- ============================================================
-- Decremento automático de estoque em medication_catalog quando
-- um pedido (orders) é criado. Casa pelo nome (case-insensitive),
-- usando a primeira correspondência em medication_catalog.
-- ============================================================
-- Limitação conhecida: orders.items[].name é o único campo de
-- ligação atualmente. Se houver homônimos no catálogo, o item de
-- menor id é debitado. Para precisão total, incluir medication_id
-- no JSON do item futuramente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.decrement_medication_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item        JSONB;
  item_name   TEXT;
  item_qty    INTEGER;
  target_id   UUID;
BEGIN
  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    item_name := NULLIF(TRIM(item->>'name'), '');
    item_qty  := COALESCE((item->>'quantity')::INTEGER, 1);

    IF item_name IS NULL OR item_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id INTO target_id
    FROM public.medication_catalog
    WHERE LOWER(name) = LOWER(item_name)
    ORDER BY created_at ASC
    LIMIT 1;

    IF target_id IS NOT NULL THEN
      UPDATE public.medication_catalog
         SET stock = GREATEST(0, COALESCE(stock, 0) - item_qty),
             updated_at = now()
       WHERE id = target_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_medication_stock ON public.orders;

CREATE TRIGGER trg_decrement_medication_stock
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.decrement_medication_stock_on_order();
