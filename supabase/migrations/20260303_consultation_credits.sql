-- Tabela para créditos de consultas avulsas
-- Usuários sem plano podem comprar consultas individuais

CREATE TABLE IF NOT EXISTS consultation_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('clinico_geral', 'especialista')),
  amount DECIMAL(10,2) NOT NULL,
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired', 'refunded')),
  consultation_id INTEGER, -- ID da consulta criada quando usado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '6 months')
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_consultation_credits_user_id ON consultation_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_consultation_credits_status ON consultation_credits(status);
CREATE INDEX IF NOT EXISTS idx_consultation_credits_user_status ON consultation_credits(user_id, status);

-- RLS (Row Level Security)
ALTER TABLE consultation_credits ENABLE ROW LEVEL SECURITY;

-- Políticas: usuário pode ver apenas seus próprios créditos
CREATE POLICY "Users can view own credits"
  ON consultation_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Políticas: usuário pode inserir seus próprios créditos (via checkout)
CREATE POLICY "Users can insert own credits"
  ON consultation_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Políticas: usuário pode atualizar seus próprios créditos (marcar como usado)
CREATE POLICY "Users can update own credits"
  ON consultation_credits FOR UPDATE
  USING (auth.uid() = user_id);

-- Comentários
COMMENT ON TABLE consultation_credits IS 'Créditos de consultas avulsas comprados por usuários sem plano';
COMMENT ON COLUMN consultation_credits.type IS 'Tipo: clinico_geral (R$59,90) ou especialista (R$119,90)';
COMMENT ON COLUMN consultation_credits.status IS 'Status: available (pode usar), used (já usou), expired (expirou), refunded (reembolsado)';
COMMENT ON COLUMN consultation_credits.consultation_id IS 'ID do atendimento na API Assemed quando o crédito for usado';
