-- Migration: Fix payment integration issues
-- 1. Add payment_id to user_subscriptions (for webhook matching)
-- 2. Rebuild cielo_webhooks with correct columns (matching Edge Function)
-- 3. Drop unused subscriptions table (duplicate of user_subscriptions)

-- ============================================
-- 1. user_subscriptions: add payment_id column
-- ============================================

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS payment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_payment_id
  ON user_subscriptions(payment_id);

-- ============================================
-- 2. cielo_webhooks: drop and recreate with correct schema
-- ============================================

DROP TABLE IF EXISTS cielo_webhooks;

CREATE TABLE cielo_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT,
  recurrent_payment_id TEXT,
  change_type INTEGER,
  cielo_status INTEGER,
  payment_type TEXT,
  merchant_order_id TEXT,
  raw_notification JSONB,
  raw_detail JSONB,
  processed BOOLEAN DEFAULT FALSE,
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cielo_webhooks_payment_id
  ON cielo_webhooks(payment_id);
CREATE INDEX IF NOT EXISTS idx_cielo_webhooks_recurrent
  ON cielo_webhooks(recurrent_payment_id);
CREATE INDEX IF NOT EXISTS idx_cielo_webhooks_processed
  ON cielo_webhooks(processed) WHERE processed = FALSE;

-- RLS: webhook inserts come from service_role, allow all
ALTER TABLE cielo_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages cielo_webhooks" ON cielo_webhooks
  FOR ALL USING (true);

-- Trigger for updated_at (none needed — webhooks are insert-only)

-- ============================================
-- 3. Drop unused subscriptions table
-- ============================================

DROP TABLE IF EXISTS subscriptions;
