-- =================================================================
-- MIGRAÇÃO PARA CRIAR TABELA ORDERS (Executar no Supabase Dashboard)
-- =================================================================
-- Acesse: https://supabase.com/dashboard/project/wtedhqhqducvwadjjgii/sql/new
-- =================================================================

-- Create orders table for medication orders
CREATE TABLE public.orders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('processing', 'confirmed', 'in_transit', 'delivered', 'cancelled')),
  total DECIMAL(10, 2) NOT NULL,
  items JSONB NOT NULL,
  delivery_address TEXT NOT NULL,
  payment_id TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('credit_card', 'pix', 'boleto')),
  installments INTEGER DEFAULT 1,
  shipping_cost DECIMAL(10, 2) DEFAULT 0,
  subtotal DECIMAL(10, 2) NOT NULL,
  tracking_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_date ON public.orders(date DESC);
CREATE INDEX idx_orders_status ON public.orders(status);

-- Add trigger for updated_at (if the function exists)
-- CREATE TRIGGER update_orders_updated_at
--   BEFORE UPDATE ON public.orders
--   FOR EACH ROW
--   EXECUTE FUNCTION public.update_updated_at_column();

-- Create order_notifications table for logistics
CREATE TABLE public.order_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on order_notifications
ALTER TABLE public.order_notifications ENABLE ROW LEVEL SECURITY;

-- Admin-only access to notifications
CREATE POLICY "Admin can view all order notifications"
  ON public.order_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.email LIKE '%@novita.com.br'
    )
  );

-- Verify the table was created
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders';
