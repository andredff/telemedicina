-- Add pharmacy columns to cart_items for marketplace support
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pharmacy_name TEXT;
