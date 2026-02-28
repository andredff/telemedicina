-- Migration: Create payment-related tables for Cielo integration
-- Execute in Supabase SQL Editor

-- Table: payment_logs
-- Stores all payment attempts for auditing
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('credit_card', 'recurrent', 'pix', 'boleto')),
  payment_id TEXT,
  amount BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'refunded', 'cancelled')),
  cielo_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by order_id
CREATE INDEX IF NOT EXISTS idx_payment_logs_order_id ON payment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_id ON payment_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_status ON payment_logs(status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON payment_logs(created_at DESC);

-- Table: cielo_webhooks
-- Stores webhook notifications from Cielo
CREATE TABLE IF NOT EXISTS cielo_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT,
  payment_id TEXT NOT NULL,
  recurrent_payment_id TEXT,
  old_status TEXT,
  new_status TEXT,
  status INTEGER,
  return_code TEXT,
  return_message TEXT,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for webhook processing
CREATE INDEX IF NOT EXISTS idx_cielo_webhooks_payment_id ON cielo_webhooks(payment_id);
CREATE INDEX IF NOT EXISTS idx_cielo_webhooks_recurrent ON cielo_webhooks(recurrent_payment_id);
CREATE INDEX IF NOT EXISTS idx_cielo_webhooks_processed ON cielo_webhooks(processed) WHERE processed = FALSE;

-- Table: saved_cards
-- Stores tokenized card information (Cielo CardToken)
CREATE TABLE IF NOT EXISTS saved_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_token TEXT NOT NULL,
  card_brand TEXT,
  card_last_four TEXT NOT NULL,
  card_holder_name TEXT,
  card_expiration_date TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for saved cards
CREATE INDEX IF NOT EXISTS idx_saved_cards_user_id ON saved_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_cards_token ON saved_cards(card_token);

-- Unique constraint to prevent duplicate cards
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_cards_user_token 
ON saved_cards(user_id, card_token) WHERE card_token IS NOT NULL;

-- Table: subscriptions
-- Stores subscription/recurrence information
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  plan_id UUID,
  recurrent_payment_id TEXT NOT NULL,
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  interval TEXT NOT NULL CHECK (interval IN ('Monthly', 'Bimonthly', 'Quarterly', 'SemiAnnual', 'Annual')),
  amount BIGINT NOT NULL,
  current_period_start DATE,
  current_period_end DATE,
  next_payment_date DATE,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_recurrent ON subscriptions(recurrent_payment_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment ON subscriptions(next_payment_date);

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_payment_logs_updated_at
  BEFORE UPDATE ON payment_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cielo_webhooks_updated_at
  BEFORE UPDATE ON cielo_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_cards_updated_at
  BEFORE UPDATE ON saved_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all new tables
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cielo_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for payment_logs
CREATE POLICY "Users can view their own payment logs" ON payment_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = payment_logs.order_id AND orders.user_id = auth.uid()
    )
  );

-- Policies for cielo_webhooks
CREATE POLICY "System can manage cielo_webhooks" ON cielo_webhooks
  FOR ALL USING (true);

-- Policies for saved_cards
CREATE POLICY "Users can view their own saved cards" ON saved_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved cards" ON saved_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved cards" ON saved_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved cards" ON saved_cards
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for subscriptions
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to update order payment status
CREATE OR REPLACE FUNCTION update_order_payment_status(
  p_order_id TEXT,
  p_payment_id TEXT,
  p_status TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET 
    payment_id = p_payment_id,
    payment_status = p_status,
    updated_at = NOW()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on tables
COMMENT ON TABLE payment_logs IS 'Audit log for all payment attempts';
COMMENT ON TABLE cielo_webhooks IS 'Stores webhook notifications from Cielo payment gateway';
COMMENT ON TABLE saved_cards IS 'Stores tokenized card information for returning customers';
COMMENT ON TABLE subscriptions IS 'Stores subscription/recurrence information for recurring payments';
