# Como adicionar a política de UPDATE para a tabela orders

## Problema
O update do status dos pedidos não está funcionando porque o RLS (Row Level Security) está bloqueando a operação.

## Solução
Execute o seguinte SQL no Dashboard do Supabase:

### Passo 1: Acesse o Dashboard do Supabase Local
1. Abra o navegador em: http://127.0.0.1:54323
2. Faça login se necessário

### Passo 2: Execute o SQL
1. Clique em "SQL Editor" no menu lateral
2. Cole o seguinte código:

```sql
-- Adicionar política de UPDATE para a tabela orders
-- Isso permite que usuários autenticados atualizem pedidos

CREATE POLICY IF NOT EXISTS "allow_authenticated_update"
ON public.orders
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Verificar se a política foi criada
SELECT * FROM pg_policies WHERE tablename = 'orders';
```

3. Clique em "Run" ou pressione Ctrl+Enter

### Passo 3: Verificar
Se aparecer uma mensagem como "CREATE POLICY" e a consulta de verificação mostrar a política, está pronto!

### Passo 4: Testar
Volte para o painel de administração e tente atualizar o status de um pedido novamente.
