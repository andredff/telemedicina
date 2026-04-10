-- Corrige os valores de specialist_consultations_per_year para corresponder às features dos planos

-- Planos Individuais
UPDATE subscription_plans SET specialist_consultations_per_year = 0 WHERE type = 'bronze';
UPDATE subscription_plans SET specialist_consultations_per_year = 1 WHERE type = 'prata';
UPDATE subscription_plans SET specialist_consultations_per_year = 2 WHERE type = 'ouro';
UPDATE subscription_plans SET specialist_consultations_per_year = 4 WHERE type = 'diamante';

-- Planos Coletivos/Familiares
UPDATE subscription_plans SET specialist_consultations_per_year = 0 WHERE type = 'bronze-coletivo';
UPDATE subscription_plans SET specialist_consultations_per_year = 4 WHERE type = 'prata-coletivo';
UPDATE subscription_plans SET specialist_consultations_per_year = 6 WHERE type = 'ouro-coletivo';
UPDATE subscription_plans SET specialist_consultations_per_year = 8 WHERE type = 'diamante-coletivo';

-- Adiciona coluna specialist_consultations_used se não existir em user_subscriptions
-- (já deve existir conforme os tipos, mas garantindo)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'specialist_consultations_used'
    ) THEN
        ALTER TABLE user_subscriptions ADD COLUMN specialist_consultations_used INTEGER DEFAULT 0;
    END IF;
END $$;

-- Comentários para documentação
COMMENT ON COLUMN subscription_plans.specialist_consultations_per_year IS 'Número de consultas com especialista incluídas no plano por ano';
COMMENT ON COLUMN user_subscriptions.specialist_consultations_used IS 'Número de consultas com especialista já utilizadas no período atual';
