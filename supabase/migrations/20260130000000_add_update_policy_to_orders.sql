-- Add UPDATE policy for orders table (admin access)
-- This allows admins to update order status

-- Enable service role key bypass for admin operations
-- Note: For full admin functionality, we need to use the service role key
-- which bypasses RLS policies

-- Alternative: Add a policy for authenticated users to update orders
-- This is less secure but allows the admin panel to work
CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
