-- Criar tabela de notificações de pedidos
CREATE TABLE IF NOT EXISTS public.order_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    status TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    tracking_code TEXT,
    estimated_delivery TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.order_notifications ENABLE ROW LEVEL SECURITY;

-- Policy para permitir que o admin leia todas as notificações
CREATE POLICY "Admin can view all notifications"
    ON public.order_notifications
    FOR SELECT
    USING (true);

-- Policy para permitir que o admin insira notificações
CREATE POLICY "Admin can insert notifications"
    ON public.order_notifications
    FOR INSERT
    WITH CHECK (true);

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_order_notifications_order_id
    ON public.order_notifications(order_id);

CREATE INDEX IF NOT EXISTS idx_order_notifications_sent_at
    ON public.order_notifications(sent_at DESC);
