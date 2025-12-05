-- Create enum for subscription plan types
CREATE TYPE public.subscription_plan_type AS ENUM ('bronze', 'prata', 'ouro', 'platina', 'coletivo');

-- Create enum for subscription status
CREATE TYPE public.subscription_status AS ENUM ('active', 'inactive', 'cancelled', 'pending');

-- Create subscription_plans table (predefined plans)
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type subscription_plan_type NOT NULL UNIQUE,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2),
  specialist_consultations_per_year INTEGER DEFAULT 0,
  includes_checkup BOOLEAN DEFAULT false,
  max_dependents INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'pending',
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  started_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  specialist_consultations_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create dependents table for family plans
CREATE TABLE public.dependents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.user_subscriptions(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  birth_date DATE NOT NULL,
  relationship TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscription_plans (public read)
CREATE POLICY "Anyone can view active subscription plans"
ON public.subscription_plans
FOR SELECT
USING (is_active = true);

-- RLS policies for user_subscriptions
CREATE POLICY "Users can view their own subscription"
ON public.user_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
ON public.user_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for dependents
CREATE POLICY "Users can view their dependents"
ON public.dependents
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_subscriptions
  WHERE user_subscriptions.id = dependents.subscription_id
  AND user_subscriptions.user_id = auth.uid()
));

CREATE POLICY "Users can insert dependents"
ON public.dependents
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_subscriptions
  WHERE user_subscriptions.id = dependents.subscription_id
  AND user_subscriptions.user_id = auth.uid()
));

CREATE POLICY "Users can delete their dependents"
ON public.dependents
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.user_subscriptions
  WHERE user_subscriptions.id = dependents.subscription_id
  AND user_subscriptions.user_id = auth.uid()
));

-- Add triggers for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default plans
INSERT INTO public.subscription_plans (name, type, description, price_monthly, price_yearly, specialist_consultations_per_year, includes_checkup, max_dependents, features) VALUES
('Bronze', 'bronze', 'Consultas ilimitadas com clínico geral 24h', 29.90, 299.00, 0, false, 0, '["Consultas ilimitadas com clínico geral", "Atendimento 24 horas", "Receitas digitais", "Desconto em medicamentos"]'),
('Prata', 'prata', 'Bronze + 1 consulta com especialista/ano', 49.90, 499.00, 1, false, 0, '["Tudo do plano Bronze", "1 consulta com especialista por ano", "Prioridade no atendimento"]'),
('Ouro', 'ouro', 'Prata + 2 consultas com especialista/ano', 79.90, 799.00, 2, false, 0, '["Tudo do plano Prata", "2 consultas com especialista por ano", "Desconto maior em medicamentos"]'),
('Platina', 'platina', 'Ouro + 3 consultas com especialista + check-up anual', 129.90, 1299.00, 3, true, 0, '["Tudo do plano Ouro", "3 consultas com especialista por ano", "Check-up anual gratuito", "Atendimento VIP"]'),
('Coletivo/Familiar', 'coletivo', 'Plano familiar com até 3 dependentes', 199.90, 1999.00, 3, true, 3, '["Todos benefícios do plano Platina", "Até 3 dependentes inclusos", "Economia para toda família"]');