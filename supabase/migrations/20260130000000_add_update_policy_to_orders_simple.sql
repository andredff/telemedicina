-- SQL para executar no Supabase Dashboard (SQL Editor)
-- Isso adiciona uma política de UPDATE para a tabela orders

-- Adicionar política de UPDATE para usuários autenticados
-- Nota: Em produção, você deveria usar o service role key ou uma política mais restritiva

-- Primeiro, vamos verificar se já existe a política
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'orders'
        AND policyname = 'allow_authenticated_update'
    ) THEN
        CREATE POLICY "allow_authenticated_update"
        ON public.orders
        FOR UPDATE
        USING (auth.role() = 'authenticated')
        WITH CHECK (auth.role() = 'authenticated');
        
        RAISE NOTICE 'Política de UPDATE adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Política de UPDATE já existe';
    END IF;
END $$;

-- Verificar as políticas existentes
-- SELECT * FROM pg_policies WHERE tablename = 'orders';
