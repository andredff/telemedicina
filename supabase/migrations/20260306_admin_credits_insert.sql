-- Migration: Add admin INSERT policy for consultation_credits table
-- Data: 2026-03-06
-- Descrição: Permitir que admins insiram créditos para qualquer usuário

-- ============================================================
-- CONSULTATION_CREDITS: admin can INSERT (add credits for users)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'consultation_credits'
      and policyname = 'Admins can insert consultation credits'
  ) then
    create policy "Admins can insert consultation credits"
      on public.consultation_credits
      for insert
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
        or auth.role() = 'service_role'
      );
  end if;
end $$;

-- Also allow admins to UPDATE credits
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'consultation_credits'
      and policyname = 'Admins can update consultation credits'
  ) then
    create policy "Admins can update consultation credits"
      on public.consultation_credits
      for update
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
        or auth.role() = 'service_role'
      );
  end if;
end $$;

-- Comentário explicativo
COMMENT ON POLICY "Admins can insert consultation credits" ON public.consultation_credits 
IS 'Permite que administradores insiram créditos de consultas para qualquer usuário';

-- Also allow admins to DELETE credits
do $
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'consultation_credits'
      and policyname = 'Admins can delete consultation credits'
  ) then
    create policy "Admins can delete consultation credits"
      on public.consultation_credits
      for delete
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
        or auth.role() = 'service_role'
      );
  end if;
end $;
