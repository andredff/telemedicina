-- Migration: Add admin policy for consultation_credits table
-- Data: 2026-03-04
-- Descrição: Permitir que admins vejam todos os créditos de consultas avulsas no dashboard

-- ============================================================
-- CONSULTATION_CREDITS: admin can SELECT (admin dashboard metrics)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'consultation_credits'
      and policyname = 'Admins can view all consultation credits'
  ) then
    create policy "Admins can view all consultation credits"
      on public.consultation_credits
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

-- Comentário explicativo
COMMENT ON POLICY "Admins can view all consultation credits" ON public.consultation_credits 
IS 'Permite que administradores visualizem todos os créditos de consultas para métricas do dashboard';
